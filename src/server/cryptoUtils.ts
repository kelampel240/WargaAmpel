import crypto from 'node:crypto';
import { formatTicketNumber } from '../shared/siwargaLogic';
import { PublicUserSession } from '../shared/types';

const SESSION_SECRET =
  process.env.SIWARGA_SESSION_SECRET ||
  crypto.createHash('sha256').update('SIWARGA_AMPEL_DEFAULT_SECRET_KEY_2026').digest('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derivedHex = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  const a = Buffer.from(originalHex, 'hex');
  const b = Buffer.from(derivedHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashSensitiveId(raw: string): string {
  return crypto.createHash('sha256').update(`SIWARGA_NIK:${raw.trim()}`).digest('hex');
}

export interface SignedSessionPayload {
  user: PublicUserSession;
  exp: number;
}

export function signSessionToken(user: PublicUserSession, ttlMs = 12 * 60 * 60 * 1000): string {
  const payload: SignedSessionPayload = {
    user,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): PublicUserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    return payload.user;
  } catch {
    return null;
  }
}

/**
 * Concurrency-safe async lock simulating Google Apps Script LockService.getScriptLock()
 * Guarantees ticket numbers never collide even when multiple citizens submit simultaneously.
 */
export class TicketLockManager {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.queue;
    this.queue = prev.then(() => nextLock);
    await prev;
    try {
      return await task();
    } finally {
      release();
    }
  }
}

export async function generateAtomicTicket(
  lock: TicketLockManager,
  readCounter: () => number,
  writeCounter: (next: number) => void,
  year = new Date().getFullYear()
): Promise<string> {
  return lock.runExclusive(async () => {
    const current = readCounter();
    const next = current + 1;
    writeCounter(next);
    return formatTicketNumber(year, next);
  });
}
