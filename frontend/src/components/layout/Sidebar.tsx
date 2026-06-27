import { useState, useRef, useEffect } from 'react';
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
import {
  useCalendars,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
} from '@/hooks/useCalendars';
import type { Calendar, CalendarSection } from '@calendar/shared';

// ----------------------------------------------------------------
// Color swatches for "Add other calendar"
// ----------------------------------------------------------------

const SWATCH_COLORS = [
  '#1a73e8', '#d50000', '#f4511e',
  '#0b8043', '#8e24aa', '#f6bf26',
];

// ----------------------------------------------------------------
// MiniCalendar
// ----------------------------------------------------------------

function MiniCalendar() {
  const { currentDate, goToDate, viewMode } = useCalendarStore();
  const [miniDate, setMiniDate] = useState(() => new Date(currentDate));

  const today = new Date();

  const monthStart = startOfMonth(miniDate);
  const monthEnd   = endOfMonth(miniDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 0 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function handleDayClick(day: Date) {
    goToDate(day);
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
          const isT         = isSameDay(day, today);
          const isSelected  = isSameDay(day, currentDate) && viewMode !== 'month';

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
// CalendarRow
// ----------------------------------------------------------------

interface CalendarRowProps {
  calendar: Calendar;
}

function CalendarRow({ calendar }: CalendarRowProps) {
  const updateCalendar = useUpdateCalendar();
  const deleteCalendar = useDeleteCalendar();

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [editName,  setEditName]  = useState(calendar.name);
  const menuRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Focus edit input
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleToggle() {
    updateCalendar.mutate({ id: calendar.id, is_visible: !calendar.is_visible });
  }

  function handleRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== calendar.name) {
      updateCalendar.mutate({ id: calendar.id, name: trimmed });
    }
    setEditing(false);
  }

  function handleDelete() {
    if (confirm(`Delete calendar "${calendar.name}"? Events will not be deleted.`)) {
      deleteCalendar.mutate(calendar.id);
    }
    setMenuOpen(false);
  }

  return (
    <li className="relative">
      <label
        htmlFor={`cal-toggle-${calendar.id}`}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-full cursor-pointer
                   hover:bg-[#f1f3f4] transition-colors group"
      >
        {/* Colour checkbox */}
        <span className="relative flex items-center justify-center shrink-0">
          <input
            type="checkbox"
            id={`cal-toggle-${calendar.id}`}
            checked={calendar.is_visible}
            onChange={handleToggle}
            className="sr-only"
          />
          <span
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center',
              'transition-colors duration-150 border-2',
            )}
            style={{
              backgroundColor: calendar.is_visible ? calendar.color : 'transparent',
              borderColor: calendar.color,
            }}
            aria-hidden="true"
          >
            {calendar.is_visible && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 8.5L1.5 5.5l1-1 2 2 4-4 1 1z" />
              </svg>
            )}
          </span>
        </span>

        {/* Name (or inline edit) */}
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setEditName(calendar.name); setEditing(false); }
            }}
            onClick={(e) => e.preventDefault()}
            className="flex-1 text-sm text-[#3c4043] bg-transparent border-b border-[#1a73e8]
                       outline-none px-0"
          />
        ) : (
          <span className={cn(
            'flex-1 text-sm truncate transition-colors',
            calendar.is_visible ? 'text-[#3c4043]' : 'text-[#9aa0a6]',
          )}>
            {calendar.name}
          </span>
        )}

        {/* Three-dot menu trigger */}
        {!editing && (
          <button
            className="ml-auto w-6 h-6 rounded-full flex items-center justify-center
                       text-[#5f6368] opacity-0 group-hover:opacity-100
                       hover:bg-[#e8eaed] transition-all"
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            aria-label={`Options for ${calendar.name}`}
            tabIndex={-1}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        )}
      </label>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-8 z-50 bg-white rounded-xl shadow-xl
                     border border-[#e8eaed] py-1 min-w-[160px]"
        >
          <button
            onClick={() => { setEditing(true); setMenuOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-[#3c4043] hover:bg-[#f1f3f4] transition-colors"
          >
            Edit name
          </button>
          <button
            onClick={() => {
              updateCalendar.mutate({ id: calendar.id, is_visible: false });
              setMenuOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#3c4043] hover:bg-[#f1f3f4] transition-colors"
          >
            Hide from list
          </button>
          <button
            onClick={handleDelete}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

// ----------------------------------------------------------------
// CalendarSection — renders "MY CALENDARS" or "OTHER CALENDARS"
// ----------------------------------------------------------------

interface CalendarSectionProps {
  title: string;
  calendars: Calendar[];
  section: CalendarSection;
}

function CalendarSectionBlock({ title, calendars, section }: CalendarSectionProps) {
  const createCalendar = useCreateCalendar();

  const [addOpen,   setAddOpen]   = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newColor,  setNewColor]  = useState(SWATCH_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addOpen) inputRef.current?.focus();
  }, [addOpen]);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    createCalendar.mutate({ name, color: newColor, section }, {
      onSuccess: () => {
        setNewName('');
        setNewColor(SWATCH_COLORS[0]);
        setAddOpen(false);
      },
    });
  }

  return (
    <div className="mt-2 px-1">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold text-[#3c4043] uppercase tracking-wide">
          {title}
        </span>
        <button
          onClick={() => setAddOpen((v) => !v)}
          aria-label={`Add ${title} calendar`}
          className="w-6 h-6 rounded-full flex items-center justify-center
                     text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </div>

      {/* Calendar list */}
      <ul className="mt-1 space-y-0.5">
        {calendars.map((cal) => (
          <CalendarRow key={cal.id} calendar={cal} />
        ))}
      </ul>

      {/* Add form */}
      {addOpen && (
        <div className="mx-2 mt-2 p-3 bg-[#f8f9fa] rounded-xl border border-[#e8eaed]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Calendar name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setAddOpen(false);
            }}
            className="w-full text-sm bg-white border border-[#dadce0] rounded-lg
                       px-3 py-1.5 focus:border-[#1a73e8] outline-none mb-2"
          />
          {/* Color swatches */}
          <div className="flex gap-1.5 mb-3">
            {SWATCH_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full flex items-center justify-center
                           transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              >
                {newColor === c && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4.5 8.5L1.5 5.5l1-1 2 2 4-4 1 1z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || createCalendar.isPending}
              className="flex-1 py-1.5 rounded-lg bg-[#1a73e8] text-white text-xs font-medium
                         hover:bg-[#1765cc] transition-colors disabled:opacity-50"
            >
              {createCalendar.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="flex-1 py-1.5 rounded-lg border border-[#dadce0] text-[#5f6368]
                         text-xs hover:bg-[#f1f3f4] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
  const { data: allCalendars = [] } = useCalendars();

  const myCalendars    = allCalendars.filter((c) => c.section === 'my');
  const otherCalendars = allCalendars.filter((c) => c.section === 'other');

  return (
    <>
      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed top-16 left-0 bottom-0 z-20 w-64 bg-white',
          'overflow-y-auto overflow-x-hidden no-scrollbar',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Create button */}
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

        {/* MY CALENDARS */}
        <CalendarSectionBlock
          title="My Calendars"
          calendars={myCalendars}
          section="my"
        />

        {/* OTHER CALENDARS */}
        <CalendarSectionBlock
          title="Other Calendars"
          calendars={otherCalendars}
          section="other"
        />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/20 md:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
}
