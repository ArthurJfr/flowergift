# Sécurité

Modèle de menace : **un seul admin (toi)**, des liens publics « secrets » partagés à des proches. Pas de données sensibles, mais : ton compte Gmail est en jeu (SMTP) et l'adresse email des destinataires est une donnée perso.

## Admin
- Mot de passe stocké en **argon2id** (variable `ADMIN_PASSWORD_HASH`, jamais en clair). Aucune inscription possible.
- Session : identifiant aléatoire 256 bits ; **seul son hash SHA-256** est stocké en base ; cookie `HttpOnly; Secure; SameSite=Strict; Path=/`.
- Login : rate-limit (5/min/IP + délai constant), message d'erreur unique « identifiants invalides ».
- CSRF : `SameSite=Strict` + vérification des en-têtes `Origin`/`Host` sur toutes les requêtes mutantes (`POST/DELETE`).
- Durée de session `SESSION_TTL_HOURS` (défaut 72 h), invalidation au logout.
- Optionnel (durcissement) : protéger `/admin` et `/api/*` (hors `/api/public`) par une 2ᵉ barrière Traefik (BasicAuth ou allowlist IP/Tailscale) — voir DEPLOY.md.

## Liens de partage
- Token = 128 bits aléatoires (`randomBytes(16)`, base64url, 22 caractères) ⇒ non devinable.
- **Réponse identique** pour inconnu / expiré / révoqué (pas d'énumération) + rate-limit par IP sur `/api/public/*` (ex. 30/min).
- Expiration par défaut 30 jours, révocation immédiate depuis le dashboard.
- Page publique : `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` (le token ne fuite pas vers des tiers). `robots.txt` : `Disallow: /`.
- Ne jamais mettre le token dans les logs : logger `/g/:token` en `/g/[redacted]`.
- Le destinataire peut transférer le lien : le lien est un secret *partagé*, pas une authentification. À expliquer dans l'UI (« toute personne ayant le lien peut voir le cadeau »).

## Entrées utilisateur
- zod sur chaque route ; SQL paramétré uniquement (`better-sqlite3` `prepare`).
- `message` et `fromName` : texte brut. Côté page cadeau → `textContent`, **jamais** `innerHTML`. Côté mail → échapper le HTML avant insertion dans le template.
- Limites : message 500 car., nom 60 car., corps de requête 16 ko.

## SMTP / Gmail
- Utiliser un **mot de passe d'application** (compte avec 2FA) — jamais le mot de passe du compte. Le révoquer dans le compte Google en cas de fuite.
- `SMTP_PASS` uniquement dans `.env` (prod : droits `600`, hors git) ; ne jamais logger la config SMTP.
- Limites Gmail : ~500 destinataires/jour (compte perso). Le dashboard peut afficher un compteur d'envois du jour et refuser au-delà de ~100.
- `From` = ton compte ou un alias « Envoyer en tant que » validé ; sinon Gmail réécrit l'expéditeur.
- Pas de pixel de tracking ; l'ouverture = ouverture de la page cadeau.

## En-têtes & transport
- HTTPS via Traefik/Let's Encrypt ; redirection HTTP→HTTPS.
- `@fastify/helmet` : CSP stricte (`default-src 'self'`; `style-src 'self'` — les couleurs passent par classes CSS, pas de style inline ⇒ penser aux `<span class="sN lN">`), `frame-ancestors 'none'`, HSTS.
- Pas de CORS (même origine).

## Docker
- Conteneur en utilisateur non-root (`USER node`) — déjà dans le Dockerfile.
- Volume `/data` seul en écriture ; pas de ports exposés en prod (Traefik via réseau interne).
- `.env` jamais copié dans l'image (`.dockerignore`).

## Données perso (RGPD, version simple)
- Email destinataire conservé pour l'historique ; ajouter une purge : suppression de `recipient_email` 90 jours après envoi (tâche au démarrage + quotidienne).
- Bouton « Supprimer » dans l'historique (suppression définitive d'un cadeau).

## Checklist avant mise en prod
- [ ] `SESSION_SECRET` ≥ 48 octets aléatoires, `ADMIN_PASSWORD_HASH` généré
- [ ] Mot de passe d'application Gmail créé, test d'envoi OK
- [ ] `/healthz` seul endpoint non authentifié hors `/g` et `/api/public`
- [ ] Token inconnu/expiré/révoqué ⇒ réponses identiques (test automatique)
- [ ] Aucun secret dans l'historique git (`git log -p | grep -i pass`)
- [ ] Sauvegarde du volume testée
