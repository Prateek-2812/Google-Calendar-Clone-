import { isBefore, isAfter, differenceInCalendarDays, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { EventInstance } from '@calendar/shared';

export interface LocalEvent extends EventInstance {
  localStart: Date;
  localEnd: Date;
}

export interface PlacedEvent {
  event: LocalEvent;
  /** 1-indexed column start (1 to 7) for CSS Grid */
  colStart: number;
  /** number of columns to span (1 to 7) */
  colSpan: number;
  /** Vertical row index within the week (0, 1, 2, ...) */
  track: number;
  /** True if this event segment started in a previous week */
  isContinuation: boolean;
  /** True if this event segment continues into the next week */
  hasNext: boolean;
}

export interface PlacedDayEvent {
  event: LocalEvent;
  topPercent: number; // 0 to 100
  heightPercent: number; // 0 to 100
  leftPercent: number; // 0 to 100
  widthPercent: number; // 0 to 100
}

export function localizeEvent(event: EventInstance, timeZone: string): LocalEvent {
  let localStart: Date;
  let localEnd: Date;

  if (event.is_all_day) {
    // For all-day events, treat the UTC date string as local time to prevent shifting.
    // e.g. "2024-05-01T00:00:00Z" -> "2024-05-01T00:00:00" local
    localStart = new Date(event.start_utc.substring(0, 19));
    localEnd = new Date(event.end_utc.substring(0, 19));
  } else {
    localStart = toZonedTime(event.start_utc, timeZone);
    localEnd = toZonedTime(event.end_utc, timeZone);
  }

  return { ...event, localStart, localEnd };
}

/**
 * Lays out events across a horizontal header grid.
 *
 * @param gridDays Array of Dates (e.g. 7 for week view, 1 for day view, 7 for a week row in month view)
 * @param events All local events to consider
 */
export function layoutWeek(gridDays: Date[], events: LocalEvent[]): PlacedEvent[] {
  const numDays = gridDays.length;
  if (numDays === 0) return [];

  const gridStart = gridDays[0];
  const gridEnd = new Date(gridDays[numDays - 1]);
  gridEnd.setHours(23, 59, 59, 999);

  // 1. Filter events that overlap this grid
  const overlapping = events.filter((e) => {
    return isBefore(e.localStart, gridEnd) && isAfter(e.localEnd, gridStart);
  });

  // 2. Sort events
  // Spanning/All-day first, then by start time, then by duration
  overlapping.sort((a, b) => {
    const aIsSpanning = a.is_all_day || differenceInCalendarDays(a.localEnd, a.localStart) > 0;
    const bIsSpanning = b.is_all_day || differenceInCalendarDays(b.localEnd, b.localStart) > 0;

    if (aIsSpanning && !bIsSpanning) return -1;
    if (!aIsSpanning && bIsSpanning) return 1;

    if (a.localStart.getTime() !== b.localStart.getTime()) {
      return a.localStart.getTime() - b.localStart.getTime();
    }

    const aDur = a.localEnd.getTime() - a.localStart.getTime();
    const bDur = b.localEnd.getTime() - b.localStart.getTime();
    return bDur - aDur;
  });

  // 3. Assign tracks
  const placedEvents: PlacedEvent[] = [];
  const tracks: (LocalEvent | null)[][] = [];

  for (const event of overlapping) {
    let startCol = 0;
    let isContinuation = false;

    if (isBefore(event.localStart, gridStart)) {
      startCol = 0;
      isContinuation = true;
    } else {
      startCol = gridDays.findIndex((d) => isSameDay(d, event.localStart));
      if (startCol === -1) startCol = 0; // fallback
    }

    let endCol = numDays - 1;
    let hasNext = false;
    // localEnd is exclusive, so subtract 1ms to get the inclusive end day
    const endInclusive = new Date(event.localEnd.getTime() - 1);

    if (isAfter(endInclusive, gridEnd)) {
      endCol = numDays - 1;
      hasNext = true;
    } else {
      endCol = gridDays.findIndex((d) => isSameDay(d, endInclusive));
      if (endCol === -1) endCol = numDays - 1; // fallback
    }

    if (endCol < startCol) continue; // safety check

    const colSpan = endCol - startCol + 1;

    // Find first available track
    let trackIndex = 0;
    while (true) {
      if (!tracks[trackIndex]) {
        tracks[trackIndex] = Array(numDays).fill(null);
      }

      let isFree = true;
      for (let i = startCol; i <= endCol; i++) {
        if (tracks[trackIndex][i] !== null) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        for (let i = startCol; i <= endCol; i++) {
          tracks[trackIndex][i] = event;
        }
        break;
      }
      trackIndex++;
    }

    placedEvents.push({
      event,
      colStart: startCol + 1,
      colSpan,
      track: trackIndex,
      isContinuation,
      hasNext,
    });
  }

  return placedEvents;
}

/**
 * Lays out timed events vertically in a single day column, packing overlapping events side-by-side.
 *
 * @param day The specific day this column represents
 * @param events All local events (all-day events are ignored)
 */
export function layoutDayColumns(day: Date, events: LocalEvent[]): PlacedDayEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Filter: not all day, and overlaps with this specific day
  const dayEvents = events.filter((e) => {
    if (e.is_all_day) return false;
    return isBefore(e.localStart, dayEnd) && isAfter(e.localEnd, dayStart);
  });

  // 2. Sort by start time, then end time (duration)
  dayEvents.sort((a, b) => {
    if (a.localStart.getTime() !== b.localStart.getTime()) {
      return a.localStart.getTime() - b.localStart.getTime();
    }
    return a.localEnd.getTime() - b.localEnd.getTime();
  });

  // 3. Group overlapping events
  const groups: LocalEvent[][] = [];
  let currentGroup: LocalEvent[] = [];
  let groupMaxEnd = 0;

  for (const event of dayEvents) {
    if (currentGroup.length === 0) {
      currentGroup.push(event);
      groupMaxEnd = event.localEnd.getTime();
    } else {
      if (event.localStart.getTime() < groupMaxEnd) {
        currentGroup.push(event);
        groupMaxEnd = Math.max(groupMaxEnd, event.localEnd.getTime());
      } else {
        groups.push(currentGroup);
        currentGroup = [event];
        groupMaxEnd = event.localEnd.getTime();
      }
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // 4. Calculate layout for each group
  const placed: PlacedDayEvent[] = [];

  for (const group of groups) {
    // Pack into non-overlapping columns
    const columns: LocalEvent[][] = [];
    for (const event of group) {
      let placedInCol = false;
      for (const col of columns) {
        const lastEventInCol = col[col.length - 1];
        if (event.localStart.getTime() >= lastEventInCol.localEnd.getTime()) {
          col.push(event);
          placedInCol = true;
          break;
        }
      }
      if (!placedInCol) {
        columns.push([event]);
      }
    }

    const numCols = columns.length;
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      for (const event of columns[colIdx]) {
        // Bound event start/end to the physical edges of this day column
        const eStart = event.localStart.getTime() < dayStart.getTime() ? dayStart : event.localStart;
        const eEnd = event.localEnd.getTime() > dayEnd.getTime() ? dayEnd : event.localEnd;

        const startMinutes = eStart.getHours() * 60 + eStart.getMinutes();
        const durationMinutes = (eEnd.getTime() - eStart.getTime()) / 60000;

        placed.push({
          event,
          topPercent: (startMinutes / 1440) * 100,
          heightPercent: (durationMinutes / 1440) * 100,
          leftPercent: (colIdx / numCols) * 100,
          widthPercent: (1 / numCols) * 100,
        });
      }
    }
  }

  return placed;
}
