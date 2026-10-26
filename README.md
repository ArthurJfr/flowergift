# 🌸 FlowerGift

Tableau de bord **privé** pour composer des bouquets en ASCII art animé, puis les offrir :

- **par mail** (SMTP Google) à la personne de ton choix ;
- ou via **un lien unique** → la personne tombe sur une **boîte à cadeau** qui bouge toute seule ; après quelques taps/clics elle s'ouvre et le bouquet éclot.

Domaine : `https://flowergift.arthurjaffro.fr` · Docker en local **et** en production.

> Prototype visuel de référence (moteur ASCII déjà fonctionnel) : [`docs/reference/bouquet-prototype.html`](docs/reference/bouquet-prototype.html) — à ouvrir dans un navigateur.

## Fonctionnalités (MVP)

| # | Fonctionnalité | Détail |
|---|---|---|
| 1 | Galerie privée | 6 bouquets (Roses, Tulipes, Marguerites, Tournesols, Orchidées, Champêtre) × 6 styles ASCII × 4 modes couleur × 3 emballages × 3 résolutions |
| 2 | Composer un cadeau | Choix du bouquet + options visuelles + message perso + nom d'expéditeur |
| 3 | Lien unique | Token aléatoire 128 bits → `https://flowergift.arthurjaffro.fr/g/<token>` ; expiration et révocation |
| 4 | Envoi par mail | Via SMTP Gmail (mot de passe d'application) ; le mail contient le lien + un aperçu statique |
| 5 | Page cadeau | Boîte animée → tap ×N → ouverture → bouquet qui éclot → message |
| 6 | Historique | Liste des cadeaux : envoyé / ouvert (date) / expiré / révoqué |

Hors périmètre MVP : comptes multiples, paiement, upload d'images, statistiques avancées.

## Stack (proposée — voir [ARCHITECTURE](docs/ARCHITECTURE.md) pour les justifications)

- **Node 22 + TypeScript**, **Fastify 5** (serveur HTTP/API)
- **SQLite** (`better-sqlite3`) dans un volume Docker — suffisant pour un usage perso
- **Vite + TypeScript vanilla** pour le front (admin + page cadeau), sans framework
- **Moteur ASCII sans DOM** partagé serveur/navigateur (`src/engine`) — permet de générer l'aperçu du mail côté serveur
- **Nodemailer** → `smtp.gmail.com`
- **Docker Compose** (local sur Docker Desktop ; prod : labels Traefik)

## Démarrage rapide (une fois le code écrit)

```bash
cp .env.example .env            # puis remplir (voir docs/DEPLOY.md pour le hash du mot de passe)
docker compose up --build       # app: http://localhost:3000  ·  moteur: http://localhost:3000/dev/engine
```

Admin : `http://localhost:3000/admin` · Page cadeau : `http://localhost:3000/g/<token>`

## Documentation

| Fichier | Contenu |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Règles de travail pour Claude Code sur ce repo |
| [docs/ROADMAP.md](docs/ROADMAP.md) | **Plan par phases validables** avec critères d'acceptation — commence ici |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure du repo, modèle de données, flux |
| [docs/API.md](docs/API.md) | Contrat des endpoints |
| [docs/ENGINE.md](docs/ENGINE.md) | Comment porter le prototype en module TypeScript propre |
| [docs/GIFTBOX.md](docs/GIFTBOX.md) | Spec de la boîte à cadeau animée |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, tokens, SMTP, durcissement |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Docker local, prod VPS + Traefik, DNS, mail Gmail |

## Licence

Projet personnel — usage privé.
