import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function parseEnvFile(file = resolve(process.cwd(), '.env')): Record<string, string> {
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/\s+#/);
      if (comment >= 0) value = value.slice(0, comment).trim();
    }
    values[key] = value;
  }
  return values;
}

function isAppUrl(value: string | undefined): value is string {
  return value !== undefined && /^https?:\/\//i.test(value);
}

function pick(env: NodeJS.ProcessEnv, file: Record<string, string>, key: string): string | undefined {
  const fromEnv = env[key];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const fromFile = file[key];
  if (fromFile !== undefined && fromFile !== '') return fromFile;
  return undefined;
}

const baseUrl = z.url({
  protocol: /^https?$/,
  hostname: /^(localhost|127\.0\.0\.1|([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63})$/,
});

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: baseUrl.default('http://localhost:3000'),
  DATA_DIR: z.string().min(1).default('/data'),
  ADMIN_EMAIL: z.email().default('flowergift@local.test'),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),
  GIFT_TTL_DAYS: z.coerce.number().int().min(0).max(365).default(30),
  GIFT_BOX_TAPS: z.coerce.number().int().min(1).max(20).default(5),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM_NAME: z.string().default('FlowerGift'),
  SMTP_FROM_EMAIL: z.string().default(''),
});

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  baseUrl: string;
  dataDir: string;
  adminEmail: string;
  adminPasswordHash: string;
  sessionSecret: string;
  sessionTtlHours: number;
  giftTtlDays: number;
  giftBoxTaps: number;
  loginRateMax: number;
  smtp: SmtpConfig | null;
}

const TEST_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$ZGVmdWFsdGhhc2hmb3J0ZXN0c29ubHk';
const TEST_SECRET = 'test-session-secret-test-session-secret';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const file = parseEnvFile();
  const nodeEnv = pick(env, file, 'NODE_ENV') ?? (env.NODE_ENV === 'test' ? 'test' : undefined);
  const testing = (nodeEnv ?? env.NODE_ENV) === 'test';
  const appUrl = [env.BASE_URL, file.BASE_URL].find((value): value is string => isAppUrl(value));

  const parsed = schema.parse({
    NODE_ENV: nodeEnv,
    PORT: pick(env, file, 'PORT'),
    BASE_URL: appUrl,
    DATA_DIR: pick(env, file, 'DATA_DIR'),
    ADMIN_EMAIL: pick(env, file, 'ADMIN_EMAIL'),
    ADMIN_PASSWORD_HASH: pick(env, file, 'ADMIN_PASSWORD_HASH') ?? (testing ? TEST_HASH : undefined),
    SESSION_SECRET: pick(env, file, 'SESSION_SECRET') ?? (testing ? TEST_SECRET : undefined),
    SESSION_TTL_HOURS: pick(env, file, 'SESSION_TTL_HOURS'),
    GIFT_TTL_DAYS: pick(env, file, 'GIFT_TTL_DAYS'),
    GIFT_BOX_TAPS: pick(env, file, 'GIFT_BOX_TAPS'),
    SMTP_HOST: pick(env, file, 'SMTP_HOST'),
    SMTP_PORT: pick(env, file, 'SMTP_PORT'),
    SMTP_SECURE: pick(env, file, 'SMTP_SECURE'),
    SMTP_USER: pick(env, file, 'SMTP_USER') ?? '',
    SMTP_PASS: pick(env, file, 'SMTP_PASS') ?? '',
    SMTP_FROM_NAME: pick(env, file, 'SMTP_FROM_NAME'),
    SMTP_FROM_EMAIL: pick(env, file, 'SMTP_FROM_EMAIL') ?? '',
  });

  const pass = parsed.SMTP_PASS.trim();
  const user = parsed.SMTP_USER.trim();
  const smtp: SmtpConfig | null = pass
    ? {
        host: parsed.SMTP_HOST,
        port: parsed.SMTP_PORT,
        secure: parsed.SMTP_SECURE === 'true',
        user,
        pass,
        fromName: parsed.SMTP_FROM_NAME,
        fromEmail: parsed.SMTP_FROM_EMAIL || user,
      }
    : null;

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    baseUrl: parsed.BASE_URL,
    dataDir: parsed.DATA_DIR,
    adminEmail: parsed.ADMIN_EMAIL,
    adminPasswordHash: parsed.ADMIN_PASSWORD_HASH,
    sessionSecret: parsed.SESSION_SECRET,
    sessionTtlHours: parsed.SESSION_TTL_HOURS,
    giftTtlDays: parsed.GIFT_TTL_DAYS,
    giftBoxTaps: parsed.GIFT_BOX_TAPS,
    loginRateMax: 5,
    smtp,
  };
}
