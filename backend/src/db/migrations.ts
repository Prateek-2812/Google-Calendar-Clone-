import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from './database.js';

// ----------------------------------------------------------------
// Schema DDL
// ----------------------------------------------------------------

/**
 * Runs all DDL migrations to create (or verify) the three core tables.
 * Idempotent — safe to call on every startup thanks to IF NOT EXISTS.
 *
 * Tables created:
 *   • users           — registered accounts
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
    -- events
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS events (
      id               TEXT    PRIMARY KEY,
      user_id          TEXT    NOT NULL
                                 REFERENCES users(id) ON DELETE CASCADE,

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

    CREATE INDEX IF NOT EXISTS idx_events_user_id   ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_utc ON events(start_utc);
    CREATE INDEX IF NOT EXISTS idx_events_end_utc   ON events(end_utc);

    -- ----------------------------------------------------------------
    -- event_exceptions
    -- Stores per-occurrence overrides for recurring events.
    -- Each row identifies one occurrence (by original_start_utc) and
    -- carries the new values that replace it, or marks it as deleted.
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

  console.log('✅ Schema migrations applied (users, events, event_exceptions).');
}

// ----------------------------------------------------------------
// Seed data
// ----------------------------------------------------------------

/**
 * Inserts a test user if no users exist yet.
 * Credentials:  test@calendar.dev / password123
 *
 * The seed is idempotent — running it twice will not create duplicates
 * because it checks for the email before inserting.
 */
export function seedTestUser(): void {
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get('test@calendar.dev');

  if (existing) {
    console.log('ℹ️  Test user already exists — skipping seed.');
    return;
  }

  const userId = uuidv4();
  const now = new Date().toISOString(); // e.g. "2024-03-15T07:30:00.000Z"
  const passwordHash = bcrypt.hashSync('password123', 12);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, timezone, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 'test@calendar.dev', passwordHash, 'Test User', 'UTC', now);

  // Seed one upcoming event for the test user so the calendar is not empty.
  const eventId = uuidv4();
  const eventStart = new Date();
  eventStart.setUTCHours(9, 0, 0, 0);                        // today @ 09:00 UTC
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // +1 hour

  db.prepare(`
    INSERT INTO events
      (id, user_id, title, description, start_utc, end_utc,
       color, is_all_day, recurrence_rule, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(
    eventId,
    userId,
    'Welcome to Calendar!',
    'This is your first seeded event. Feel free to delete it.',
    eventStart.toISOString(),
    eventEnd.toISOString(),
    '#4285F4',
    now,
    now
  );

  console.log(`🌱 Seeded test user (test@calendar.dev / password123) with id ${userId}.`);
  console.log(`🌱 Seeded welcome event with id ${eventId}.`);
}

// ----------------------------------------------------------------
// Combined entry-point
// ----------------------------------------------------------------

/**
 * Runs migrations then seeds test data.
 * Called by the Express server on startup (src/index.ts).
 */
export function initDatabase(): void {
  runMigrations();
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
