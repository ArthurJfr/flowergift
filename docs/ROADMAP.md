# Roadmap — phases validables

Règle : **une phase = un livrable testable.** On ne passe à la suivante qu'après validation (cf. `CLAUDE.md`).
Chaque phase se termine par un commit `phase-N: …` et un tag git `phase-N`.

---
## Phase 0 — Squelette & Docker
**Faire**
- `npm init`, TypeScript strict, ESLint, Vitest, Vite ; structure `src/engine|server|web`.
- Fastify minimal : `GET /healthz` → `{ok:true}`, sert `dist/web` en statique.
- Migrations SQL au démarrage (table `schema_migrations` + `001_init.sql` vide).
- Utiliser `Dockerfile`, `compose.yaml` fournis.

**Accepté quand**
- [ ] `docker compose up --build` → `http://localhost:3000/healthz` répond 200
- [ ] `docker compose ps` montre l'app *healthy*
- [ ] `npm run lint && npm run test` verts (1 test bidon suffit)

---
## Phase 1 — Moteur ASCII (parité avec le prototype)
**Faire** (détails : [ENGINE.md](ENGINE.md))
- Porter le prototype en `src/engine` **sans DOM** : `renderFrame(state, t) → Grid`.
- Sérialiseurs : `toHtml(grid)`, `toText(grid)`, `toEmailHtml(grid)`.
- Catalogue des 6 bouquets en données (`catalog.ts`), pas en dur dans le rendu.
- Page de dev `/dev/engine` (dev uniquement) : même UI que le prototype.

**Accepté quand**
- [ ] Rendu visuellement équivalent au prototype pour les 6 bouquets × 6 styles
- [ ] Aucun import `window`/`document` dans `src/engine` (règle ESLint `no-restricted-globals`)
- [ ] Test snapshot : même `(bouquet, style, t, seed)` ⇒ même texte
- [ ] 30 fps tenus en résolution *Haute* sur ton PC

---
## Phase 2 — Auth admin + galerie
**Faire**
- `POST /api/auth/login` (argon2id, rate-limit), `logout`, `GET /api/me`, cookie de session (table `sessions`).
- Page `/admin` : écran de login puis **galerie** (grille de vignettes animées, ou liste + grand aperçu).
- Panneau d'options : style, couleurs, emballage, résolution (comme le prototype).

**Accepté quand**
- [ ] `/admin` sans session ⇒ écran login ; 5 mauvais mots de passe/min ⇒ 429
- [ ] Cookie `HttpOnly; Secure(prod); SameSite=Strict`
- [ ] Galerie fluide : 1 seul bouquet animé à la fois (les autres figés) pour économiser le CPU

---
## Phase 3 — Cadeaux & lien unique
**Faire**
- Migration `002_gifts.sql` (voir ARCHITECTURE).
- `POST /api/gifts` : bouquet + options + message + nom → renvoie `shareUrl`.
- Bouton « Générer un lien » + copier dans le presse-papiers ; liste de l'historique ; révocation.
- Route publique `GET /g/:token` (page minimale : affiche le bouquet directement, **sans boîte** pour l'instant) + `GET /api/public/gifts/:token`.
- Expiration (`GIFT_TTL_DAYS`) et réponse uniforme 404/410.

**Accepté quand**
- [ ] Lien ouvrable en navigation privée, sans login
- [ ] Token invalide / expiré / révoqué ⇒ même page neutre
- [ ] `opened_at` renseigné à la première ouverture, `open_count` incrémenté
- [ ] Aucune donnée perso (email destinataire) dans la réponse publique

---
## Phase 4 — Boîte à cadeau animée
**Faire** ([GIFTBOX.md](GIFTBOX.md))
- États : `idle` → `tapping` → `opening` → `revealed`.
- Idle autonome (rebond + frétillement aléatoire), N taps (`GIFT_BOX_TAPS`), ouverture + éclosion du bouquet + message.

**Accepté quand**
- [ ] Fonctionne au doigt (mobile) et à la souris ; zone de tap ≥ 48 px
- [ ] `prefers-reduced-motion` ⇒ animations réduites, ouverture toujours possible
- [ ] 60 % de fluidité minimum sur un téléphone milieu de gamme (sinon baisser la résolution auto)
- [ ] `POST /api/public/gifts/:token/opened` appelé une seule fois à l'ouverture

---
## Phase 5 — Envoi par mail (SMTP Google)
**Faire**
- Service `mailer` (Nodemailer) + `POST /api/gifts/:id/send` + `POST /api/mail/test`.
- Template HTML + texte brut : message, gros bouton vers le lien, aperçu ASCII statique (`toEmailHtml`).
- Statut d'envoi stocké (`sent_at`, `send_status`, `send_error`).
- Local : pas de serveur mail dans Compose ; les tests mockent le transport SMTP.

**Accepté quand**
- [ ] Mail de test reçu par le transport configuré, avec un lien fonctionnel
- [ ] Mail réel reçu sur Gmail **et** sur mobile (vérifier que l'aperçu ASCII reste lisible ; sinon masquer l'aperçu)
- [ ] Erreur SMTP ⇒ message clair dans l'UI, cadeau non marqué « envoyé »

---
## Phase 6 — Production
**Faire** ([DEPLOY.md](DEPLOY.md))
- DNS `flowergift` → VPS, `compose.prod.yaml` branché sur Traefik, certificat Let's Encrypt.
- En-têtes sécurité (helmet/CSP), `robots.txt` Disallow, `noindex`.
- Sauvegarde du volume SQLite (script cron `sqlite3 .backup`).

**Accepté quand**
- [ ] `https://flowergift.arthurjaffro.fr/g/<token>` fonctionne depuis un téléphone en 4G
- [ ] Note A sur securityheaders.com (ou équivalent proche)
- [ ] Restauration de sauvegarde testée une fois

---
## Phase 7 — Finitions (au choix)
- Aperçu OpenGraph (`og:image` généré par le moteur côté serveur, ou image fixe) pour que le lien soit joli dans WhatsApp/iMessage.
- Choix de l'animation d'ouverture, thèmes de boîte (couleur du papier/ruban).
- Envoi programmé (« envoyer demain 8h »).
- Statistiques simples (cadeaux envoyés / ouverts).
- Raccourcis clavier de la galerie (1–6, ←/→, espace).
