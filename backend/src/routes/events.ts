import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../db/database.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { expandRecurring, wrapSingleEvent } from '../lib/recurrence.js';
import type { Event, EventException, EventInstance } from '@calendar/shared';

const router = Router();

// Every route in this file requires a valid JWT.
router.use(authenticate);

// ----------------------------------------------------------------
// Validation schemas
// ----------------------------------------------------------------

/**
 * Spec recurrence format: { freq, interval, until? }
 * Stored verbatim as JSON in events.recurrence_rule.
 */
const recurrenceRuleSchema = z
  .object({
    freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: z.number().int().positive().default(1),
    until: z.string().datetime({ offset: true }).optional(),
    count: z.number().int().positive().optional(),
  })
  .optional();

const eventBodyBaseSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(500),
  description: z.string().max(5000).optional(),
  start_utc: z.string().datetime({ offset: true }),
  end_utc: z.string().datetime({ offset: true }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a hex string e.g. #D50000')
    .optional(),
  is_all_day: z.boolean().default(false),
  recurrence_rule: recurrenceRuleSchema,
  calendar_id: z.string().uuid().optional(),
});

const eventBodySchema = eventBodyBaseSchema.refine((d) => new Date(d.start_utc) < new Date(d.end_utc), {
  message: 'start_utc must be before end_utc.',
  path: ['end_utc'],
});

const querySchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

// ----------------------------------------------------------------
// Internal DB row types
// ----------------------------------------------------------------

type EventRow = {
  id: string;
  user_id: string;
  calendar_id: string | null;
  title: string;
  description: string | null;
  start_utc: string;
  end_utc: string;
  color: string | null;
  is_all_day: number;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
};

type ExceptionRow = {
  id: string;
  original_start_utc: string;
  new_start_utc: string | null;
  new_end_utc: string | null;
  new_title: string | null;
  is_deleted: number;
};

// ----------------------------------------------------------------
// Row → interface mappers
// ----------------------------------------------------------------

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    user_id: row.user_id,
    calendar_id: row.calendar_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    start_utc: row.start_utc,
    end_utc: row.end_utc,
    color: row.color ?? undefined,
    is_all_day: Boolean(row.is_all_day),
    recurrence_rule: row.recurrence_rule
      ? (JSON.parse(row.recurrence_rule) as Event['recurrence_rule'])
      : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToException(row: Record<string, unknown>): EventException {
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    original_start_utc: row.original_start_utc as string,
    new_start_utc: (row.new_start_utc as string | null) ?? undefined,
    new_end_utc: (row.new_end_utc as string | null) ?? undefined,
    new_title: (row.new_title as string | null) ?? undefined,
    is_deleted: Boolean(row.is_deleted),
  };
}

// ----------------------------------------------------------------
// Overlap detection helper
// ----------------------------------------------------------------

/**
 * Returns the first event that overlaps [startUtc, endUtc) for this user,
 * excluding `excludeId` (used during updates to ignore self).
 *
 * Two intervals [a,b) and [c,d) overlap iff a < d && b > c.
 */
function findOverlap(
  userId: string,
  startUtc: string,
  endUtc: string,
  excludeId?: string
): EventRow | undefined {
  const sql = excludeId
    ? `SELECT * FROM events
       WHERE user_id = ?
         AND id != ?
         AND start_utc < ?
         AND end_utc   > ?
       LIMIT 1`
    : `SELECT * FROM events
       WHERE user_id = ?
         AND start_utc < ?
         AND end_utc   > ?
       LIMIT 1`;

  const params = excludeId
    ? [userId, excludeId, endUtc, startUtc]
    : [userId, endUtc, startUtc];

  return db.prepare(sql).get(...params) as EventRow | undefined;
}

// ----------------------------------------------------------------
// GET /api/events/search?q=query
// ----------------------------------------------------------------
//
// Full-text search on title + description (LIKE). Returns up to 20
// matching events as EventInstance objects (non-recurring only for
// simplicity — recurring masters also searched by title/desc).

router.get('/search', (req: AuthRequest, res: Response): void => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 1) {
    res.json({ success: true, data: [] });
    return;
  }

  const like = `%${q}%`;
  const rows = db
    .prepare(`
      SELECT * FROM events
      WHERE user_id = ?
        AND (title LIKE ? OR description LIKE ?)
      ORDER BY start_utc DESC
      LIMIT 20
    `)
    .all(req.user!.id, like, like) as EventRow[];

  const instances: EventInstance[] = rows.map((row) => wrapSingleEvent(rowToEvent(row)));
  res.json({ success: true, data: instances });
});

// ----------------------------------------------------------------
// GET /api/events?start=ISO&end=ISO
// ----------------------------------------------------------------
//
// Returns all EventInstance objects (recurring events expanded) whose
// effective time overlaps [start, end).
// Non-recurring events are wrapped as single instances.
// Recurring events are expanded server-side within the range.

router.get('/', (req: AuthRequest, res: Response): void => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query params start and end (ISO 8601) are required.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const { start, end } = parsed.data;
  const rangeStartMs = new Date(start).getTime();
  const rangeEndMs = new Date(end).getTime();

  if (rangeStartMs >= rangeEndMs) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_RANGE', message: 'start must be before end.' },
    });
    return;
  }

  // Fetch candidates:
  //   • non-recurring: normal overlap filter
  //   • recurring (recurrence_rule IS NOT NULL): start_utc <= range_end,
  //     because occurrences may extend into the range even if master starts before it.
  const rows = db
    .prepare(`
      SELECT * FROM events
      WHERE user_id = ?
        AND (
          -- Non-recurring: overlaps the range
          (recurrence_rule IS NULL AND start_utc < ? AND end_utc > ?)
          OR
          -- Recurring: master starts at or before range ends (occurrences may fall inside)
          (recurrence_rule IS NOT NULL AND start_utc <= ?)
        )
      ORDER BY start_utc ASC
    `)
    .all(req.user!.id, end, start, end) as EventRow[];

  const instances: EventInstance[] = [];

  for (const row of rows) {
    const event = rowToEvent(row);

    if (!event.recurrence_rule) {
      // Plain event — wrap as a single instance
      instances.push(wrapSingleEvent(event));
    } else {
      // Load exceptions for this series keyed by original_start_utc
      const excRows = db
        .prepare(
          'SELECT * FROM event_exceptions WHERE event_id = ?'
        )
        .all(event.id) as ExceptionRow[];

      const exceptionMap: Record<
        string,
        { new_start_utc: string | null; new_end_utc: string | null; new_title: string | null; is_deleted: number }
      > = {};
      for (const exc of excRows) {
        exceptionMap[exc.original_start_utc] = exc;
      }

      const expanded = expandRecurring(event, rangeStartMs, rangeEndMs, exceptionMap);
      instances.push(...expanded);
    }
  }

  // Sort final list by effective start_utc
  instances.sort((a, b) => a.start_utc.localeCompare(b.start_utc));

  res.json({ success: true, data: instances });
});

// ----------------------------------------------------------------
// GET /api/events/:id  — fetch a single master event
// ----------------------------------------------------------------

router.get('/:id', (req: AuthRequest, res: Response): void => {
  const row = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as EventRow | undefined;

  if (!row) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found.' },
    });
    return;
  }

  res.json({ success: true, data: rowToEvent(row) });
});

// ----------------------------------------------------------------
// POST /api/events
// ----------------------------------------------------------------
//
// Validates:
//   • start_utc < end_utc  (enforced by Zod refine)
//   • No overlapping event exists for this user → 409 if so

router.post('/', (req: AuthRequest, res: Response): void => {
  const parsed = eventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const data = parsed.data;

  // Overlap check (skip for all-day events — they don't "overlap" in the same sense)
  if (!data.is_all_day) {
    const conflict = findOverlap(req.user!.id, data.start_utc, data.end_utc);
    if (conflict) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EVENT_CONFLICT',
          message: 'This event overlaps with an existing event.',
          conflictingEvent: rowToEvent(conflict),
        },
      });
      return;
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  // Resolve calendar_id: use provided, or fall back to user's Personal calendar
  let calendarId: string | null = data.calendar_id ?? null;
  if (!calendarId) {
    const personal = db
      .prepare(`SELECT id FROM calendars WHERE user_id = ? AND name = 'Personal' LIMIT 1`)
      .get(req.user!.id) as { id: string } | undefined;
    calendarId = personal?.id ?? null;
  }

  db.prepare(`
    INSERT INTO events
      (id, user_id, calendar_id, title, description, start_utc, end_utc,
       color, is_all_day, recurrence_rule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.id,
    calendarId,
    data.title,
    data.description ?? null,
    data.start_utc,
    data.end_utc,
    data.color ?? null,
    data.is_all_day ? 1 : 0,
    data.recurrence_rule ? JSON.stringify(data.recurrence_rule) : null,
    now,
    now
  );

  const created = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id) as EventRow;

  res.status(201).json({ success: true, data: rowToEvent(created) });
});

// ----------------------------------------------------------------
// PUT /api/events/:id  — full replacement
// ----------------------------------------------------------------
//
// All fields are required (full update semantics, not partial patch).
// Re-validates start < end and overlap (excluding self).

router.put('/:id', (req: AuthRequest, res: Response): void => {
  const existing = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as EventRow | undefined;

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found.' },
    });
    return;
  }

  const parsed = eventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const data = parsed.data;

  // Overlap check — exclude self
  if (!data.is_all_day) {
    const conflict = findOverlap(req.user!.id, data.start_utc, data.end_utc, req.params.id);
    if (conflict) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EVENT_CONFLICT',
          message: 'The updated event overlaps with an existing event.',
          conflictingEvent: rowToEvent(conflict),
        },
      });
      return;
    }
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE events SET
      title            = ?,
      description      = ?,
      start_utc        = ?,
      end_utc          = ?,
      color            = ?,
      is_all_day       = ?,
      recurrence_rule  = ?,
      calendar_id      = ?,
      updated_at       = ?
    WHERE id = ?
  `).run(
    data.title,
    data.description ?? null,
    data.start_utc,
    data.end_utc,
    data.color ?? null,
    data.is_all_day ? 1 : 0,
    data.recurrence_rule ? JSON.stringify(data.recurrence_rule) : null,
    data.calendar_id ?? (existing as EventRow).calendar_id ?? null,
    now,
    req.params.id
  );

  const updated = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(req.params.id) as EventRow;

  res.json({ success: true, data: rowToEvent(updated) });
});

// ----------------------------------------------------------------
// PATCH /api/events/:id  — partial update
// ----------------------------------------------------------------

const eventPatchSchema = eventBodyBaseSchema.partial();

router.patch('/:id', (req: AuthRequest, res: Response): void => {
  const existing = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as EventRow | undefined;

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found.' },
    });
    return;
  }

  const parsed = eventPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const data = parsed.data;
  
  // Merge data to check overlaps and start < end constraints
  const start_utc = data.start_utc ?? existing.start_utc;
  const end_utc = data.end_utc ?? existing.end_utc;
  const is_all_day = data.is_all_day ?? Boolean(existing.is_all_day);
  
  if (new Date(start_utc) >= new Date(end_utc)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'start_utc must be before end_utc.',
      },
    });
    return;
  }

  if (!is_all_day && (data.start_utc || data.end_utc || data.is_all_day !== undefined)) {
    const conflict = findOverlap(req.user!.id, start_utc, end_utc, req.params.id);
    if (conflict) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EVENT_CONFLICT',
          message: 'The updated event overlaps with an existing event.',
          conflictingEvent: rowToEvent(conflict),
        },
      });
      return;
    }
  }

  const updates: string[] = [];
  const params: any[] = [];
  
  if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.start_utc !== undefined) { updates.push('start_utc = ?'); params.push(data.start_utc); }
  if (data.end_utc !== undefined) { updates.push('end_utc = ?'); params.push(data.end_utc); }
  if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color); }
  if (data.is_all_day !== undefined) { updates.push('is_all_day = ?'); params.push(data.is_all_day ? 1 : 0); }
  if (data.recurrence_rule !== undefined) { updates.push('recurrence_rule = ?'); params.push(data.recurrence_rule ? JSON.stringify(data.recurrence_rule) : null); }
  
  if (updates.length > 0) {
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as EventRow;
  res.json({ success: true, data: rowToEvent(updated) });
});

// ----------------------------------------------------------------
// DELETE /api/events/:id
// ----------------------------------------------------------------

router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const existing = db
    .prepare('SELECT id FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found.' },
    });
    return;
  }

  // Cascade deletes event_exceptions automatically (FK ON DELETE CASCADE).
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);

  res.json({ success: true, data: { message: 'Event deleted.' } });
});

// ----------------------------------------------------------------
// PUT /api/events/:id/exception/:originalStartUtc
// ----------------------------------------------------------------
//
// Create or update an event_exceptions row for one occurrence of a
// recurring event.  The :originalStartUtc param identifies the
// occurrence (must be URL-encoded).
//
// Body: { new_start_utc?, new_end_utc?, new_title?, is_deleted? }
// If is_deleted = true, the occurrence is hidden from the calendar.

const exceptionBodySchema = z.object({
  new_start_utc: z.string().datetime({ offset: true }).optional(),
  new_end_utc: z.string().datetime({ offset: true }).optional(),
  new_title: z.string().min(1).max(500).optional(),
  is_deleted: z.boolean().default(false),
});

router.put(
  '/:id/exception/:originalStartUtc',
  (req: AuthRequest, res: Response): void => {
    // 1. Verify the master event exists and belongs to this user
    const master = db
      .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as EventRow | undefined;

    if (!master) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recurring event not found.' },
      });
      return;
    }

    if (!master.recurrence_rule) {
      res.status(422).json({
        success: false,
        error: {
          code: 'NOT_RECURRING',
          message: 'Exceptions can only be set on recurring events.',
        },
      });
      return;
    }

    // 2. Decode and validate the originalStartUtc path param
    let originalStartUtc: string;
    try {
      originalStartUtc = decodeURIComponent(req.params.originalStartUtc);
      // Validate it's a parseable date
      if (isNaN(new Date(originalStartUtc).getTime())) throw new Error();
    } catch {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAM',
          message: 'originalStartUtc must be a valid URL-encoded ISO 8601 datetime.',
        },
      });
      return;
    }

    // 3. Validate body
    const parsed = exceptionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const data = parsed.data;

    // Validate new_start < new_end if both are provided
    if (data.new_start_utc && data.new_end_utc) {
      if (new Date(data.new_start_utc) >= new Date(data.new_end_utc)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'new_start_utc must be before new_end_utc.',
          },
        });
        return;
      }
    }

    // 4. Upsert the exception row
    //    UNIQUE(event_id, original_start_utc) ensures one exception per occurrence.
    const excId = uuidv4();

    db.prepare(`
      INSERT INTO event_exceptions
        (id, event_id, original_start_utc, new_start_utc, new_end_utc, new_title, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, original_start_utc) DO UPDATE SET
        new_start_utc = excluded.new_start_utc,
        new_end_utc   = excluded.new_end_utc,
        new_title     = excluded.new_title,
        is_deleted    = excluded.is_deleted
    `).run(
      excId,
      req.params.id,
      originalStartUtc,
      data.new_start_utc ?? null,
      data.new_end_utc ?? null,
      data.new_title ?? null,
      data.is_deleted ? 1 : 0
    );

    const result = db
      .prepare(
        'SELECT * FROM event_exceptions WHERE event_id = ? AND original_start_utc = ?'
      )
      .get(req.params.id, originalStartUtc) as Record<string, unknown>;

    res.json({ success: true, data: rowToException(result) });
  }
);

// ----------------------------------------------------------------
// PATCH /api/events/:id/exception/:originalStartUtc
// ----------------------------------------------------------------

const exceptionPatchSchema = exceptionBodySchema.partial();

router.patch(
  '/:id/exception/:originalStartUtc',
  (req: AuthRequest, res: Response): void => {
    // 1. Verify the master event exists and belongs to this user
    const master = db
      .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as EventRow | undefined;

    if (!master) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recurring event not found.' },
      });
      return;
    }

    if (!master.recurrence_rule) {
      res.status(422).json({
        success: false,
        error: {
          code: 'NOT_RECURRING',
          message: 'Exceptions can only be set on recurring events.',
        },
      });
      return;
    }

    let originalStartUtc: string;
    try {
      originalStartUtc = decodeURIComponent(req.params.originalStartUtc);
      if (isNaN(new Date(originalStartUtc).getTime())) throw new Error();
    } catch {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAM',
          message: 'originalStartUtc must be a valid URL-encoded ISO 8601 datetime.',
        },
      });
      return;
    }

    const parsed = exceptionPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const data = parsed.data;

    // Fetch existing exception if any
    const existing = db
      .prepare('SELECT * FROM event_exceptions WHERE event_id = ? AND original_start_utc = ?')
      .get(req.params.id, originalStartUtc) as ExceptionRow | undefined;
      
    // If no existing exception, we need to create one using partial data + master data
    const new_start_utc = data.new_start_utc !== undefined ? data.new_start_utc : (existing?.new_start_utc ?? null);
    const new_end_utc = data.new_end_utc !== undefined ? data.new_end_utc : (existing?.new_end_utc ?? null);
    
    if (new_start_utc && new_end_utc && new Date(new_start_utc) >= new Date(new_end_utc)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'new_start_utc must be before new_end_utc.',
        },
      });
      return;
    }
    
    const new_title = data.new_title !== undefined ? data.new_title : (existing?.new_title ?? null);
    const is_deleted = data.is_deleted !== undefined ? data.is_deleted : (existing?.is_deleted ? true : false);

    const excId = existing ? existing.id : uuidv4();

    db.prepare(`
      INSERT INTO event_exceptions
        (id, event_id, original_start_utc, new_start_utc, new_end_utc, new_title, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, original_start_utc) DO UPDATE SET
        new_start_utc = excluded.new_start_utc,
        new_end_utc   = excluded.new_end_utc,
        new_title     = excluded.new_title,
        is_deleted    = excluded.is_deleted
    `).run(
      excId,
      req.params.id,
      originalStartUtc,
      new_start_utc ?? null,
      new_end_utc ?? null,
      new_title ?? null,
      is_deleted ? 1 : 0
    );

    const result = db
      .prepare('SELECT * FROM event_exceptions WHERE event_id = ? AND original_start_utc = ?')
      .get(req.params.id, originalStartUtc) as Record<string, unknown>;

    res.json({ success: true, data: rowToException(result) });
  }
);

export default router;
