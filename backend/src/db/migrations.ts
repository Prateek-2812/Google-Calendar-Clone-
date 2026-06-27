import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from './database.js';

// ----------------------------------------------------------------
// Schema DDL
// ----------------------------------------------------------------

/**
 * Runs all DDL migrations to create (or verify) the core tables.
 * Idempotent — safe to call on every startup thanks to IF NOT EXISTS.
 *
 * Tables created:
 *   • users           — registered accounts
 *   • calendars       — user-owned calendar groups
 *   • events          — calendar events (recurring via recurrence_rule JSON)
 *   • event_exceptions — per-occurrence overrides / deletions for recurring events
 */
export function runMigrations(): void {
  db.exec(`
    -- ----------------------------------------------------------------
    -- users
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT    PRIMARY KEY,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      timezone      TEXT    NOT NULL DEFAULT 'UTC',
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- ----------------------------------------------------------------
    -- calendars
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS calendars (
      id         TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#1a73e8',
      is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)),
      section    TEXT    NOT NULL DEFAULT 'my' CHECK(section IN ('my','other')),
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON calendars(user_id);

    -- ----------------------------------------------------------------
    -- events
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS events (
      id               TEXT    PRIMARY KEY,
      user_id          TEXT    NOT NULL
                                 REFERENCES users(id) ON DELETE CASCADE,
      calendar_id      TEXT    REFERENCES calendars(id) ON DELETE SET NULL,

      title            TEXT    NOT NULL,
      description      TEXT,

      -- All timestamps stored as UTC ISO 8601 strings.
      start_utc        TEXT    NOT NULL,
      end_utc          TEXT    NOT NULL,

      -- Hex color string, e.g. '#D50000'.  NULL = use default.
      color            TEXT,

      -- SQLite has no BOOLEAN; 0 = false, 1 = true.
      is_all_day       INTEGER NOT NULL DEFAULT 0
                                 CHECK(is_all_day IN (0, 1)),

      -- RFC-5545-style recurrence rule serialised as a JSON object.
      -- NULL for non-recurring events.
      recurrence_rule  TEXT,

      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_user_id     ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_utc   ON events(start_utc);
    CREATE INDEX IF NOT EXISTS idx_events_end_utc     ON events(end_utc);

    -- ----------------------------------------------------------------
    -- event_exceptions
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS event_exceptions (
      id                 TEXT    PRIMARY KEY,
      event_id           TEXT    NOT NULL
                                   REFERENCES events(id) ON DELETE CASCADE,

      -- Identifies which occurrence is being overridden.
      original_start_utc TEXT    NOT NULL,

      -- New values — all nullable (NULL = not overriding that field).
      new_start_utc      TEXT,
      new_end_utc        TEXT,
      new_title          TEXT,

      -- 1 = this occurrence is removed from the calendar entirely.
      is_deleted         INTEGER NOT NULL DEFAULT 0
                                   CHECK(is_deleted IN (0, 1)),

      -- Composite uniqueness: one exception per occurrence per event.
      UNIQUE(event_id, original_start_utc)
    );

    CREATE INDEX IF NOT EXISTS idx_exc_event_id   ON event_exceptions(event_id);
    CREATE INDEX IF NOT EXISTS idx_exc_orig_start ON event_exceptions(original_start_utc);
  `);

  // Additive migration: add calendar_id to events if it doesn't exist yet
  // (handles existing DBs that were created before this column was added)
  try {
    db.exec(`ALTER TABLE events ADD COLUMN calendar_id TEXT REFERENCES calendars(id) ON DELETE SET NULL`);
    console.log('✅ Migration: added calendar_id column to events table.');
  } catch {
    // Column already exists — safe to ignore
  }

  console.log('✅ Schema migrations applied (users, calendars, events, event_exceptions).');
}

// ----------------------------------------------------------------
// Default calendars helper
// ----------------------------------------------------------------

const DEFAULT_CALENDARS = [
  { name: 'Personal',  color: '#1a73e8', section: 'my' as const },
  { name: 'Work',      color: '#d50000', section: 'my' as const },
  { name: 'Birthdays', color: '#f4511e', section: 'my' as const },
];

/**
 * Seeds the three default calendars for a user and returns
 * the id of the "Personal" calendar.
 */
export function seedDefaultCalendars(userId: string): string {
  const now = new Date().toISOString();
  let personalId = '';

  for (const cal of DEFAULT_CALENDARS) {
    const existing = db
      .prepare('SELECT id FROM calendars WHERE user_id = ? AND name = ?')
      .get(userId, cal.name) as { id: string } | undefined;

    if (existing) {
      if (cal.name === 'Personal') personalId = existing.id;
      continue;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO calendars (id, user_id, name, color, is_visible, section, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, userId, cal.name, cal.color, cal.section, now);

    if (cal.name === 'Personal') personalId = id;
  }

  return personalId;
}

/**
 * Backfills existing events that have no calendar_id with the user's
 * Personal calendar. Safe to run repeatedly — skips already-assigned events.
 */
export function backfillEventCalendars(): void {
  const usersWithEvents = db
    .prepare(`SELECT DISTINCT user_id FROM events WHERE calendar_id IS NULL`)
    .all() as { user_id: string }[];

  for (const { user_id } of usersWithEvents) {
    const personalCal = db
      .prepare(`SELECT id FROM calendars WHERE user_id = ? AND name = 'Personal'`)
      .get(user_id) as { id: string } | undefined;

    if (!personalCal) {
      // Create defaults if they don't exist yet
      seedDefaultCalendars(user_id);
      const newPersonal = db
        .prepare(`SELECT id FROM calendars WHERE user_id = ? AND name = 'Personal'`)
        .get(user_id) as { id: string } | undefined;
      if (newPersonal) {
        db.prepare(`UPDATE events SET calendar_id = ? WHERE user_id = ? AND calendar_id IS NULL`)
          .run(newPersonal.id, user_id);
      }
    } else {
      db.prepare(`UPDATE events SET calendar_id = ? WHERE user_id = ? AND calendar_id IS NULL`)
        .run(personalCal.id, user_id);
    }
  }

  if (usersWithEvents.length > 0) {
    console.log(`✅ Backfilled calendar_id for events of ${usersWithEvents.length} user(s).`);
  }
}

// ----------------------------------------------------------------
// Seed data
// ----------------------------------------------------------------

/**
 * Inserts a test user with default calendars if no users exist yet.
 * Credentials:  test@calendar.dev / password123
 */
export function seedTestUser(): void {
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get('test@calendar.dev') as { id: string } | undefined;

  if (existing) {
    console.log('ℹ️  Test user already exists — skipping seed.');
    return;
  }

  const userId = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('password123', 12);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, timezone, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 'test@calendar.dev', passwordHash, 'Test User', 'UTC', now);

  // Seed default calendars
  const personalId = seedDefaultCalendars(userId);

  // Seed one upcoming event assigned to the Personal calendar
  const eventId = uuidv4();
  const eventStart = new Date();
  eventStart.setUTCHours(9, 0, 0, 0);
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO events
      (id, user_id, calendar_id, title, description, start_utc, end_utc,
       color, is_all_day, recurrence_rule, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(
    eventId,
    userId,
    personalId,
    'Welcome to Calendar!',
    'This is your first seeded event. Feel free to delete it.',
    eventStart.toISOString(),
    eventEnd.toISOString(),
    '#1a73e8',
    now,
    now
  );

  console.log(`🌱 Seeded test user (test@calendar.dev / password123) with id ${userId}.`);
  console.log(`🌱 Seeded welcome event with id ${eventId}.`);
}

// ----------------------------------------------------------------
// Combined entry-point
// ----------------------------------------------------------------

export function initDatabase(): void {
  runMigrations();
  backfillEventCalendars();
  seedTestUser();
}

// Allow running directly:  tsx src/db/migrations.ts
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  import('dotenv').then(({ config }) => {
    config();
    initDatabase();
    console.log('✅ Done.');
    process.exit(0);
  });
}
