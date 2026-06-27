import { useEffect, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/store/calendarStore';
import { useAuth } from '@/context/AuthContext';
import { useEventFormStore } from '@/store/eventFormStore';
import { localizeEvent, layoutWeek, layoutDayColumns } from '@/lib/eventLayout';
import type { LocalEvent } from '@/lib/eventLayout';
import type { EventInstance, ApiResponse } from '@calendar/shared';
import DayColumn from './DayColumn';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // px per hour

function formatHour(h: number): string {
  if (h === 0) return '';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Returns a compact GMT offset string like "GMT+5:30" for display in the footer. */
function getGmtOffsetLabel(tz: string): string {
  try {
    const now = new Date();
    // Get the UTC offset in minutes for the given timezone
    const utcDate  = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate   = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const diffMin  = Math.round((tzDate.getTime() - utcDate.getTime()) / 60_000);
    const sign     = diffMin >= 0 ? '+' : '-';
    const absMin   = Math.abs(diffMin);
    const h        = Math.floor(absMin / 60);
    const m        = absMin % 60;
    return `GMT${sign}${h}${m > 0 ? ':' + String(m).padStart(2, '0') : ''}`;
  } catch {
    return 'GMT';
  }
}

interface TimeGridProps {
  days: Date[];
}

export default function TimeGrid({ days }: TimeGridProps) {
  const { goToDate, setView } = useCalendarStore();
  const { openPopover, openModalEdit } = useEventFormStore();
  const { user } = useAuth();
  const today = new Date();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Events
  const { data: eventsResponse } = useQuery({
    queryKey: ['events', days[0].toISOString(), days[days.length - 1].toISOString()],
    queryFn: async () => {
      // Create exclusive end bound for the API
      const endBound = new Date(days[days.length - 1]);
      endBound.setDate(endBound.getDate() + 1);
      
      const res = await api.get<ApiResponse<EventInstance[]>>('/events', {
        params: {
          start: days[0].toISOString(),
          end: endBound.toISOString(),
        },
      });
      const body = res.data;
      if (!body.success) throw new Error(body.error?.message || 'Failed to fetch');
      return body.data;
    },
  });

  const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localEvents = (eventsResponse || []).map((e) => localizeEvent(e, tz));

  // 2. Layout All-Day Events
  const allDayEvents = localEvents.filter(e => e.is_all_day);
  const placedAllDay = layoutWeek(days, allDayEvents);
  
  // Calculate max tracks for all-day header so it expands dynamically
  const headerTracks = Math.max(0, ...placedAllDay.map(pe => pe.track)) + 1;
  const headerGridHeight = Math.max(1, headerTracks) * 22; // 22px per track

  // 3. Current Time Indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current hour on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      // Scroll so current hour is near the top
      scrollRef.current.scrollTop = currentHour * HOUR_HEIGHT - (HOUR_HEIGHT * 2);
    }
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPercent = (nowMinutes / 1440) * 100;

  // Handlers
  function handleDayClick(day: Date) {
    if (days.length === 1) return; // Already on day view
    goToDate(day);
    setView('day');
  }

  function handleCellClick(day: Date, hour: number, e: React.MouseEvent) {
    const time = new Date(day);
    time.setHours(hour, 0, 0, 0);
    const end = new Date(time);
    end.setHours(hour + 1);
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openPopover(rect.left + rect.width / 2, rect.top + rect.height / 2, time, end);
  }

  function handleEventClick(event: LocalEvent, e: React.MouseEvent) {
    e.stopPropagation();
    openModalEdit(event);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      
      {/* ── HEADER (Dates + All-Day) ── */}
      <div className="flex border-b border-[#dadce0] shrink-0">
        {/* Gutter */}
        <div className="w-14 shrink-0 border-r border-[#dadce0]" />
        
        <div className="flex-1 flex flex-col">
          {/* Day Labels Row */}
          <div className="flex" style={{ height: 72 }}>
            {days.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-center border-r border-[#dadce0] last:border-r-0">
                  <span className="text-[11px] font-medium text-[#70757a] uppercase tracking-wider mb-1">
                    {format(day, 'EEE')}
                  </span>
                  <button
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-3xl font-normal transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-primary-500 outline-none',
                      isToday ? 'bg-[#1a73e8] text-white hover:bg-[#1765cc]' : 'text-[#3c4043] hover:bg-[#f1f3f4]',
                      days.length === 1 && !isToday ? 'text-[#3c4043]' : ''
                    )}
                    aria-disabled={days.length === 1}
                  >
                    {format(day, 'd')}
                  </button>
                </div>
              );
            })}
          </div>

          {/* All-Day Events Row */}
          <div className="relative border-t border-[#dadce0] flex" style={{ minHeight: 28 }}>
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
               {/* Vertical grid lines for all-day area */}
               {days.map((_, i) => (
                 <div key={i} className="border-r border-[#dadce0] last:border-r-0" />
               ))}
            </div>

            <div className="relative flex-1 py-1" style={{ height: headerGridHeight + 8 }}>
               {placedAllDay.map(pe => {
                 const color = pe.event.color || '#039BE5';
                 return (
                   <div
                     key={pe.event.instance_id}
                     className="absolute px-1"
                     style={{
                       left: `${((pe.colStart - 1) / days.length) * 100}%`,
                       width: `${(pe.colSpan / days.length) * 100}%`,
                       top: `${pe.track * 22}px`,
                       height: '22px'
                     }}
                   >
                     <button
                        onClick={(e) => handleEventClick(pe.event, e)}
                        className="w-full h-[20px] text-left truncate rounded px-1.5 text-xs font-medium text-white transition-all hover:brightness-95 shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] focus-visible:ring-1 focus-visible:ring-primary-500 outline-none"
                        style={{ backgroundColor: color }}
                     >
                        {pe.event.title}
                     </button>
                   </div>
                 );
               })}
            </div>
          </div>
        </div>
      </div>

      {/* ── TIME GRID (Scrollable) ── */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Time Gutter */}
          <div className="w-14 shrink-0 relative border-r border-[#dadce0]">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: h * HOUR_HEIGHT - 8 }}
              >
                <span className="text-[10px] text-[#70757a]">{formatHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Columns */}
          <div className="flex-1 flex relative">
            {/* Horizontal Grid Lines (Shared across all columns) */}
            <div className="absolute inset-0 pointer-events-none">
               {HOURS.map((h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-[#dadce0]" style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {HOURS.map((h) => (
                  <div key={`half-${h}`} className="absolute left-0 right-0 border-t border-dashed border-[#e8eaed]" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}
            </div>

            {/* Current Time Indicator Line (Spans all columns) */}
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${nowTopPercent}%` }}
            >
               <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-[#ea4335] rounded-full" />
               <div className="w-full border-t-[2px] border-[#ea4335]" />
            </div>

            {/* Day Columns */}
            {days.map((day, dIndex) => {
              const isToday = isSameDay(day, today);
              const placedTimed = layoutDayColumns(day, localEvents);

              return (
                <DayColumn
                  key={dIndex}
                  day={day}
                  isToday={isToday}
                  placedEvents={placedTimed}
                  handleCellClick={handleCellClick}
                  handleEventClick={handleEventClick}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TIMEZONE LABEL (sticky footer below the grid) ── */}
      <div className="shrink-0 flex border-t border-[#dadce0] bg-white">
        <div className="w-14 shrink-0 border-r border-[#dadce0] flex items-center justify-end pr-2 py-1.5">
          <span
            className="text-[10px] font-medium text-[#1a73e8] bg-[#e8f0fe] px-1.5 py-0.5 rounded-full whitespace-nowrap"
            title={tz}
          >
            {getGmtOffsetLabel(tz)}
          </span>
        </div>
        <div className="flex-1 py-1.5 px-3">
          <span className="text-[10px] text-[#70757a]">{tz}</span>
        </div>
      </div>
    </div>
  );
}
