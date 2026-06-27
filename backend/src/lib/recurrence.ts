/**
 * recurrence.ts
 *
 * Pure, dependency-free recurrence expander.
 * Given a master event and its recurrence rule, generates all occurrences
 * that overlap with a [rangeStart, rangeEnd) window.
 *
 * Supports: DAILY, WEEKLY, MONTHLY, YEARLY — with interval and until/count.
 * Hard cap: MAX_INSTANCES per series to guard against infinite rules.
 */

import type { Event, EventInstance, RecurrenceRule } from '@calendar/shared';

/** Safety cap — never expand more than this many instances per series. */
const MAX_INSTANCES = 730; // ~2 years of daily events

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface ExceptionMap {
  [originalStartUtc: string]: {
    new_start_utc: string | null;
    new_end_utc: string | null;
    new_title: string | null;
    is_deleted: number; // SQLite 0/1
  };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Advance a Date by one recurrence step, mutating it in place. */
function advance(date: Date, rule: RecurrenceRule): void {
  const interval = rule.interval ?? 1;

  switch (rule.freq) {
    case 'DAILY':
      date.setUTCDate(date.getUTCDate() + interval);
      break;

    case 'WEEKLY':
      date.setUTCDate(date.getUTCDate() + 7 * interval);
      break;

    case 'MONTHLY': {
      // Preserve the original day-of-month; clamp to month end when necessary.
      const targetDay = date.getUTCDate();
      date.setUTCMonth(date.getUTCMonth() + interval, 1); // go to 1st of target month
      const lastDay = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
      ).getUTCDate();
      date.setUTCDate(Math.min(targetDay, lastDay));
      break;
    }

    case 'YEARLY':
      date.setUTCFullYear(date.getUTCFullYear() + interval);
      break;
  }
}

/**
 * Build a stable instance_id for a recurring occurrence.
 * Non-recurring events use the event id as-is.
 */
function makeInstanceId(eventId: string, originalStartUtc: string): string {
  // Replace colons and dots that are illegal in some URL contexts.
  const safe = originalStartUtc.replace(/[:.]/g, '-');
  return `${eventId}_${safe}`;
}

// ----------------------------------------------------------------
// Core expander
// ----------------------------------------------------------------

/**
 * Expand a recurring master event into concrete {@link EventInstance} objects
 * that overlap with the half-open range [rangeStartMs, rangeEndMs).
 *
 * @param event        The master event row (must have a recurrence_rule).
 * @param rangeStartMs Range start in milliseconds (inclusive).
 * @param rangeEndMs   Range end in milliseconds (exclusive).
 * @param exceptions   Map keyed by original_start_utc for this event.
 */
export function expandRecurring(
  event: Event,
  rangeStartMs: number,
  rangeEndMs: number,
  exceptions: ExceptionMap
): EventInstance[] {
  const rule = event.recurrence_rule!;
  const instances: EventInstance[] = [];

  const masterStart = new Date(event.start_utc);
  const masterEnd = new Date(event.end_utc);
  const durationMs = masterEnd.getTime() - masterStart.getTime();

  // Iterator starts at the master event's start
  const cursor = new Date(masterStart);

  // Precompute until boundary
  const untilMs = rule.until ? new Date(rule.until).getTime() : Infinity;

  let count = 0;
  const maxCount = rule.count ?? MAX_INSTANCES;

  while (true) {
    const occStart = cursor.getTime();

    // Stop if we've passed the until date or the hard count cap
    if (occStart > untilMs || count >= maxCount) break;

    // Stop if occurrence starts after the query range ends
    if (occStart >= rangeEndMs) break;

    const occEnd = occStart + durationMs;

    // Only emit if the occurrence overlaps the range (occStart < rangeEnd && occEnd > rangeStart)
    if (occEnd > rangeStartMs) {
      const originalStartUtc = cursor.toISOString();
      const exc = exceptions[originalStartUtc];

      // Skip deleted exceptions
      if (!exc || !exc.is_deleted) {
        const effectiveStart = exc?.new_start_utc ?? originalStartUtc;
        const effectiveEnd =
          exc?.new_end_utc ?? new Date(occEnd).toISOString();
        const effectiveTitle = exc?.new_title ?? event.title;

        instances.push({
          instance_id: makeInstanceId(event.id, originalStartUtc),
          event_id: event.id,
          original_start_utc: originalStartUtc,
          start_utc: effectiveStart,
          end_utc: effectiveEnd,
          title: effectiveTitle,
          description: event.description,
          color: event.color,
          is_all_day: event.is_all_day,
          recurrence_rule: event.recurrence_rule,
          has_exception: !!exc,
          is_deleted: false,
          user_id: event.user_id,
          created_at: event.created_at,
          updated_at: event.updated_at,
        });
      }
    }

    count++;
    advance(cursor, rule);
  }

  return instances;
}

/**
 * Wrap a single non-recurring event as an {@link EventInstance}.
 */
export function wrapSingleEvent(event: Event): EventInstance {
  return {
    instance_id: event.id,
    event_id: event.id,
    original_start_utc: event.start_utc,
    start_utc: event.start_utc,
    end_utc: event.end_utc,
    title: event.title,
    description: event.description,
    color: event.color,
    is_all_day: event.is_all_day,
    recurrence_rule: undefined,
    has_exception: false,
    is_deleted: false,
    user_id: event.user_id,
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
}
