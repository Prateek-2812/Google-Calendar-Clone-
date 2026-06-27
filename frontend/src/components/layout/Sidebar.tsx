import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { useCalendarStore } from '@/store/calendarStore';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------
// My Calendars data — static for now, can be fetched later
// ----------------------------------------------------------------

const MY_CALENDARS = [
  { id: 'personal',  label: 'Personal',      color: '#4285F4', visible: true  },
  { id: 'work',      label: 'Work',           color: '#D50000', visible: true  },
  { id: 'birthdays', label: 'Birthdays',      color: '#F6BF26', visible: true  },
  { id: 'holidays',  label: 'Holidays in US', color: '#0B8043', visible: false },
];

// ----------------------------------------------------------------
// MiniCalendar
// ----------------------------------------------------------------

function MiniCalendar() {
  const { currentDate, goToDate, viewMode } = useCalendarStore();
  const [miniDate, setMiniDate] = useState(() => new Date(currentDate));

  const today = new Date();

  // Build the 6-week grid for the mini month
  const monthStart  = startOfMonth(miniDate);
  const monthEnd    = endOfMonth(miniDate);
  const gridStart   = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd     = endOfWeek(monthEnd,    { weekStartsOn: 0 });
  const days        = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function handleDayClick(day: Date) {
    goToDate(day);
    // Keep the mini-calendar month in sync with the clicked date
    setMiniDate(day);
  }

  return (
    <div className="px-3 py-2 select-none">
      {/* Month nav row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#3c4043]"
              style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
          {format(miniDate, 'MMMM yyyy')}
        </span>
        <div className="flex items-center">
          <button
            id="mini-prev-month"
            onClick={() => setMiniDate(subMonths(miniDate, 1))}
            aria-label="Previous month"
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
            </svg>
          </button>
          <button
            id="mini-next-month"
            onClick={() => setMiniDate(addMonths(miniDate, 1))}
            aria-label="Next month"
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i}
               className="flex items-center justify-center text-[10px] font-medium
                          text-[#70757a] h-7 w-7">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const isThisMonth = isSameMonth(day, miniDate);
          const isT = isSameDay(day, today);
          // Highlight the currently anchored date in the main view
          const isSelected = isSameDay(day, currentDate) && viewMode !== 'month';

          return (
            <button
              key={i}
              id={`mini-day-${format(day, 'yyyy-MM-dd')}`}
              onClick={() => handleDayClick(day)}
              aria-label={format(day, 'MMMM d, yyyy')}
              aria-current={isT ? 'date' : undefined}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-medium',
                'transition-colors duration-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                !isThisMonth && 'text-[#b0b3b8]',
                isThisMonth && !isT && !isSelected && 'text-[#3c4043] hover:bg-[#f1f3f4]',
                isT && !isSelected && 'bg-[#1a73e8] text-white hover:bg-[#1765cc]',
                isSelected && !isT && 'bg-[#e8f0fe] text-[#1a73e8]',
                isSelected && isT  && 'bg-[#1a73e8] text-white ring-2 ring-[#e8f0fe]',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// CalendarList (My calendars)
// ----------------------------------------------------------------

function CalendarList() {
  const [calendars, setCalendars] = useState(MY_CALENDARS);

  function toggle(id: string) {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  }

  return (
    <div className="mt-2 px-1">
      {/* Section label */}
      <button
        className="flex items-center justify-between w-full px-2 py-1.5
                   rounded hover:bg-[#f1f3f4] group transition-colors"
        aria-label="Toggle My Calendars section"
      >
        <span className="text-xs font-semibold text-[#3c4043] uppercase tracking-wide">
          My calendars
        </span>
        <svg
          className="w-4 h-4 text-[#5f6368] opacity-0 group-hover:opacity-100 transition-opacity"
          viewBox="0 0 24 24" fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      <ul className="mt-1 space-y-0.5">
        {calendars.map((cal) => (
          <li key={cal.id}>
            <label
              htmlFor={`cal-toggle-${cal.id}`}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-full cursor-pointer
                         hover:bg-[#f1f3f4] transition-colors group"
            >
              {/* Colour checkbox */}
              <span className="relative flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  id={`cal-toggle-${cal.id}`}
                  checked={cal.visible}
                  onChange={() => toggle(cal.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center',
                    'transition-colors duration-150 border-2',
                  )}
                  style={{
                    backgroundColor: cal.visible ? cal.color : 'transparent',
                    borderColor: cal.color,
                  }}
                  aria-hidden="true"
                >
                  {cal.visible && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M4.5 8.5L1.5 5.5l1-1 2 2 4-4 1 1z" />
                    </svg>
                  )}
                </span>
              </span>

              <span className={cn(
                'text-sm truncate transition-colors',
                cal.visible ? 'text-[#3c4043]' : 'text-[#9aa0a6]',
              )}>
                {cal.label}
              </span>

              {/* Three-dot menu (placeholder) */}
              <button
                className="ml-auto w-6 h-6 rounded-full flex items-center justify-center
                           text-[#5f6368] opacity-0 group-hover:opacity-100
                           hover:bg-[#e8eaed] transition-all"
                onClick={(e) => e.preventDefault()}
                aria-label={`Options for ${cal.label}`}
                tabIndex={-1}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------
// Sidebar component
// ----------------------------------------------------------------

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  return (
    <>
      {/* Sidebar panel */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed top-16 left-0 bottom-0 z-20 w-64 bg-white',
          'overflow-y-auto overflow-x-hidden no-scrollbar',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Create button — matches Google's FAB-in-sidebar */}
        <div className="px-3 pt-4 pb-2">
          <button
            id="create-event-sidebar"
            aria-label="Create new event"
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white
                       border border-[#dadce0] shadow-[0_1px_3px_0_rgba(60,64,67,.3)]
                       text-sm font-medium text-[#3c4043]
                       hover:shadow-[0_2px_8px_0_rgba(60,64,67,.3)] hover:bg-[#f8f9fa]
                       transition-all duration-150
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-primary-500"
          >
            <svg className="w-5 h-5 text-[#1a73e8]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            Create
          </button>
        </div>

        {/* Mini month calendar */}
        <MiniCalendar />

        <div className="mx-3 my-2 border-t border-[#e8eaed]" />

        {/* My Calendars list */}
        <CalendarList />

        {/* Other calendars section (placeholder) */}
        <div className="mt-2 px-1">
          <button
            className="flex items-center justify-between w-full px-2 py-1.5
                       rounded hover:bg-[#f1f3f4] group transition-colors"
          >
            <span className="text-xs font-semibold text-[#3c4043] uppercase tracking-wide">
              Other calendars
            </span>
            <svg
              className="w-4 h-4 text-[#5f6368] opacity-0 group-hover:opacity-100 transition-opacity"
              viewBox="0 0 24 24" fill="currentColor"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Mobile overlay — tap outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/20 md:hidden"
          aria-hidden="true"
          onClick={() => {/* handled by parent toggle */}}
        />
      )}
    </>
  );
}
