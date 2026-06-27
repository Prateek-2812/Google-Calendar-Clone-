import AppShell from '@/components/layout/AppShell';
import MonthView from '@/components/calendar/MonthView';
import WeekView  from '@/components/calendar/WeekView';
import DayView   from '@/components/calendar/DayView';
import { useCalendarStore } from '@/store/calendarStore';
import QuickCreatePopover from '@/components/calendar/QuickCreatePopover';
import EventModal from '@/components/calendar/EventModal';
import CalendarDndProvider from '@/components/calendar/CalendarDndProvider';

export default function CalendarPage() {
  const viewMode = useCalendarStore((s) => s.viewMode);

  return (
    <AppShell>
      {/* FAB — Create event */}
      <CreateEventFab />

      {/* Active view */}
      <CalendarDndProvider>
        <div className="flex flex-1 overflow-hidden">
          {viewMode === 'month' && <MonthView />}
          {viewMode === 'week'  && <WeekView />}
          {viewMode === 'day'   && <DayView />}
        </div>
      </CalendarDndProvider>
      <QuickCreatePopover />
      <EventModal />
    </AppShell>
  );
}

// ----------------------------------------------------------------
// Floating Action Button — "Create" (pencil icon, shows on mobile)
// ----------------------------------------------------------------

function CreateEventFab() {
  return (
    <button
      id="create-event-fab"
      aria-label="Create new event"
      className="fixed bottom-6 right-6 z-40 md:hidden
                 flex items-center gap-2 px-5 py-3.5 rounded-2xl
                 bg-white text-[#3c4043] text-sm font-medium
                 border border-[#dadce0]
                 shadow-[0_1px_3px_0_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)]
                 hover:shadow-[0_2px_6px_0_rgba(60,64,67,.3)] hover:bg-[#f8f9fa]
                 transition-all duration-150 animate-fade-in"
    >
      <svg className="w-5 h-5 text-[#1a73e8]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
      Create
    </button>
  );
}
