/**
 * useEventDraft — auto-saves a partial event form to localStorage every 2s.
 *
 * Usage:
 *   const { draft, saveDraft, clearDraft } = useEventDraft();
 *
 * The draft is stored under DRAFT_KEY in localStorage.
 * Calling clearDraft() removes it (call on successful save or explicit discard).
 */

import { useCallback, useEffect, useRef } from 'react';

const DRAFT_KEY = 'calendar_event_draft';

export interface EventDraft {
  title: string;
  description: string;
  startDateStr: string;
  startTimeStr: string;
  endDateStr: string;
  endTimeStr: string;
  color: string;
  isAllDay: boolean;
  recurrenceFreq: string;
  savedAt: number; // timestamp ms
}

/** Returns the draft from localStorage, or null if none. */
export function loadDraft(): EventDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventDraft;
  } catch {
    return null;
  }
}

/**
 * Hook: auto-saves the provided draft values to localStorage at a 2-second
 * debounce interval.  Also exposes `clearDraft`.
 *
 * @param values  The current form field values to persist.
 * @param active  Only auto-saves when true (i.e. modal is open).
 */
export function useEventDraft(
  values: Omit<EventDraft, 'savedAt'> | null,
  active: boolean
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save
  useEffect(() => {
    if (!active || !values) return;

    // Skip saving if title and description are both empty (avoid phantom drafts)
    if (!values.title.trim() && !values.description.trim()) return;

    timerRef.current = setTimeout(() => {
      try {
        const draft: EventDraft = { ...values, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // localStorage might be full; silently fail
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, active]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  return { clearDraft };
}
