import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BouquetId, ColorMode, ResolutionId, StyleId, WrapId } from '../../engine/index.js';
import type { Config } from '../config.js';

export type GiftStatus = 'created' | 'sent' | 'opened' | 'expired' | 'revoked';

export interface GiftInput {
  bouquetId: BouquetId;
  style: StyleId;
  colorMode: ColorMode;
  wrap: WrapId;
  resolution: ResolutionId;
  fromName: string;
  message: string | null;
  recipientEmail: string | null;
  expiresInDays?: number;
}

export interface GiftDto {
  id: number;
  token: string;
  shareUrl: string;
  bouquetId: BouquetId;
  style: StyleId;
  colorMode: ColorMode;
  wrap: WrapId;
  resolution: ResolutionId;
  fromName: string;
  message: string | null;
  recipientEmail: string | null;
  status: GiftStatus;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  sentAt: string | null;
  sendStatus: 'ok' | 'error' | null;
  sendError: string | null;
}

export interface PublicGift {
  bouquetId: BouquetId;
  style: StyleId;
  colorMode: ColorMode;
  wrap: WrapId;
  resolution: ResolutionId;
  fromName: string;
  message: string | null;
  boxTaps: number;
}

interface GiftRow {
  id: number;
  token: string;
  bouquet_id: string;
  style: string;
  color_mode: string;
  wrap: string;
  resolution: string;
  from_name: string;
  message: string | null;
  recipient_email: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  sent_at: string | null;
  send_status: string | null;
  send_error: string | null;
}

function statusOf(row: GiftRow, now: string): GiftStatus {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && row.expires_at <= now) return 'expired';
  if (row.first_opened_at) return 'opened';
  if (row.send_status === 'ok') return 'sent';
  return 'created';
}

function unavailable(row: GiftRow, now: string): boolean {
  const status = statusOf(row, now);
  return status === 'revoked' || status === 'expired';
}

export function toGift(row: GiftRow, config: Config, now = new Date().toISOString()): GiftDto {
  return {
    id: row.id,
    token: row.token,
    shareUrl: `${config.baseUrl}/g/${row.token}`,
    bouquetId: row.bouquet_id as BouquetId,
    style: row.style as StyleId,
    colorMode: row.color_mode as ColorMode,
    wrap: row.wrap as WrapId,
    resolution: row.resolution as ResolutionId,
    fromName: row.from_name,
    message: row.message,
    recipientEmail: row.recipient_email,
    status: statusOf(row, now),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    firstOpenedAt: row.first_opened_at,
    openCount: row.open_count,
    sentAt: row.sent_at,
    sendStatus: row.send_status === 'ok' || row.send_status === 'error' ? row.send_status : null,
    sendError: row.send_error,
  };
}

function rowById(db: Database.Database, id: number): GiftRow | undefined {
  return db.prepare('SELECT * FROM gifts WHERE id = ?').get(id) as GiftRow | undefined;
}

function rowByToken(db: Database.Database, token: string): GiftRow | undefined {
  return db.prepare('SELECT * FROM gifts WHERE token = ?').get(token) as GiftRow | undefined;
}

export function createGift(db: Database.Database, config: Config, input: GiftInput): GiftDto {
  const token = randomBytes(16).toString('base64url');
  const now = new Date();
  const days = input.expiresInDays ?? config.giftTtlDays;
  const expires = days === 0 ? null : new Date(now.getTime() + days * 86_400_000).toISOString();
  const result = db
    .prepare(
      `INSERT INTO gifts (
        token, bouquet_id, style, color_mode, wrap, resolution, from_name, message, recipient_email, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      token,
      input.bouquetId,
      input.style,
      input.colorMode,
      input.wrap,
      input.resolution,
      input.fromName,
      input.message,
      input.recipientEmail,
      now.toISOString(),
      expires,
    );
  const row = rowById(db, Number(result.lastInsertRowid));
  if (!row) throw new Error('cadeau introuvable après insertion');
  return toGift(row, config);
}

export function listGifts(
  db: Database.Database,
  config: Config,
  query: { status?: GiftStatus; limit: number; offset: number },
): { items: GiftDto[]; total: number } {
  const now = new Date().toISOString();
  const rows = db.prepare('SELECT * FROM gifts ORDER BY created_at DESC').all() as GiftRow[];
  const gifts = rows.map((row) => toGift(row, config, now));
  const filtered = query.status ? gifts.filter((gift) => gift.status === query.status) : gifts;
  return { items: filtered.slice(query.offset, query.offset + query.limit), total: filtered.length };
}

export function getGift(db: Database.Database, config: Config, id: number): GiftDto | undefined {
  const row = rowById(db, id);
  return row ? toGift(row, config) : undefined;
}

export function revokeGift(db: Database.Database, config: Config, id: number): GiftDto | undefined {
  const row = rowById(db, id);
  if (!row) return undefined;
  if (!row.revoked_at) {
    db.prepare('UPDATE gifts SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }
  const next = rowById(db, id);
  return next ? toGift(next, config) : undefined;
}

export function deleteGift(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM gifts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function publicGift(db: Database.Database, config: Config, token: string): PublicGift | undefined {
  const row = rowByToken(db, token);
  if (!row || unavailable(row, new Date().toISOString())) return undefined;
  return {
    bouquetId: row.bouquet_id as BouquetId,
    style: row.style as StyleId,
    colorMode: row.color_mode as ColorMode,
    wrap: row.wrap as WrapId,
    resolution: row.resolution as ResolutionId,
    fromName: row.from_name,
    message: row.message,
    boxTaps: config.giftBoxTaps,
  };
}

export function markOpened(db: Database.Database, token: string): boolean {
  const row = rowByToken(db, token);
  if (!row || unavailable(row, new Date().toISOString())) return false;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE gifts
     SET open_count = open_count + 1,
         first_opened_at = COALESCE(first_opened_at, ?)
     WHERE id = ?`,
  ).run(now, row.id);
  return true;
}

export function sendsToday(db: Database.Database): number {
  const day = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM gifts WHERE send_status = 'ok' AND sent_at >= ? AND sent_at < ?`)
    .get(`${day}T00:00:00.000Z`, `${day}T23:59:59.999Z`) as { n: number };
  return row.n;
}

export function rememberRecipient(db: Database.Database, id: number, email: string): void {
  db.prepare('UPDATE gifts SET recipient_email = ? WHERE id = ?').run(email, id);
}

export function markSent(db: Database.Database, config: Config, id: number): GiftDto | undefined {
  const now = new Date().toISOString();
  db.prepare(`UPDATE gifts SET sent_at = ?, send_status = 'ok', send_error = NULL WHERE id = ?`).run(now, id);
  const row = rowById(db, id);
  return row ? toGift(row, config) : undefined;
}

export function markSendFailed(db: Database.Database, config: Config, id: number, message: string): GiftDto | undefined {
  db.prepare(`UPDATE gifts SET send_status = 'error', send_error = ? WHERE id = ?`).run(message.slice(0, 300), id);
  const row = rowById(db, id);
  return row ? toGift(row, config) : undefined;
}

export function purgeOldRecipientEmails(db: Database.Database): number {
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const result = db
    .prepare(
      `UPDATE gifts SET recipient_email = NULL
       WHERE recipient_email IS NOT NULL AND sent_at IS NOT NULL AND sent_at < ?`,
    )
    .run(cutoff);
  return result.changes;
}
