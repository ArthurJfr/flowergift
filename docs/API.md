# API

JSON partout. Erreurs : `{ "error": "code_court", "message": "…" }`. Validation zod ⇒ `400`.
Auth admin = cookie de session `fg_session`. Routes publiques = token dans l'URL, sans cookie.

## Types partagés

```ts
type BouquetId = 'roses'|'tulipes'|'marguerites'|'tournesols'|'orchidees'|'champetre';
type StyleId   = 'classique'|'detail'|'blocs'|'texte'|'binaire'|'contour';
type ColorMode = 'color'|'mono-green'|'mono-amber'|'mono-white';
type WrapId    = 'paper'|'vase'|'ribbon';
type ResId     = 'standard'|'high'|'ultra';

interface GiftOptions { bouquetId: BouquetId; style: StyleId; colorMode: ColorMode; wrap: WrapId; resolution: ResId }

interface Gift extends GiftOptions {
  id: number; token: string; shareUrl: string;
  fromName: string; message: string|null; recipientEmail: string|null;
  status: 'created'|'sent'|'opened'|'expired'|'revoked';
  createdAt: string; expiresAt: string|null; revokedAt: string|null;
  firstOpenedAt: string|null; openCount: number;
  sentAt: string|null; sendStatus: 'ok'|'error'|null; sendError: string|null;
}
```

## Santé
| Méthode | Route | Rép. |
|---|---|---|
| GET | `/healthz` | `200 {ok:true}` |

## Auth admin
| Méthode | Route | Corps | Rép. |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `200` + cookie · `401` · `429` (rate-limit : 5/min/IP) |
| POST | `/api/auth/logout` | — | `204` |
| GET | `/api/me` | — | `200 {email}` · `401` |

## Admin (session requise ⇒ sinon `401`)
| Méthode | Route | Corps / Query | Rép. |
|---|---|---|---|
| GET | `/api/catalog` | — | liste bouquets, styles, couleurs, emballages, résolutions |
| GET | `/api/gifts` | `?status=&limit=&offset=` | `{items: Gift[], total}` |
| POST | `/api/gifts` | `GiftOptions & {fromName, message?, recipientEmail?, expiresInDays?}` | `201 Gift` |
| GET | `/api/gifts/:id` | — | `Gift` · `404` |
| POST | `/api/gifts/:id/revoke` | — | `Gift` (idempotent) |
| POST | `/api/gifts/:id/send` | `{recipientEmail?}` (sinon celui du cadeau) | `200 Gift` · `502 {error:'smtp_failed'}` |
| POST | `/api/mail/test` | `{to}` | `204` · `502` — vérifie la config SMTP |

Règles : `message` ≤ 500 car. (texte brut, jamais interprété en HTML) · `fromName` 1–60 car. · `recipientEmail` validé (format) · `expiresInDays` entier 0–365 (0 = jamais ; défaut `GIFT_TTL_DAYS`).

## Public (token)
| Méthode | Route | Rép. |
|---|---|---|
| GET | `/g/:token` | HTML de la page cadeau (toujours `200`, même pour un token invalide : la page affichera l'état neutre après l'appel API) |
| GET | `/api/public/gifts/:token` | `200 {bouquetId, style, colorMode, wrap, resolution, fromName, message, boxTaps}` · `404 {error:'unavailable'}` (inconnu, expiré **ou** révoqué — identique) |
| POST | `/api/public/gifts/:token/opened` | `204` (idempotent côté UI : appelé une fois) · `404` |

Jamais renvoyé côté public : `recipientEmail`, `id`, statuts internes.
En-têtes publics : `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`.

## Codes d'erreur
`invalid_input` · `unauthorized` · `rate_limited` · `not_found` · `unavailable` · `smtp_failed`
