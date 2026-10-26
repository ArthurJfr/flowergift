import { createHash, randomBytes } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import type Database from 'better-sqlite3';
import type { Config } from '../config.js';

const COOKIE = 'fg_session';

let timingHash: Promise<string> | null = null;

function padHash(): Promise<string> {
  timingHash ??= hash('flowergift-timing-pad', { algorithm: Algorithm.Argon2id });
  return timingHash;
}

export function sessionCookieName(): string {
  return COOKIE;
}

export async function passwordMatches(email: string, password: string, config: Config): Promise<boolean> {
  const emailOk = email.trim().toLowerCase() === config.adminEmail.trim().toLowerCase();
  try {
    const ok = await verify(emailOk ? config.adminPasswordHash : await padHash(), password);
    return emailOk && ok;
  } catch {
    return false;
  }
}

export function createSession(db: Database.Database, config: Config, userAgent: string | undefined): string {
  const token = randomBytes(32).toString('base64url');
  const id = hashSession(token);
  const now = new Date();
  const expires = new Date(now.getTime() + config.sessionTtlHours * 3_600_000);
  db.prepare(
    'INSERT INTO sessions (id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?)',
  ).run(id, now.toISOString(), expires.toISOString(), userAgent ?? null);
  return token;
}

export function sessionIsValid(db: Database.Database, token: string | undefined): boolean {
  if (!token) return false;
  const id = hashSession(token);
  const row = db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(id) as
    | { expires_at: string }
    | undefined;
  if (!row) return false;
  if (row.expires_at <= new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return false;
  }
  return true;
}

export function destroySession(db: Database.Database, token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(hashSession(token));
}

export function purgeExpiredSessions(db: Database.Database): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

function hashSession(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
