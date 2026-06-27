import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../db/database.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import type { Calendar } from '@calendar/shared';

const router = Router();
router.use(authenticate);

// ----------------------------------------------------------------
// DB row type
// ----------------------------------------------------------------

type CalendarRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_visible: number;
  section: 'my' | 'other';
  created_at: string;
};

function rowToCalendar(row: CalendarRow): Calendar {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    is_visible: row.is_visible === 1,
    section: row.section,
    created_at: row.created_at,
  };
}

// ----------------------------------------------------------------
// Validation schemas
// ----------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color e.g. #1a73e8'),
  section: z.enum(['my', 'other']).default('other'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_visible: z.boolean().optional(),
  section: z.enum(['my', 'other']).optional(),
});

// ----------------------------------------------------------------
// GET /api/calendars
// ----------------------------------------------------------------

router.get('/', (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const rows = db
    .prepare('SELECT * FROM calendars WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId) as CalendarRow[];

  res.json({ success: true, data: rows.map(rowToCalendar) });
});

// ----------------------------------------------------------------
// POST /api/calendars
// ----------------------------------------------------------------

router.post('/', (req: AuthRequest, res: Response): void => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parse.error.message } });
    return;
  }

  const userId = req.user!.id;
  const { name, color, section } = parse.data;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO calendars (id, user_id, name, color, is_visible, section, created_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(id, userId, name, color, section, now);

  const row = db.prepare('SELECT * FROM calendars WHERE id = ?').get(id) as CalendarRow;
  res.status(201).json({ success: true, data: rowToCalendar(row) });
});

// ----------------------------------------------------------------
// PATCH /api/calendars/:id
// ----------------------------------------------------------------

router.patch('/:id', (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = db
    .prepare('SELECT * FROM calendars WHERE id = ? AND user_id = ?')
    .get(id, userId) as CalendarRow | undefined;
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calendar not found.' } });
    return;
  }

  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parse.error.message } });
    return;
  }

  const updates = parse.data;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined)       { fields.push('name = ?');       values.push(updates.name); }
  if (updates.color !== undefined)      { fields.push('color = ?');      values.push(updates.color); }
  if (updates.is_visible !== undefined) { fields.push('is_visible = ?'); values.push(updates.is_visible ? 1 : 0); }
  if (updates.section !== undefined)    { fields.push('section = ?');    values.push(updates.section); }

  if (fields.length === 0) {
    res.json({ success: true, data: rowToCalendar(existing) });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE calendars SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM calendars WHERE id = ?').get(id) as CalendarRow;
  res.json({ success: true, data: rowToCalendar(updated) });
});

// ----------------------------------------------------------------
// DELETE /api/calendars/:id
// ----------------------------------------------------------------

router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = db
    .prepare('SELECT * FROM calendars WHERE id = ? AND user_id = ?')
    .get(id, userId) as CalendarRow | undefined;
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calendar not found.' } });
    return;
  }

  // Prevent deleting the last "my" calendar
  const myCount = db
    .prepare(`SELECT COUNT(*) as cnt FROM calendars WHERE user_id = ? AND section = 'my'`)
    .get(userId) as { cnt: number };
  if (existing.section === 'my' && myCount.cnt <= 1) {
    res.status(400).json({ success: false, error: { code: 'LAST_CALENDAR', message: 'Cannot delete your last calendar.' } });
    return;
  }

  // Nullify calendar_id on associated events before deleting
  db.prepare('UPDATE events SET calendar_id = NULL WHERE calendar_id = ?').run(id);
  db.prepare('DELETE FROM calendars WHERE id = ?').run(id);

  res.json({ success: true, data: null });
});

export default router;
