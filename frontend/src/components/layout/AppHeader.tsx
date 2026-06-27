import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCalendarStore, type ViewMode } from '@/store/calendarStore';

// ----------------------------------------------------------------
// Icons
// ----------------------------------------------------------------

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 3h-1V1h-2v2H7V1H5v2H4C2.9 3 2 3.9 2 5v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z" />
    </svg>
  );
}

// ----------------------------------------------------------------
// Period label formatter — matches Google Calendar's header
// ----------------------------------------------------------------

function getPeriodLabel(date: Date, view: ViewMode): string {
  switch (view) {
    case 'day':
      return format(date, 'MMMM d, yyyy');
    case 'week': {
      // Show "June 22 – 28, 2025" or "June 29 – July 5, 2025"
      const start = date;
      const end = new Date(date);
      end.setDate(end.getDate() + 6);
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMMM d')} – ${format(end, 'd, yyyy')}`;
      }
      if (start.getFullYear() === end.getFullYear()) {
        return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
      }
      return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
    }
    case 'month':
      return format(date, 'MMMM yyyy');
  }
}

// ----------------------------------------------------------------
// View mode pill tabs
// ----------------------------------------------------------------

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'Day',   value: 'day'   },
  { label: 'Week',  value: 'week'  },
  { label: 'Month', value: 'month' },
];

// ----------------------------------------------------------------
// AppHeader component
// ----------------------------------------------------------------

interface AppHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function AppHeader({ sidebarOpen, onToggleSidebar }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { currentDate, viewMode, goNext, goPrev, goToToday, setView } = useCalendarStore();

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 h-16 flex items-center gap-2 px-3
                 bg-white border-b border-[#dadce0]"
    >
      {/* ── Left cluster: hamburger + logo ── */}
      <button
        id="sidebar-toggle"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
        className="w-10 h-10 rounded-full flex items-center justify-center
                   text-[#5f6368] hover:bg-[#f1f3f4] transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <HamburgerIcon />
      </button>

      {/* Logo — Google Calendar-style coloured calendar icon + wordmark */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); goToToday(); }}
        className="flex items-center gap-2.5 ml-1 select-none"
        aria-label="Go to today"
      >
        {/* Four-colour calendar icon */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 rounded-sm overflow-hidden">
            <div className="bg-[#4285F4]" />
            <div className="bg-[#EA4335]" />
            <div className="bg-[#FBBC05]" />
            <div className="bg-[#34A853]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <CalendarIcon />
          </div>
        </div>
        <span className="hidden sm:block text-[22px] font-normal text-[#3c4043] tracking-tight"
              style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
          Calendar
        </span>
      </a>

      {/* ── Centre cluster: Today + chevrons + period label ── */}
      <div className="flex items-center gap-1 ml-4">
        {/* Today button */}
        <button
          id="today-btn"
          onClick={goToToday}
          className="hidden sm:inline-flex items-center justify-center px-4 h-9 rounded-[4px]
                     text-sm font-medium text-[#3c4043] border border-[#dadce0]
                     hover:bg-[#f1f3f4] transition-colors duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Today
        </button>

        {/* Prev chevron */}
        <button
          id="nav-prev"
          onClick={goPrev}
          aria-label="Previous"
          className="w-9 h-9 rounded-full flex items-center justify-center
                     text-[#5f6368] hover:bg-[#f1f3f4] transition-colors duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ChevronLeft />
        </button>

        {/* Next chevron */}
        <button
          id="nav-next"
          onClick={goNext}
          aria-label="Next"
          className="w-9 h-9 rounded-full flex items-center justify-center
                     text-[#5f6368] hover:bg-[#f1f3f4] transition-colors duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ChevronRight />
        </button>

        {/* Period label */}
        <h1 className="ml-1 text-[22px] font-normal text-[#3c4043] whitespace-nowrap"
            style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
          {getPeriodLabel(currentDate, viewMode)}
        </h1>
      </div>

      {/* ── Right cluster: view switcher + search + user avatar ── */}
      <div className="ml-auto flex items-center gap-2">
        {/* View mode switcher — pill tab bar */}
        <div className="hidden md:flex items-center rounded-[4px] border border-[#dadce0] overflow-hidden">
          {VIEW_OPTIONS.map(({ label, value }, i) => (
            <button
              key={value}
              id={`view-${value}`}
              onClick={() => setView(value)}
              aria-pressed={viewMode === value}
              className={[
                'px-4 h-9 text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                i < VIEW_OPTIONS.length - 1 ? 'border-r border-[#dadce0]' : '',
                viewMode === value
                  ? 'bg-[#e8f0fe] text-[#1a73e8]'
                  : 'text-[#5f6368] hover:bg-[#f1f3f4]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search icon (placeholder — wired up later) */}
        <button
          id="search-btn"
          aria-label="Search"
          className="w-10 h-10 rounded-full flex items-center justify-center
                     text-[#5f6368] hover:bg-[#f1f3f4] transition-colors duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>

        {/* Settings icon (placeholder) */}
        <button
          id="settings-btn"
          aria-label="Settings"
          className="w-10 h-10 rounded-full flex items-center justify-center
                     text-[#5f6368] hover:bg-[#f1f3f4] transition-colors duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.06 7.06 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22l-1.92 3.32a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>

        {/* User avatar */}
        <button
          id="user-avatar"
          aria-label={`Account: ${user?.name ?? 'User'}`}
          title={`${user?.name}\n${user?.email}`}
          onClick={handleLogout}
          className="w-9 h-9 rounded-full flex items-center justify-center
                     text-white text-sm font-medium select-none
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          style={{ background: 'linear-gradient(135deg,#4285F4,#1a73e8)' }}
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
