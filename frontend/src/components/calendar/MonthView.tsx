import {
  startOfMonth,
  startOfWeek,
  addDays,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCalendarStore } from '@/store/calendarStore';
import { useAuth } from '@/context/AuthContext';
import { useEventFormStore } from '@/store/eventFormStore';
import { localizeEvent, layoutWeek } from '@/lib/eventLayout';
import type { LocalEvent } from '@/lib/eventLayout';
import type { EventInstance, ApiResponse } from '@calendar/shared';
import MonthDayCell from './MonthDayCell';
import MonthEventPill from './MonthEventPill';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_TRACKS = 3; // Tracks 0, 1, 2 are visible. Track 3+ go into "+N more"

export default function MonthView() {
  const { currentDate, goToDate, setView } = useCalendarStore();
  const { openPopover, openModalEdit } = useEventFormStore();
  const { user } = useAuth();
  const today = new Date();

  // 1. Calculate Grid Dates (Exactly 42 days = 6 weeks)
  const monthStart = startOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // 2. Fetch Events
  const { data: eventsResponse } = useQuery({
    queryKey: ['events', days[0].toISOString(), days[41].toISOString()],
    queryFn: async () => {
      const res = await api.get<ApiResponse<EventInstance[]>>('/events', {
        params: {
          // Send ISO bounds to the backend API
          start: days[0].toISOString(),
          // end needs to be the end of the 42nd day (exclusive bound)
          end: addDays(days[41], 1).toISOString(),
        },
      });
      const body = res.data;
      if (!body.success) throw new Error(body.error?.message || 'Failed to fetch');
      return body.data;
    },
  });

  // Localize timestamps
  const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localEvents = (eventsResponse || []).map((e) => localizeEvent(e, tz));

  // 3. Break into 6 weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // 4. Handlers
  function handleDayNumberClick(day: Date, e: React.MouseEvent) {
    e.stopPropagation();
    goToDate(day);
    setView('day');
  }

  function handleCellClick(day: Date, e: React.MouseEvent) {
    // Open Quick Create popover
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const end = new Date(day);
    end.setHours(1, 0, 0, 0); // Default to 1 hour duration
    openPopover(rect.left + rect.width / 2, rect.top + rect.height / 2, day, end);
  }

  function handleEventClick(event: LocalEvent, e: React.MouseEvent) {
    e.stopPropagation();
    openModalEdit(event);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-b border-[#dadce0] shrink-0">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-[#70757a] uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week Rows */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {weeks.map((week, wIndex) => {
          const placedEvents = layoutWeek(week, localEvents);

          // Calculate overflow counts for each of the 7 days in this week
          const overflows = Array(7).fill(0);
          placedEvents.forEach((pe) => {
            if (pe.track >= MAX_TRACKS) {
              for (let i = 0; i < pe.colSpan; i++) {
                overflows[pe.colStart - 1 + i]++;
              }
            }
          });

          return (
            <div key={wIndex} className="flex-1 relative border-b border-[#dadce0] last:border-b-0">
              
              {/* Layer 1: Background cells & click targets */}
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((day, dIndex) => (
                  <MonthDayCell
                    key={dIndex}
                    day={day}
                    currentDate={currentDate}
                    today={today}
                    handleCellClick={handleCellClick}
                    handleDayNumberClick={handleDayNumberClick}
                  />
                ))}
              </div>

              {/* Layer 2: Event Tracks & Overflows */}
              <div
                className="absolute inset-0 grid grid-cols-7 pointer-events-none"
                style={{ gridTemplateRows: '28px repeat(4, 22px)' }} // 1 row for numbers, 3 for events, 1 for overflow
              >
                {/* Event Pills */}
                {placedEvents
                  .filter((pe) => pe.track < MAX_TRACKS)
                  .map((pe) => (
                    <MonthEventPill
                      key={`${pe.event.instance_id}-${wIndex}`}
                      pe={pe}
                      wIndex={wIndex}
                      handleEventClick={handleEventClick}
                    />
                  ))}

                {/* +N more Pills */}
                {overflows.map((count, i) => {
                  if (count === 0) return null;
                  return (
                    <div
                      key={`overflow-${i}`}
                      className="px-1 pointer-events-auto"
                      style={{
                        gridColumn: `${i + 1}`,
                        gridRow: `${MAX_TRACKS + 2}`,
                      }}
                    >
                      <button
                        className="w-full text-left px-1.5 py-0.5 text-[11px] font-medium text-[#70757a] hover:bg-[#f1f3f4] rounded transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayNumberClick(week[i], e);
                        }}
                      >
                        {count} more
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
