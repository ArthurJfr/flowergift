# Architecture

## Vue d'ensemble

```
Navigateur (toi)          Navigateur (destinataire)         Boîte mail (destinataire)
   /admin  ─────┐              /g/<token>  ──────┐                    ▲
                ▼                                 ▼                    │ SMTP (Gmail)
        ┌───────────────────────── Fastify (1 conteneur) ───────────────┴───┐
        │  /admin, /g/*  → HTML statiques (Vite)                              │
        │  /api/*        → routes JSON (admin : session ; public : token)     │
        │  services : auth · gifts · mailer · engine (aperçu mail)            │
        └───────────────┬─────────────────────────────────────────────────────┘
                        ▼
                 SQLite  /data/flowergift.db   (volume Docker)
```

Un seul conteneur, une seule base : volontairement simple (usage perso, charge négligeable).

## Choix & justifications

| Choix | Pourquoi | Alternative si tu préfères |
|---|---|---|
| Fastify + TS | Léger, validation intégrée, bon écosystème plugins | Express / Hono |
| SQLite | Zéro service à maintenir, sauvegarde = copier un fichier | Postgres (surdimensionné ici) |
| Front vanilla TS (Vite) | Le moteur ASCII est impératif ; l'UI est petite (2 pages) | React/Svelte si tu veux t'entraîner |
| Moteur **sans DOM** | Réutilisable côté serveur (aperçu e-mail, `og:image`) et testable | — |
| Même hôte pour admin + public | Un seul certificat, une seule règle Traefik | `admin.` séparé si tu veux isoler |
| Mail = création automatique d'un lien | Un seul mécanisme de partage ; le mail n'est qu'un canal de livraison | — |

## Structure du repo (cible)

```
flowergift/
├─ src/
│  ├─ engine/                # SANS DOM
│  │  ├─ catalog.ts          # bouquets, palettes, styles, emballages (données)
│  │  ├─ scene.ts            # pose(), draw*(), renderFrame() → Grid
│  │  ├─ shapes.ts           # fonctions de forme (rose, daisy, sun, tulip, orch, lav…)
│  │  ├─ serialize.ts        # toHtml / toText / toEmailHtml
│  │  ├─ rng.ts              # PRNG seedé (mulberry32)
│  │  └─ index.ts
│  ├─ server/
│  │  ├─ index.ts            # bootstrap Fastify
│  │  ├─ config.ts           # lecture/validation .env (zod)
│  │  ├─ db/ (index.ts, migrations/*.sql)
│  │  ├─ routes/ (auth.ts, gifts.ts, public.ts, mail.ts)
│  │  └─ services/ (auth.ts, gifts.ts, mailer.ts, mail-template.ts)
│  └─ web/
│     ├─ admin/ (index.html, main.ts, gallery.ts, composer.ts, history.ts)
│     ├─ gift/  (index.html, main.ts, giftbox.ts)
│     └─ shared/ (api.ts, dom.ts, styles.css)
├─ data/                     # SQLite (gitignoré)
├─ docs/
├─ Dockerfile · compose.yaml · compose.prod.yaml · .env.example
└─ package.json · tsconfig.json · vite.config.ts · vitest.config.ts
```

Vite : deux entrées (`admin/index.html`, `gift/index.html`). Fastify sert `/admin` → admin, `/g/:token` → gift (même HTML pour tous les tokens, le token est lu côté client).

## Dépendances prévues (toute autre ⇒ demander)

Prod : `fastify`, `@fastify/static`, `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/helmet`, `better-sqlite3`, `@node-rs/argon2`, `nodemailer`, `zod`
Dev : `typescript`, `tsx`, `vite`, `vitest`, `eslint`, `@types/*`

## Modèle de données

`001_init.sql` / `002_gifts.sql` — dates en ISO 8601 UTC (texte).

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,            -- random 32 octets base64url (hashé SHA-256 en base)
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT
);

CREATE TABLE gifts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,   -- interne, jamais dans une URL publique
  token           TEXT NOT NULL UNIQUE,                -- randomBytes(16) base64url (22 car.)
  bouquet_id      TEXT NOT NULL,                       -- 'roses' | 'tulipes' | …
  style           TEXT NOT NULL,                       -- 'classique' | 'detail' | …
  color_mode      TEXT NOT NULL DEFAULT 'color',       -- 'color' | 'mono-green' | …
  wrap            TEXT NOT NULL DEFAULT 'paper',       -- 'paper' | 'vase' | 'ribbon'
  resolution      TEXT NOT NULL DEFAULT 'high',        -- 'standard' | 'high' | 'ultra'
  from_name       TEXT NOT NULL,
  message         TEXT,                                -- max 500 car.
  recipient_email TEXT,                                -- NULL si simple lien
  created_at      TEXT NOT NULL,
  expires_at      TEXT,                                -- NULL = n'expire pas
  revoked_at      TEXT,
  first_opened_at TEXT,
  open_count      INTEGER NOT NULL DEFAULT 0,
  sent_at         TEXT,
  send_status     TEXT,                                -- 'ok' | 'error'
  send_error      TEXT
);
CREATE INDEX idx_gifts_created ON gifts(created_at DESC);
```

États dérivés (calculés, pas stockés) : `revoked` > `expired` > `opened` > `sent` > `created`.

## Flux principaux

**Créer + partager par lien**
1. Admin compose → `POST /api/gifts` → serveur génère `token`, insère, renvoie `{ shareUrl }`.
2. Admin copie le lien. Destinataire ouvre `/g/<token>`.
3. Page cadeau : `GET /api/public/gifts/<token>` → config du bouquet + message → boîte animée.
4. À l'ouverture de la boîte : `POST /api/public/gifts/<token>/opened` → `first_opened_at`, `open_count++`.

**Envoyer par mail**
1. Admin compose avec un email destinataire → `POST /api/gifts` puis `POST /api/gifts/:id/send` (ou en un seul appel côté UI).
2. Serveur rend l'aperçu statique (`engine.toEmailHtml`), assemble HTML + texte, envoie via Nodemailer.
3. Met à jour `sent_at` / `send_status`. Le lien du mail est le même que le lien de partage.

## Configuration

Tout par variables d'environnement, validées au démarrage par zod (`config.ts`) : le serveur **refuse de démarrer** si `SESSION_SECRET` ou `ADMIN_PASSWORD_HASH` manquent. Liste : `.env.example`.
