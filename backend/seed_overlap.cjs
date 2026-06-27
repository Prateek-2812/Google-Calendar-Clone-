const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new Database('./backend/data/calendar.db');

// Get the test user id
const user = db.prepare('SELECT id FROM users WHERE email = ?').get('test@calendar.dev');
if (!user) { console.error('User not found'); process.exit(1); }

// Create events for today (June 27, 2026, or whatever today is)
const todayStr = new Date().toISOString().substring(0, 10); // local date of script runtime
const today = new Date(todayStr + 'T00:00:00Z'); // just as a base

// Event A: 10:00 - 11:30
const aStart = new Date(today.getTime() + 10 * 3600000).toISOString();
const aEnd = new Date(today.getTime() + 11.5 * 3600000).toISOString();

// Event B: 11:00 - 12:00 (overlaps A)
const bStart = new Date(today.getTime() + 11 * 3600000).toISOString();
const bEnd = new Date(today.getTime() + 12 * 3600000).toISOString();

// Event C: 11:15 - 13:00 (overlaps A and B)
const cStart = new Date(today.getTime() + 11.25 * 3600000).toISOString();
const cEnd = new Date(today.getTime() + 13 * 3600000).toISOString();

// Event D: 13:00 - 14:00 (no overlap with above)
const dStart = new Date(today.getTime() + 13 * 3600000).toISOString();
const dEnd = new Date(today.getTime() + 14 * 3600000).toISOString();

const insert = db.prepare(`
  INSERT INTO events (id, user_id, title, start_utc, end_utc, color, is_all_day)
  VALUES (?, ?, ?, ?, ?, ?, 0)
`);

insert.run(uuidv4(), user.id, 'Overlapping Event A', aStart, aEnd, '#4285F4');
insert.run(uuidv4(), user.id, 'Overlapping Event B', bStart, bEnd, '#EA4335');
insert.run(uuidv4(), user.id, 'Overlapping Event C', cStart, cEnd, '#FBBC05');
insert.run(uuidv4(), user.id, 'Standalone Event D', dStart, dEnd, '#34A853');

console.log('Inserted overlapping events');
