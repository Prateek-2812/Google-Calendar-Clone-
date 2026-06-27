import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@calendar/shared';

const { JsonWebTokenError, TokenExpiredError, NotBeforeError } = jwt;

// ----------------------------------------------------------------
// Augmented request type
// ----------------------------------------------------------------

/**
 * Express Request augmented with the authenticated user's identity.
 * Populated by the `authenticate` middleware after verifying the JWT.
 */
export interface AuthRequest extends Request {
  user?: Pick<User, 'id' | 'email' | 'name'>;
}

// ----------------------------------------------------------------
// Internal JWT payload shape
// ----------------------------------------------------------------

interface JwtPayload {
  /** User's UUID from the `users` table. */
  userId: string;
  email: string;
  name: string;
  /** Issued-at timestamp (added automatically by jsonwebtoken). */
  iat?: number;
  /** Expiry timestamp (added automatically by jsonwebtoken). */
  exp?: number;
}

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------

/**
 * `authenticate` — JWT Bearer token guard.
 *
 * Behaviour:
 *   • 401 UNAUTHORIZED  — Authorization header absent or not "Bearer <token>"
 *   • 403 FORBIDDEN     — Token present but invalid (bad signature, expired, malformed)
 *   • Calls next()      — Token is valid; attaches `req.user`
 *
 * Token lifetime is controlled by JWT_SECRET / JWT_EXPIRES_IN env vars
 * (set in /backend/.env).  Default expiry: 7 days.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // ── 1. Header must exist and start with "Bearer " ──────────────
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization header is required (Bearer <token>).',
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  // Guard against an empty string after "Bearer "
  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Bearer token must not be empty.',
      },
    });
    return;
  }

  // ── 2. JWT_SECRET must be configured ───────────────────────────
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Configuration error — 500, not a client mistake
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_MISCONFIGURATION',
        message: 'Authentication service is not configured correctly.',
      },
    });
    return;
  }

  // ── 3. Verify the token ─────────────────────────────────────────
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
    };

    next();
  } catch (err) {
    // Distinguish between an *expired* token and a structurally *invalid* one.
    // Both are "token present but wrong", so both are 403 FORBIDDEN.
    //
    // Why 403 and not 401?
    //   • 401 = "no credentials provided" → client should log in.
    //   • 403 = "credentials were provided but rejected" → client has a bad token.
    //
    if (err instanceof TokenExpiredError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          details: { expiredAt: err.expiredAt },
        },
      });
      return;
    }

    if (err instanceof NotBeforeError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_YET_VALID',
          message: 'Token is not yet valid.',
          details: { validAt: err.date },
        },
      });
      return;
    }

    // JsonWebTokenError covers: invalid signature, malformed, wrong algorithm, etc.
    if (err instanceof JsonWebTokenError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is invalid or has been tampered with.',
        },
      });
      return;
    }

    // Unexpected error — surface as 500
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'An unexpected authentication error occurred.',
      },
    });
  }
}
