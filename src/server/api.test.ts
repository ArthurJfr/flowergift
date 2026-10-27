import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { Algorithm, hash } from '@node-rs/argon2';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { OutboundMail } from './services/mailer.js';

const password = 'mot-de-passe-test';
let passwordHash = '';
const dirs: string[] = [];

beforeAll(async () => {
  passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function dataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'flowergift-api-'));
  dirs.push(dir);
  return dir;
}

async function start(options?: { mailer?: { send: (mail: OutboundMail) => Promise<void> } | null; loginRateMax?: number }) {
  const sent: OutboundMail[] = [];
  const mailer = options?.mailer === undefined
    ? { async send(mail: OutboundMail) { sent.push(mail); } }
    : options.mailer;
  const dir = dataDir();
  const webRoot = join(dir, 'web');
  mkdirSync(join(webRoot, 'admin'), { recursive: true });
  mkdirSync(join(webRoot, 'gift'), { recursive: true });
  writeFileSync(join(webRoot, 'admin', 'index.html'), '<p>admin</p>');
  writeFileSync(join(webRoot, 'gift', 'index.html'), '<p>gift</p>');
  const app = await buildApp({
    dataDir: dir,
    webRoot,
    logger: false,
    mailer,
    config: {
      adminEmail: 'admin@example.com',
      adminPasswordHash: passwordHash,
      sessionSecret: 'session-secret-session-secret-session',
      baseUrl: 'http://localhost:3000',
      giftBoxTaps: 2,
      loginRateMax: options?.loginRateMax ?? 5,
      nodeEnv: 'test',
    },
  });
  return { app, sent, dir };
}

function cookieOf(setCookie: string | string[] | undefined): string {
  const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!line) throw new Error('cookie absent');
  return line.split(';')[0] ?? line;
}

describe('api', () => {
  it('refuse un mauvais mot de passe et accepte le bon', async () => {
    const { app } = await start();
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@example.com', password: 'non' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ error: 'unauthorized', message: 'Identifiants invalides' });

    const good = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@example.com', password } });
    expect(good.statusCode).toBe(200);
    const cookie = cookieOf(good.headers['set-cookie']);
    expect(cookie.startsWith('fg_session=')).toBe(true);
    expect(String(good.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(good.headers['set-cookie'])).toContain('SameSite=Strict');
    expect(String(good.headers['set-cookie'])).not.toContain('Secure');

    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('admin@example.com');

    const gone = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(gone.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
    await app.close();
  });

  it('limite les essais de connexion', async () => {
    const { app } = await start({ loginRateMax: 2 });
    const body = { email: 'admin@example.com', password: 'non' };
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: body })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: body })).statusCode).toBe(401);
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: body });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toBe('rate_limited');
    await app.close();
  });

  it('crée un cadeau, l’ouvre, puis rend inconnu, expiré et révoqué identiques', async () => {
    const { app, sent, dir } = await start();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@example.com', password } });
    const cookie = cookieOf(login.headers['set-cookie']);
    const created = await app.inject({
      method: 'POST',
      url: '/api/gifts',
      headers: { cookie },
      payload: {
        bouquetId: 'tulipes',
        style: 'classique',
        colorMode: 'color',
        wrap: 'paper',
        resolution: 'standard',
        fromName: 'Arthur',
        message: 'Pour <toi>',
        recipientEmail: 'ami@example.com',
      },
    });
    expect(created.statusCode).toBe(201);
    const gift = created.json();
    expect(gift.shareUrl).toBe(`http://localhost:3000/g/${gift.token}`);
    expect(gift.token).toHaveLength(22);

    const pub = await app.inject({ method: 'GET', url: `/api/public/gifts/${gift.token}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.headers['cache-control']).toBe('no-store');
    expect(pub.json()).toEqual({
      bouquetId: 'tulipes',
      style: 'classique',
      colorMode: 'color',
      wrap: 'paper',
      resolution: 'standard',
      fromName: 'Arthur',
      message: 'Pour <toi>',
      palette: 'origine',
      boxTaps: 2,
    });

    const clicked = await app.inject({ method: 'POST', url: `/api/public/gifts/${gift.token}/clicked` });
    expect(clicked.statusCode).toBe(204);
    const afterClick = await app.inject({ method: 'GET', url: `/api/gifts/${gift.id}`, headers: { cookie } });
    expect(afterClick.json().status).toBe('clicked');
    expect(afterClick.json().clickCount).toBe(1);
    expect(afterClick.json().firstClickedAt).toEqual(expect.any(String));

    const opened = await app.inject({ method: 'POST', url: `/api/public/gifts/${gift.token}/opened` });
    expect(opened.statusCode).toBe(204);
    const again = await app.inject({ method: 'GET', url: `/api/gifts/${gift.id}`, headers: { cookie } });
    expect(again.json().openCount).toBe(1);
    expect(again.json().firstOpenedAt).toEqual(expect.any(String));

    const mailed = await app.inject({ method: 'POST', url: `/api/gifts/${gift.id}/send`, headers: { cookie }, payload: {} });
    expect(mailed.statusCode).toBe(200);
    expect(mailed.json().status).toBe('opened');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ami@example.com');
    expect(sent[0]?.html).toContain('Pour &lt;toi&gt;');
    expect(sent[0]?.html).toContain('Ouvrir le cadeau');
    expect(sent[0]?.html).not.toContain('<pre');
    expect(sent[0]?.html).toContain(`${gift.shareUrl}?via=mail`);
    expect(sent[0]?.text).toContain(`${gift.shareUrl}?via=mail`);

    const unknown = await app.inject({ method: 'GET', url: '/api/public/gifts/inconnu-token-xxxxxxxx' });
    const revoked = await app.inject({ method: 'POST', url: `/api/gifts/${gift.id}/revoke`, headers: { cookie } });
    expect(revoked.json().status).toBe('revoked');
    const afterRevoke = await app.inject({ method: 'GET', url: `/api/public/gifts/${gift.token}` });

    const other = await app.inject({
      method: 'POST',
      url: '/api/gifts',
      headers: { cookie },
      payload: {
        bouquetId: 'roses',
        style: 'blocs',
        colorMode: 'mono-green',
        wrap: 'vase',
        resolution: 'high',
        fromName: 'Arthur',
      },
    });
    const expiredId = other.json().id as number;
    const expiredToken = other.json().token as string;
    const file = join(dir, 'flowergift.db');
    const sqlite = new Database(file);
    sqlite.prepare('UPDATE gifts SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', expiredId);
    sqlite.close();
    const expired = await app.inject({ method: 'GET', url: `/api/public/gifts/${expiredToken}` });

    expect(unknown.statusCode).toBe(404);
    expect(afterRevoke.statusCode).toBe(404);
    expect(expired.statusCode).toBe(404);
    expect(unknown.json()).toEqual(afterRevoke.json());
    expect(unknown.json()).toEqual(expired.json());
    expect(JSON.stringify(unknown.json())).not.toContain('ami@example.com');

    const page = await app.inject({ method: 'GET', url: `/g/${gift.token}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers['x-robots-tag']).toContain('noindex');
    await app.close();
  });

  it('refuse l’envoi tant que SMTP n’est pas renseigné', async () => {
    const { app } = await start({ mailer: null });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@example.com', password } });
    const cookie = cookieOf(login.headers['set-cookie']);
    const created = await app.inject({
      method: 'POST',
      url: '/api/gifts',
      headers: { cookie },
      payload: {
        bouquetId: 'roses',
        style: 'classique',
        colorMode: 'color',
        wrap: 'paper',
        resolution: 'high',
        fromName: 'Arthur',
        recipientEmail: 'ami@example.com',
      },
    });
    const sent = await app.inject({ method: 'POST', url: `/api/gifts/${created.json().id}/send`, headers: { cookie }, payload: {} });
    expect(sent.statusCode).toBe(502);
    expect(sent.json().error).toBe('smtp_failed');
    expect(sent.json().message).toContain('SMTP_PASS');
    const stored = await app.inject({ method: 'GET', url: `/api/gifts/${created.json().id}`, headers: { cookie } });
    expect(stored.json().status).toBe('created');
    expect(stored.json().sentAt).toBeNull();
    await app.close();
  });

  it('enregistre le duo de couleurs et refuse une palette d’un autre bouquet', async () => {
    const { app } = await start();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@example.com', password } });
    const cookie = cookieOf(login.headers['set-cookie']);
    const created = await app.inject({
      method: 'POST',
      url: '/api/gifts',
      headers: { cookie },
      payload: {
        bouquetId: 'orchidees',
        style: 'classique',
        colorMode: 'color',
        wrap: 'paper',
        resolution: 'standard',
        palette: 'rose-blanc',
        fromName: 'Arthur',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().palette).toBe('rose-blanc');
    const pub = await app.inject({ method: 'GET', url: `/api/public/gifts/${created.json().token}` });
    expect(pub.json().palette).toBe('rose-blanc');

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/gifts',
      headers: { cookie },
      payload: {
        bouquetId: 'orchidees',
        style: 'classique',
        colorMode: 'color',
        wrap: 'paper',
        resolution: 'standard',
        palette: 'rouge-jaune',
        fromName: 'Arthur',
      },
    });
    expect(rejected.statusCode).toBe(400);
    await app.close();
  });
});
