// ============================================================
// Shared TypeScript Interfaces — @calendar/shared
// Used by both frontend and backend packages.
// All timestamps are UTC ISO 8601 strings (e.g. "2024-03-15T09:00:00.000Z").
// ============================================================

// ----------------------------------------------------------------
// Calendar
// ----------------------------------------------------------------

/** Which section of the sidebar this calendar appears in. */
export type CalendarSection = 'my' | 'other';

/**
 * A calendar that groups events.
 * DB columns: id, user_id, name, color, is_visible, section, created_at
 */
export interface Calendar {
  id: string;
  user_id: string;
  name: string;
  /** Hex color e.g. "#1a73e8" */
  color: string;
  is_visible: boolean;
  section: CalendarSection;
  created_at: string;
}

export type CreateCalendarRequest = {
  name: string;
  color: string;
  section?: CalendarSection;
};

export type UpdateCalendarRequest = Partial<{
  name: string;
  color: string;
  is_visible: boolean;
  section: CalendarSection;
}>;

// ----------------------------------------------------------------
// Recurrence
// ----------------------------------------------------------------

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/**
 * Recurrence rule stored as JSON in the events.recurrence_rule column.
 *
 * Format: { freq: "DAILY"|"WEEKLY"|"MONTHLY", interval: number, until?: ISO }
 */
export interface RecurrenceRule {
  /**
   * How often the event repeats.
   * One of: "DAILY", "WEEKLY", "MONTHLY", "YEARLY"
   */
  freq: RecurrenceFreq;

  /**
   * Interval between occurrences (default: 1).
   * e.g. freq=WEEKLY, interval=2 → every two weeks.
   */
  interval?: number;

  /**
   * Repeat until this UTC ISO 8601 datetime string (inclusive).
   * If omitted, the series repeats indefinitely (or up to a server cap).
   */
  until?: string;

  /**
   * Maximum number of occurrences.
   * Takes precedence over `until` when both are set.
   */
  count?: number;
}

// ----------------------------------------------------------------
// User
// Mirrors the `users` table.
// ----------------------------------------------------------------

/**
 * A registered application user.
 *
 * DB columns:
 *   id, email, password_hash, name, timezone, created_at
 *
 * `password_hash` is intentionally omitted here — never exposed to clients.
 */
export interface User {
  /** UUID primary key. */
  id: string;

  /** Unique email address. */
  email: string;

  /** Display name / full name. */
  name: string;

  /**
   * IANA timezone identifier, e.g. "Asia/Kolkata", "America/New_York".
   * Used for rendering times in the user's local zone.
   */
  timezone: string;

  /** UTC ISO 8601 string — when the row was inserted. */
  created_at: string;
}

/**
 * The raw DB row for a user (includes password_hash).
 * Used only inside the backend — never sent to the client.
 */
export interface UserRow extends User {
  password_hash: string;
}

/**
 * Auth token payload returned from /auth/register and /auth/login.
 */
export interface AuthUser extends User {
  token: string;
}

/** Login request body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Register request body. */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  timezone?: string;
}

// ----------------------------------------------------------------
// Event
// Mirrors the `events` table.
// ----------------------------------------------------------------

/**
 * A calendar event.
 *
 * DB columns:
 *   id, user_id, title, description, start_utc, end_utc,
 *   color, is_all_day, recurrence_rule (JSON), created_at, updated_at
 */
export interface Event {
  /** UUID primary key. */
  id: string;

  /** FK → users.id. */
  user_id: string;

  /** Event title / summary. */
  title: string;

  /** Optional longer description. */
  description?: string;

  /**
   * Start time stored in UTC.
   * ISO 8601 string, e.g. "2024-03-15T09:00:00.000Z".
   * For all-day events this is a date string "2024-03-15".
   */
  start_utc: string;

  /**
   * End time stored in UTC (exclusive — end of last minute).
   * ISO 8601 string, e.g. "2024-03-15T10:00:00.000Z".
   * For all-day events this is the day *after* the last day.
   */
  end_utc: string;

  /**
   * Hex color for the event chip, e.g. "#D50000".
   * Falls back to calendar/user default when absent.
   */
  color?: string;

  /**
   * True when the event spans full calendar days.
   * Stored as INTEGER 0/1 in SQLite; mapped to boolean here.
   */
  is_all_day: boolean;

  /**
   * Serialised {@link RecurrenceRule} JSON stored in the DB column.
   * `undefined` for non-recurring events.
   */
  recurrence_rule?: RecurrenceRule;

  /** FK → calendars.id. Optional — null for legacy events. */
  calendar_id?: string;

  /** UTC ISO 8601 — when the row was first inserted. */
  created_at: string;

  /** UTC ISO 8601 — when the row was last modified. */
  updated_at: string;
}

/** Payload accepted by POST /api/events. */
export type CreateEventRequest = Omit<Event, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

/** Payload accepted by PUT /api/events/:id (full replacement). */
export type UpdateEventRequest = CreateEventRequest;

/** Payload accepted by PATCH /api/events/:id (partial update). */
export type PatchEventRequest = Partial<CreateEventRequest>;

/**
 * A single expanded occurrence of a (possibly recurring) event.
 * Returned by GET /api/events — recurring masters are expanded into
 * one EventInstance per occurrence within the queried range.
 */
export interface EventInstance {
  /**
   * Stable ID for this occurrence.
   * Format: "<master_event_id>_<original_start_utc>" for recurring instances,
   * or just "<event_id>" for non-recurring events.
   */
  instance_id: string;

  /** The master event's UUID (same as instance_id for non-recurring). */
  event_id: string;

  /** The original scheduled start of this occurrence (UTC ISO 8601). */
  original_start_utc: string;

  /** Effective start — may differ from original_start_utc if an exception overrides it. */
  start_utc: string;

  /** Effective end. */
  end_utc: string;

  /** Effective title (exception may override the master's title). */
  title: string;

  description?: string;
  color?: string;
  is_all_day: boolean;
  recurrence_rule?: RecurrenceRule;

  /** FK → calendars.id. Optional — null for legacy events. */
  calendar_id?: string;

  /** True when this occurrence was modified by an event_exceptions row. */
  has_exception: boolean;

  /** True when this occurrence is a deleted exception (should be hidden). */
  is_deleted: boolean;

  user_id: string;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------
// EventException
// Mirrors the `event_exceptions` table.
// Represents a single overridden or deleted occurrence in a series.
// ----------------------------------------------------------------

/**
 * An exception to one occurrence of a recurring event.
 *
 * DB columns:
 *   id, event_id, original_start_utc,
 *   new_start_utc, new_end_utc, new_title, is_deleted
 *
 * When `is_deleted` is true, that occurrence is hidden from the calendar.
 * When it is false, the occurrence uses the `new_*` fields instead of the
 * values computed from the recurrence rule.
 */
export interface EventException {
  /** UUID primary key. */
  id: string;

  /** FK → events.id (the master recurring event). */
  event_id: string;

  /**
   * The original computed start time of this occurrence (UTC ISO 8601).
   * Used to identify which occurrence is being overridden.
   */
  original_start_utc: string;

  /**
   * Overridden start time (UTC ISO 8601).
   * `null` when the occurrence is only being deleted (`is_deleted = true`)
   * and no new time is set.
   */
  new_start_utc?: string;

  /**
   * Overridden end time (UTC ISO 8601).
   * `null` when the occurrence is only being deleted.
   */
  new_end_utc?: string;

  /**
   * Overridden title.
   * `undefined` means "use the master event title".
   */
  new_title?: string;

  /**
   * When true, this occurrence is removed from the calendar entirely.
   * Stored as INTEGER 0/1 in SQLite.
   */
  is_deleted: boolean;
}

/** Payload for creating an exception via POST /api/events/:id/exceptions. */
export type CreateEventExceptionRequest = Omit<EventException, 'id'>;

/** Payload for partially updating an exception via PATCH /api/events/:id/exception/:time. */
export type PatchEventExceptionRequest = Partial<CreateEventExceptionRequest>;

// ----------------------------------------------------------------
// API response shapes
// ----------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ----------------------------------------------------------------
// Query params
// ----------------------------------------------------------------

export interface EventsQueryParams {
  /** Filter to a specific user (inferred from JWT in the backend). */
  user_id?: string;
  /** UTC ISO 8601 — start of the range (inclusive). */
  start: string;
  /** UTC ISO 8601 — end of the range (exclusive). */
  end: string;
  /** Include soft-deleted occurrences? Default false. */
  showDeleted?: boolean;
}
