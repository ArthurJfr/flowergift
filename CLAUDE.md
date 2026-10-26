# CLAUDE.md — FlowerGift

Lis d'abord `README.md`, puis `docs/ROADMAP.md`. Le prototype visuel est `docs/reference/bouquet-prototype.html` (source de vérité du rendu).

## But du projet
Dashboard privé (admin unique) pour visualiser des bouquets ASCII animés, en offrir un par **mail (SMTP Gmail)** ou par **lien unique** menant à une **boîte à cadeau animée** qui s'ouvre après quelques taps. Domaine : `flowergift.arthurjaffro.fr`. Docker local + prod.

## Façon de travailler
- **Planifier avant de coder** : annonce en 5 lignes max ce que tu vas faire, puis fais-le.
- **Une phase de `docs/ROADMAP.md` à la fois.** À la fin d'une phase : lance les vérifications, résume en 3 lignes, **attends la validation** avant de passer à la suivante.
- Livrables concis : pas de commentaires bavards, pas de refactor hors périmètre.
- Commandes **copier-coller** dans les explications ; termes techniques anglais expliqués en français entre parenthèses si nouveaux.
- Demande avant d'ajouter une dépendance hors liste de `docs/ARCHITECTURE.md`.

## Stack & commandes
Node 22 · TypeScript strict · Fastify 5 · SQLite (`better-sqlite3`) · Vite (vanilla TS) · Nodemailer · Vitest.

```bash
npm run dev            # serveur (tsx watch) + vite en parallèle
npm run build          # vite build + tsc
npm run test           # vitest
npm run lint           # eslint + tsc --noEmit
docker compose up --build            # local
docker compose -f compose.prod.yaml up -d --build   # prod (VPS)
```

## Structure (cible)
```
src/engine/   moteur ASCII SANS DOM (partagé serveur + navigateur)
src/server/   Fastify : routes/, services/, db/ (migrations SQL), config.ts
src/web/      admin/ (dashboard) · gift/ (page cadeau) · shared/
data/         SQLite (volume Docker, jamais commité)
```

## Règles non négociables
1. **`src/engine` n'importe jamais `window`/`document`.** Il produit une grille de cellules ; `toHtml`, `toText`, `toEmailHtml` sont des sérialiseurs séparés.
2. **Aucun secret dans le repo** : tout passe par `.env` (ignoré par git). Maintenir `.env.example` à jour.
3. **Tokens de partage** : `crypto.randomBytes(16).toString('base64url')`, jamais `Math.random`, jamais d'ID séquentiel dans une URL publique.
4. **Réponses publiques uniformes** : token inconnu / expiré / révoqué ⇒ même page neutre (pas d'énumération). Ne jamais exposer l'email du destinataire côté public.
5. **Validation d'entrée** avec zod sur tous les endpoints ; requêtes SQL paramétrées uniquement.
6. **Admin** : cookie `HttpOnly; Secure; SameSite=Strict`, rate-limit sur le login, hash `argon2id`.
7. Respecter `prefers-reduced-motion` sur la page cadeau.
8. Pas de tracking pixel dans les mails ; l'ouverture est détectée côté page cadeau.

## Tests attendus
- Moteur : snapshot d'une frame (bouquet × style) à `t` fixe → déterministe (pas de `Math.random` dans le rendu, utiliser le PRNG seedé).
- API : login/logout, création de cadeau, accès token valide/expiré/révoqué, envoi mail (transport SMTP mocké dans les tests).
- Docker : `docker compose up` doit démarrer sans étape manuelle autre que `.env`.

## Hors périmètre
Multi-utilisateurs, paiement, uploads, i18n (FR uniquement), analytics.
