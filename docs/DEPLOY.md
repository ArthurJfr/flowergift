# Déploiement

## 1. Local (Docker)

```bash
cp .env.example .env
# 1) hash du mot de passe admin (voir §3) → ADMIN_PASSWORD_HASH
# 2) secret de session
openssl rand -base64 48            # → SESSION_SECRET
docker compose up --build
```

- App : http://localhost:3000 (admin : `/admin`, moteur : `/dev/engine` tant que `NODE_ENV` n'est pas `production`)
- Données : `./data/flowergift.db`
- Réinitialiser : `docker compose down && rm -rf data`

Le Compose local ne démarre pas de serveur mail. Les envois SMTP arriveront avec la phase courrier, via les variables `SMTP_*` du `.env`.

## 2. Production (VPS + Traefik existant)

### 2.1 DNS
Chez ton registrar (OVH) : enregistrement **A** `flowergift` → IP de ton VPS (`51.91.99.75` — vérifie avec `curl -4 ifconfig.me` depuis le VPS).
Vérifier la propagation : `dig +short flowergift.arthurjaffro.fr`

> ⚠ Si ton domaine est en réalité `arthurjfr.fr`, change `APP_DOMAIN` dans `.env` : tout le reste suit (`BASE_URL`, règle Traefik).

### 2.2 Récupérer les noms de ta config Traefik
`compose.prod.yaml` suppose : réseau `traefik`, entrypoint `websecure`, certresolver `letsencrypt`. Vérifie :
```bash
docker ps --format '{{.Names}}' | grep -i traefik
docker inspect <nom-traefik> --format '{{json .NetworkSettings.Networks}}' | jq 'keys'
docker inspect <nom-traefik> --format '{{json .Args}}' | tr ',' '\n' | grep -iE "entrypoints|certificatesresolvers"
```
Adapte le réseau (`networks:`), `entrypoints` et `tls.certresolver` si besoin.

### 2.3 Déployer
```bash
ssh <vps>
git clone <ton-repo> ~/flowergift && cd ~/flowergift
cp .env.example .env && chmod 600 .env     # remplir : APP_DOMAIN, ADMIN_*, SESSION_SECRET, SMTP_*
docker compose -f compose.prod.yaml up -d --build
docker compose -f compose.prod.yaml logs -f app
```
Contrôles :
```bash
curl -I https://flowergift.arthurjaffro.fr/healthz     # 200 + certificat valide
docker compose -f compose.prod.yaml ps                 # (healthy)
```

### 2.4 Mise à jour
```bash
cd ~/flowergift && git pull && docker compose -f compose.prod.yaml up -d --build
```
Les migrations SQL s'appliquent au démarrage ; le volume `flowergift-data` est conservé.

### 2.5 Sauvegarde du volume SQLite
```bash
# sauvegarde cohérente à chaud
docker compose -f compose.prod.yaml exec app node -e "
const D=require('better-sqlite3');const db=new D('/data/flowergift.db');
db.backup('/data/backup.db').then(()=>console.log('ok'))"
docker cp $(docker compose -f compose.prod.yaml ps -q app):/data/backup.db ~/backups/flowergift-$(date +%F).db
```
À mettre dans un cron quotidien (`crontab -e`) + purge des sauvegardes de plus de 14 jours.

### 2.6 Durcissement optionnel de l'admin
Ajouter un 2ᵉ routeur Traefik plus prioritaire sur `PathPrefix(/admin) || PathPrefix(/api/auth)` avec un middleware BasicAuth ou `ipallowlist` (ex. plage Tailscale), pour que l'admin ne soit joignable que de chez toi. `/g/*` et `/api/public/*` restent publics.

## 3. Générer le hash du mot de passe admin

Sans rien installer (via Docker) :
```bash
docker run --rm -it node:22-slim sh -c "npm i --silent @node-rs/argon2 >/dev/null 2>&1 && node -e \"
const {hash}=require('@node-rs/argon2');
const p=process.argv[1];
hash(p,{algorithm:2}).then(console.log)\" 'TonMotDePasseSolide'"
```
Colle le résultat dans `ADMIN_PASSWORD_HASH`. Le hash contient des `$` : dans un `.env` lu par Docker Compose, **mets-le entre quotes simples** (`ADMIN_PASSWORD_HASH='$argon2id$v=19$…'`) ou double chaque `$`.

## 4. Mail Gmail (SMTP)

1. Compte Google ⇒ activer la **validation en 2 étapes**.
2. https://myaccount.google.com/apppasswords → créer un mot de passe d'application « FlowerGift » (16 caractères, sans espaces) → `SMTP_PASS`.
3. `.env` :
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=ton.compte@gmail.com
   SMTP_FROM_EMAIL=ton.compte@gmail.com
   ```
4. Tester depuis le dashboard (`POST /api/mail/test`) avant le premier vrai envoi.
5. Envoyer depuis une adresse `@arthurjaffro.fr` ? Dans Gmail → Paramètres → Comptes → « Envoyer des e-mails en tant que » (alias validé), puis `SMTP_FROM_EMAIL=<alias>`. Pense à SPF/DKIM du domaine si tu sors de Gmail.

**Plan B** si Google bloque les mots de passe d'application (compte Workspace restreint) : OAuth2 Nodemailer (client ID + refresh token) ou relais dédié (Brevo/Resend/Mailjet, gratuit à ce volume).

## 5. Dépannage rapide

| Symptôme | Piste |
|---|---|
| 404 Traefik | Mauvais `Host`/réseau ; `docker compose logs traefik`, vérifier `traefik.docker.network` |
| Certificat invalide | DNS pas encore propagé, ou certresolver mal nommé |
| `535 Username and Password not accepted` | Mot de passe d'application absent/erroné, ou espaces dans `SMTP_PASS` |
| `SQLITE_CANTOPEN` | Permissions du volume `/data` (utilisateur `node`, uid 1000) |
| Login admin impossible | Hash tronqué par le `$` dans `.env` → quotes simples |
| Lien de partage en `http://localhost` | `BASE_URL` mal défini en prod |
