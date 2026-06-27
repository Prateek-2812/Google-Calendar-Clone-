import { create } from 'zustand';
import {
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  startOfMonth,
} from 'date-fns';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type ViewMode = 'day' | 'week' | 'month';

interface CalendarState {
  /** The "anchor" date — today by default. Drives what's visible in the main grid. */
  currentDate: Date;

  /** Which view is active. */
  viewMode: ViewMode;

  /** Navigate forward by one period (day / week / month depending on viewMode). */
  goNext: () => void;

  /** Navigate back by one period. */
  goPrev: () => void;

  /** Jump the anchor to today. */
  goToToday: () => void;

  /**
   * Jump to a specific date (e.g. when a mini-calendar day is clicked).
   * Also switches to day view when the same viewMode is 'day', otherwise
   * keeps the current mode and re-anchors.
   */
  goToDate: (date: Date) => void;

  /** Switch between day / week / month view. */
  setView: (mode: ViewMode) => void;

  /** ID of the event instance to pulse-highlight (set by search result click). */
  pulsedEventId: string | null;

  /** Set or clear the pulsed event id. Clears automatically after 2 s. */
  setPulsedEventId: (id: string | null) => void;
}

// ----------------------------------------------------------------
// Helpers — advance current date by one period
// ----------------------------------------------------------------

function nextDate(date: Date, view: ViewMode): Date {
  switch (view) {
    case 'day':   return addDays(date, 1);
    case 'week':  return addWeeks(date, 1);
    case 'month': return addMonths(date, 1);
  }
}

function prevDate(date: Date, view: ViewMode): Date {
  switch (view) {
    case 'day':   return subDays(date, 1);
    case 'week':  return subWeeks(date, 1);
    case 'month': return subMonths(date, 1);
  }
}

// ----------------------------------------------------------------
// Store
// ----------------------------------------------------------------

export const useCalendarStore = create<CalendarState>((set, get) => ({
  currentDate: new Date(),
  viewMode: 'month',
  pulsedEventId: null,

  goNext: () =>
    set((s) => ({ currentDate: nextDate(s.currentDate, s.viewMode) })),

  goPrev: () =>
    set((s) => ({ currentDate: prevDate(s.currentDate, s.viewMode) })),

  goToToday: () => set({ currentDate: new Date() }),

  goToDate: (date) => set({ currentDate: date }),

  setView: (mode) => {
    const { currentDate } = get();
    let snapped = currentDate;
    if (mode === 'week')  snapped = startOfWeek(currentDate, { weekStartsOn: 0 });
    if (mode === 'month') snapped = startOfMonth(currentDate);
    set({ viewMode: mode, currentDate: snapped });
  },

  setPulsedEventId: (id) => {
    set({ pulsedEventId: id });
    if (id) {
      setTimeout(() => set({ pulsedEventId: null }), 2000);
    }
  },
}));

// ----------------------------------------------------------------
// Selectors (memoised outside the component for stable refs)
// ----------------------------------------------------------------

export const selectCurrentDate = (s: CalendarState) => s.currentDate;
export const selectViewMode    = (s: CalendarState) => s.viewMode;
