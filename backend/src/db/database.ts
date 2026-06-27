import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve DATABASE_URL relative to the backend root, not the src/ dir
const dbUrl = process.env.DATABASE_URL ?? './data/calendar.db';
const dbPath = path.isAbsolute(dbUrl)
  ? dbUrl
  : path.resolve(__dirname, '../../', dbUrl);

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
