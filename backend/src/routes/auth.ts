import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../db/database.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { seedDefaultCalendars } from '../db/migrations.js';
import type { User, UserRow, AuthUser } from '@calendar/shared';

const router = Router();

// ----------------------------------------------------------------
// Validation schemas
// ----------------------------------------------------------------

const registerSchema = z.object({
  /** Must be a valid email; stored lower-cased. */
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  /** Minimum 8 characters; bcrypt-hashed before storage. */
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  /** Public display name. */
  name: z.string().min(1, 'Name is required.').max(100).trim(),
  /** IANA timezone string, e.g. "Asia/Kolkata". Defaults to UTC. */
  timezone: z.string().trim().optional().default('UTC'),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required.'),
});

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

/**
 * Signs a JWT containing the user's id, email, and name.
 * Expiry is always 7 days (can be overridden via JWT_EXPIRES_IN env var).
 */
function signToken(userId: string, email: string, name: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set.');

  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

  return jwt.sign(
    { userId, email, name },
    secret,
    { expiresIn, issuer: 'calendar-api' }
  );
}

/**
 * Strips `password_hash` from a DB row and returns the public {@link User} shape.
 * This is the only place where we convert from the internal DB representation.
 */
function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    created_at: row.created_at,
  };
}

// ----------------------------------------------------------------
// POST /api/auth/register
// ----------------------------------------------------------------

/**
 * Creates a new user account.
 *
 * Request body:
 *   { email, password, name, timezone? }
 *
 * Response 201:
 *   { success: true, data: { token, id, email, name, timezone, created_at } }
 *
 * Errors:
 *   400 VALIDATION_ERROR — body fails schema validation
 *   409 EMAIL_TAKEN      — email is already registered
 */
router.post('/register', (req: Request, res: Response): void => {
  const parsed = registerSchema.safeParse(req.body);
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

  const { email, password, name, timezone } = parsed.data;

  // Check uniqueness (email column has UNIQUE + COLLATE NOCASE in DB)
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);

  if (existing) {
    res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
      },
    });
    return;
  }

  // bcrypt cost factor 12 ≈ ~300 ms on modern hardware — good balance for
  // registration (infrequent) vs login (more frequent, still acceptable).
  const passwordHash = bcrypt.hashSync(password, 12);
  const userId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, timezone, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, passwordHash, name, timezone, now);

  // Seed default calendars (Personal, Work, Birthdays) for the new user
  seedDefaultCalendars(userId);

  // Re-fetch to get the exact row the DB stores (including default values)
  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId) as UserRow;

  const token = signToken(userId, email, name);
  const response: AuthUser = { ...toPublicUser(userRow), token };

  res.status(201).json({ success: true, data: response });
});

// ----------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------

/**
 * Authenticates an existing user.
 *
 * Request body:
 *   { email, password }
 *
 * Response 200:
 *   { success: true, data: { token, id, email, name, timezone, created_at } }
 *
 * Errors:
 *   400 VALIDATION_ERROR   — body fails schema validation
 *   401 INVALID_CREDENTIALS — email not found OR password wrong
 *     (deliberately the same error for both to prevent user enumeration)
 */
router.post('/login', (req: Request, res: Response): void => {
  const parsed = loginSchema.safeParse(req.body);
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

  const { email, password } = parsed.data;

  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;

  // Use a constant-time compare even when user doesn't exist to prevent
  // timing-based user enumeration.
  const DUMMY_HASH = '$2a$12$invalidhashusedtopreventtimingattacksXXXXXXXXXXXXXXXXX';
  const hashToCompare = userRow?.password_hash ?? DUMMY_HASH;
  const passwordMatches = bcrypt.compareSync(password, hashToCompare);

  if (!userRow || !passwordMatches) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  const token = signToken(userRow.id, userRow.email, userRow.name);
  const response: AuthUser = { ...toPublicUser(userRow), token };

  res.json({ success: true, data: response });
});

// ----------------------------------------------------------------
// GET /api/auth/me  (protected)
// ----------------------------------------------------------------

/**
 * Returns the currently authenticated user's profile.
 * Requires a valid Bearer token in the Authorization header.
 *
 * Response 200:
 *   { success: true, data: { id, email, name, timezone, created_at } }
 *
 * Errors:
 *   401 MISSING_TOKEN  — no / malformed Authorization header
 *   403 INVALID_TOKEN  — token present but rejected (expired, tampered, etc.)
 *   404 USER_NOT_FOUND — token was valid but the user has since been deleted
 */
router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  // req.user is guaranteed to be set by the authenticate middleware
  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user!.id) as UserRow | undefined;

  if (!userRow) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'The account associated with this token no longer exists.',
      },
    });
    return;
  }

  res.json({ success: true, data: toPublicUser(userRow) });
});

// ----------------------------------------------------------------
// PATCH /api/users/me  (protected) — update own profile
// ----------------------------------------------------------------

const updateProfileSchema = z.object({
  name:     z.string().min(1).max(100).trim().optional(),
  timezone: z.string().trim().optional(),
});

/**
 * Partial-update the authenticated user's profile.
 * Currently supports: name, timezone.
 * Returns the updated User object.
 */
router.patch('/users/me', authenticate, (req: AuthRequest, res: Response): void => {
  const parsed = updateProfileSchema.safeParse(req.body);
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
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name     !== undefined) { updates.push('name = ?');     params.push(data.name); }
  if (data.timezone !== undefined) { updates.push('timezone = ?'); params.push(data.timezone); }

  if (updates.length === 0) {
    // Nothing to update — just return current profile
    const existing = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.user!.id) as UserRow;
    res.json({ success: true, data: toPublicUser(existing) });
    return;
  }

  params.push(req.user!.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user!.id) as UserRow;

  res.json({ success: true, data: toPublicUser(updated) });
});

// ----------------------------------------------------------------
// POST /api/auth/logout  (stateless — client must discard the token)
// ----------------------------------------------------------------

/**
 * Informational endpoint — since JWTs are stateless, logout is handled
 * entirely on the client side by discarding the token.
 * No server state is changed.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ success: true, data: { message: 'Logged out successfully.' } });
});

export default router;
