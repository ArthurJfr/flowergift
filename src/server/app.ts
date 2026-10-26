import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { loadConfig, type Config } from './config.js';
import { openDatabase } from './db/index.js';
import { registerRoutes } from './routes.js';
import { purgeExpiredSessions } from './services/auth.js';
import { purgeOldRecipientEmails } from './services/gifts.js';
import { createMailer, type Mailer } from './services/mailer.js';

const serverDir = dirname(fileURLToPath(import.meta.url));

export interface BuildOptions {
  dataDir?: string;
  webRoot?: string;
  logger?: boolean;
  config?: Partial<Config>;
  mailer?: Mailer | null;
}

function sendHtml(file: string) {
  return createReadStream(file);
}

function originAllowed(origin: string, host: string | undefined, baseUrl: string): boolean {
  try {
    const url = new URL(origin);
    if (url.origin === new URL(baseUrl).origin) return true;
    return host !== undefined && url.host === host;
  } catch {
    return false;
  }
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config: Config = { ...loadConfig(), ...options.config };
  const dataDir = options.dataDir ?? config.dataDir;
  const webRoot = options.webRoot ?? join(process.cwd(), 'dist', 'web');
  const mailer = options.mailer === undefined ? createMailer(config) : options.mailer;

  mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(dataDir, join(serverDir, 'db', 'migrations'));
  purgeExpiredSessions(db);
  purgeOldRecipientEmails(db);

  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== 'test',
    bodyLimit: 16 * 1024,
    disableRequestLogging: true,
  });

  app.addHook('onClose', async () => {
    db.close();
  });

  app.addHook('onResponse', async (request, reply) => {
    const url = request.url
      .replace(/\/g\/[^/?#]+/g, '/g/[redacted]')
      .replace(/\/api\/public\/gifts\/[^/?#]+/g, '/api/public/gifts/[redacted]');
    request.log.info({ url, statusCode: reply.statusCode }, 'request');
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Données invalides' });
    }
    const status = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500;
    if (status === 429) {
      return reply.code(429).send({
        error: 'rate_limited',
        message: 'Trop de tentatives, réessaie dans une minute.',
      });
    }
    if (status >= 500) request.log.error({ err: error }, 'erreur');
    return reply.code(status).send({
      error: status === 404 ? 'not_found' : 'internal',
      message: status === 404 ? 'Introuvable' : 'Erreur interne',
    });
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: config.nodeEnv === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
      },
    },
    strictTransportSecurity: config.nodeEnv === 'production',
    referrerPolicy: { policy: 'no-referrer' },
  });
  await app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/g/') || request.url.startsWith('/api/public/')) {
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      reply.header('Referrer-Policy', 'no-referrer');
    }
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    if (!originAllowed(origin, request.headers.host, config.baseUrl)) {
      return reply.code(403).send({ error: 'unauthorized', message: 'Origine refusée' });
    }
  });

  await registerRoutes(app, { db, config, mailer });

  const adminHtml = join(webRoot, 'admin', 'index.html');
  const giftHtml = join(webRoot, 'gift', 'index.html');
  const devHtml = join(webRoot, 'dev', 'index.html');
  const assetsDir = join(webRoot, 'assets');
  const favicon = join(webRoot, 'favicon.svg');

  if (existsSync(adminHtml) && existsSync(giftHtml)) {
    app.get('/', async (_request, reply) => reply.redirect('/admin'));
    app.get('/admin', async (_request, reply) => {
      return reply.type('text/html; charset=utf-8').send(sendHtml(adminHtml));
    });
    app.get('/g/:token', async (_request, reply) => {
      return reply.type('text/html; charset=utf-8').send(sendHtml(giftHtml));
    });
  }

  if (config.nodeEnv !== 'production' && existsSync(devHtml)) {
    app.get('/dev/engine', async (_request, reply) => {
      return reply.type('text/html; charset=utf-8').send(sendHtml(devHtml));
    });
  }

  if (existsSync(favicon)) {
    app.get('/favicon.svg', async (_request, reply) => {
      return reply.type('image/svg+xml').header('cache-control', 'public, max-age=86400').send(sendHtml(favicon));
    });
  }

  if (existsSync(assetsDir)) {
    await app.register(fastifyStatic, {
      root: assetsDir,
      prefix: '/assets/',
      decorateReply: false,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'not_found', message: 'Introuvable' });
    }
    return reply.code(404).type('text/html; charset=utf-8').send('Introuvable');
  });

  if (options.logger !== false) app.log.info({ smtp: mailer !== null }, 'flowergift prêt');
  return app;
}
