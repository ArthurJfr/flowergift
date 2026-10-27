import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { BOUQUETS, COLOR_MODES, RESOLUTIONS, STYLES, WRAPS, isPalette } from '../engine/index.js';
import type { Config } from './config.js';
import type Database from 'better-sqlite3';
import {
  createSession,
  destroySession,
  passwordMatches,
  sessionCookieName,
  sessionIsValid,
} from './services/auth.js';
import {
  createGift,
  deleteGift,
  getGift,
  listGifts,
  markClicked,
  markOpened,
  markSendFailed,
  markSent,
  publicGift,
  rememberRecipient,
  revokeGift,
  sendsToday,
  type GiftStatus,
} from './services/gifts.js';
import { giftMail, safeSmtpError, type Mailer } from './services/mailer.js';

const bouquetId = z.enum(['roses', 'tulipes', 'marguerites', 'tournesols', 'orchidees', 'champetre']);
const styleId = z.enum(['classique', 'detail', 'blocs', 'texte', 'binaire', 'contour']);
const colorMode = z.enum(['color', 'mono-green', 'mono-amber', 'mono-white']);
const wrapId = z.enum(['paper', 'vase', 'ribbon']);
const resolutionId = z.enum(['standard', 'high', 'ultra']);
const giftStatus = z.enum(['created', 'sent', 'clicked', 'opened', 'expired', 'revoked']);

const loginBody = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

const giftBody = z.object({
  bouquetId,
  style: styleId,
  colorMode,
  wrap: wrapId,
  resolution: resolutionId,
  palette: z.string().min(1).max(40).optional(),
  fromName: z.string().trim().min(1).max(60),
  message: z.string().max(500).nullish(),
  recipientEmail: z.union([z.email(), z.literal(''), z.null()]).optional(),
  expiresInDays: z.number().int().min(0).max(365).optional(),
});

const listQuery = z.object({
  status: giftStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const sendBody = z.object({
  recipientEmail: z.email().optional(),
});

const testBody = z.object({
  to: z.email(),
});

function invalid(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input', message: 'Données invalides' });
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export interface RouteDeps {
  db: Database.Database;
  config: Config;
  mailer: Mailer | null;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db, config, mailer } = deps;
  const cookie = sessionCookieName();

  await app.register(rateLimit, { global: false });

  function cookieOptions() {
    return {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: config.sessionTtlHours * 3600,
    };
  }

  function authed(request: FastifyRequest, reply: FastifyReply): boolean {
    if (sessionIsValid(db, request.cookies[cookie])) return true;
    reply.code(401).send({ error: 'unauthorized', message: 'Connexion requise' });
    return false;
  }

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/robots.txt', async (_request, reply) => {
    return reply.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: config.loginRateMax,
          timeWindow: 60_000,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'rate_limited',
            message: 'Trop de tentatives, réessaie dans une minute.',
          }),
        },
      },
    },
    async (request, reply) => {
      const parsed = loginBody.safeParse(request.body);
      if (!parsed.success) return invalid(reply);
      const ok = await passwordMatches(parsed.data.email, parsed.data.password, config);
      if (!ok) return reply.code(401).send({ error: 'unauthorized', message: 'Identifiants invalides' });
      const token = createSession(db, config, request.headers['user-agent']);
      reply.setCookie(cookie, token, cookieOptions());
      return { email: config.adminEmail };
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    destroySession(db, request.cookies[cookie]);
    reply.clearCookie(cookie, cookieOptions());
    return reply.code(204).send();
  });

  app.get('/api/me', async (request, reply) => {
    if (!authed(request, reply)) return;
    return { email: config.adminEmail, smtpConfigured: mailer !== null };
  });

  app.get('/api/catalog', async (request, reply) => {
    if (!authed(request, reply)) return;
    return {
      bouquets: BOUQUETS.map(({ id, name }) => ({ id, name })),
      styles: STYLES.map(({ id, name }) => ({ id, name })),
      colorModes: COLOR_MODES.map(({ id, name }) => ({ id, name })),
      wraps: WRAPS.map(({ id, name }) => ({ id, name })),
      resolutions: RESOLUTIONS.map(({ id, name }) => ({ id, name })),
    };
  });

  app.get('/api/gifts', async (request, reply) => {
    if (!authed(request, reply)) return;
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return invalid(reply);
    return listGifts(db, config, {
      status: parsed.data.status as GiftStatus | undefined,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  });

  app.post('/api/gifts', async (request, reply) => {
    if (!authed(request, reply)) return;
    const parsed = giftBody.safeParse(request.body);
    if (!parsed.success) return invalid(reply);
    const palette = parsed.data.palette ?? 'origine';
    if (!isPalette(parsed.data.bouquetId, palette)) return invalid(reply);
    const gift = createGift(db, config, {
      ...parsed.data,
      palette,
      message: blankToNull(parsed.data.message),
      recipientEmail: blankToNull(parsed.data.recipientEmail),
    });
    return reply.code(201).send(gift);
  });

  app.get('/api/gifts/:id', async (request, reply) => {
    if (!authed(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    const gift = Number.isInteger(id) ? getGift(db, config, id) : undefined;
    if (!gift) return reply.code(404).send({ error: 'not_found', message: 'Cadeau introuvable' });
    return gift;
  });

  app.post('/api/gifts/:id/revoke', async (request, reply) => {
    if (!authed(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    const gift = Number.isInteger(id) ? revokeGift(db, config, id) : undefined;
    if (!gift) return reply.code(404).send({ error: 'not_found', message: 'Cadeau introuvable' });
    return gift;
  });

  app.delete('/api/gifts/:id', async (request, reply) => {
    if (!authed(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || !deleteGift(db, id)) {
      return reply.code(404).send({ error: 'not_found', message: 'Cadeau introuvable' });
    }
    return reply.code(204).send();
  });

  app.post('/api/gifts/:id/send', async (request, reply) => {
    if (!authed(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    const gift = Number.isInteger(id) ? getGift(db, config, id) : undefined;
    if (!gift) return reply.code(404).send({ error: 'not_found', message: 'Cadeau introuvable' });
    const parsed = sendBody.safeParse(request.body ?? {});
    if (!parsed.success) return invalid(reply);
    const email = parsed.data.recipientEmail ?? gift.recipientEmail;
    if (!email) return invalid(reply);
    if (sendsToday(db) >= 100) {
      return reply.code(502).send({ error: 'smtp_failed', message: 'Limite d’envois du jour atteinte.' });
    }
    if (!mailer) {
      return reply.code(502).send({
        error: 'smtp_failed',
        message: 'SMTP non configuré. Ajoute SMTP_PASS dans le fichier .env, puis redémarre.',
      });
    }
    rememberRecipient(db, gift.id, email);
    try {
      await mailer.send(giftMail({ ...gift, recipientEmail: email }));
    } catch (error) {
      markSendFailed(db, config, gift.id, safeSmtpError(error, config.smtp?.pass));
      return reply.code(502).send({
        error: 'smtp_failed',
        message: 'L’envoi a échoué. Vérifie le mot de passe d’application et l’adresse.',
      });
    }
    const sent = markSent(db, config, gift.id);
    return sent;
  });

  app.post('/api/mail/test', async (request, reply) => {
    if (!authed(request, reply)) return;
    const parsed = testBody.safeParse(request.body);
    if (!parsed.success) return invalid(reply);
    if (!mailer) {
      return reply.code(502).send({
        error: 'smtp_failed',
        message: 'SMTP non configuré. Ajoute SMTP_PASS dans le fichier .env, puis redémarre.',
      });
    }
    try {
      await mailer.send({
        to: parsed.data.to,
        subject: 'FlowerGift — essai',
        text: 'Le courrier de FlowerGift fonctionne.',
        html: '<p>Le courrier de FlowerGift fonctionne.</p>',
      });
    } catch (error) {
      request.log.warn({ err: safeSmtpError(error, config.smtp?.pass) }, 'essai smtp');
      return reply.code(502).send({
        error: 'smtp_failed',
        message: 'L’essai a échoué. Vérifie SMTP_USER et SMTP_PASS.',
      });
    }
    return reply.code(204).send();
  });

  const publicLimit = {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60_000,
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'rate_limited',
          message: 'Trop de requêtes.',
        }),
      },
    },
  };

  app.get('/api/public/gifts/:token', publicLimit, async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const gift = publicGift(db, config, token);
    if (!gift) return reply.code(404).send({ error: 'unavailable', message: 'Ce cadeau n’est plus disponible' });
    return gift;
  });

  app.post('/api/public/gifts/:token/clicked', publicLimit, async (request, reply) => {
    const token = (request.params as { token: string }).token;
    if (!markClicked(db, token)) {
      return reply.code(404).send({ error: 'unavailable', message: 'Ce cadeau n’est plus disponible' });
    }
    return reply.code(204).send();
  });

  app.post('/api/public/gifts/:token/opened', publicLimit, async (request, reply) => {
    const token = (request.params as { token: string }).token;
    if (!markOpened(db, token)) {
      return reply.code(404).send({ error: 'unavailable', message: 'Ce cadeau n’est plus disponible' });
    }
    return reply.code(204).send();
  });
}
