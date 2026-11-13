import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getOrCreateUser } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AdminPrincipal {
  type: 'firebase' | 'credentials';
  email: string;
  uid?: string;
}

export interface AuthRequest extends Request {
  admin?: AdminPrincipal;
}

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(process.env.SQL_PASSWORD || 'alpha-moms-coffee-meet-session-key')
    .digest('hex');

const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'subodhjain2007777@gmail.com'
).toLowerCase();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pass@321';

function timingSafeMatch(input: string, expected: string): boolean {
  const inputHash = crypto.createHash('sha256').update(input).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

export function verifyAdminCredentials(
  identifier: string,
  password: string,
): boolean {
  const normalizedId = identifier.trim().toLowerCase();
  const idMatches =
    timingSafeMatch(normalizedId, ADMIN_USERNAME.toLowerCase()) ||
    timingSafeMatch(normalizedId, ADMIN_EMAIL);
  const passwordMatches = timingSafeMatch(password, ADMIN_PASSWORD);
  return idMatches && passwordMatches;
}

export function createAdminSessionToken(identifier: string): string {
  const payload = {
    sub: identifier,
    role: 'admin',
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `adm.${encoded}.${sig}`;
}

export function verifyAdminSessionToken(token: string): AdminPrincipal | null {
  if (!token.startsWith('adm.')) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [, encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  if (!timingSafeMatch(sig, expectedSig)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as { sub: string; role: string; exp: number };
    if (parsed.role !== 'admin' || parsed.exp < Date.now()) {
      return null;
    }
    return { type: 'credentials', email: parsed.sub };
  } catch {
    return null;
  }
}

export function parseCookieToken(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const pairs = raw.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === 'alpha_moms_admin') {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const cookieToken = parseCookieToken(req);
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Sign in required' });
  }

  // 1. Check signed credential session token
  const sessionPrincipal = verifyAdminSessionToken(token);
  if (sessionPrincipal) {
    req.admin = sessionPrincipal;
    return next();
  }

  // 2. Otherwise verify Firebase ID token and allowlist admin email
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    if (!decoded.email_verified || email !== ADMIN_EMAIL) {
      return res
        .status(403)
        .json({ error: 'Forbidden: Only the event organizer can access admin' });
    }
    await getOrCreateUser(decoded.uid, email);
    req.admin = {
      type: 'firebase',
      email,
      uid: decoded.uid,
    };
    return next();
  } catch (error) {
    console.error('Admin token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid session' });
  }
};
