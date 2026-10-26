# Boîte à cadeau animée (page `/g/:token`)

Objectif : la personne reçoit un lien, voit une **boîte qui s'agite toute seule** (elle comprend qu'il faut la toucher), tape dessus quelques fois, la boîte **s'ouvre**, le **bouquet éclot**, puis le **message** apparaît.

## Machine à états

```
loading ──(API ok)──► idle ──tap──► tapping ──(taps ≥ N)──► opening ──(~1.2 s)──► revealed
   │                    ▲             │
   └─(API 404)► unavailable           └──(inactif 2.5 s)──► idle
```

| État | Comportement |
|---|---|
| `loading` | Boîte neutre, pas d'animation (évite un flash) |
| `unavailable` | Page neutre : « Ce cadeau n'est plus disponible » (identique pour inconnu / expiré / révoqué) |
| `idle` | Rebond doux continu (≈ 0,8 Hz, ±3 % de hauteur) + **frétillement** (rotation ±4°, 0,5 s) tous les 2–3,5 s (aléatoire) + invite discrète « Touche-moi » après ~4 s |
| `tapping` | Chaque tap : secousse plus forte, petite bouffée de pétales, compteur interne `taps++`. L'intensité croît avec `taps/N`. **Ne pas afficher le compteur** (surprise) — au mieux un indice visuel (ruban qui se desserre) |
| `opening` | Le couvercle s'envole (translation + rotation), confettis/pétales, la boîte s'efface ; le bouquet **démarre sa chronologie d'éclosion** (`tb = 0`) |
| `revealed` | Bouquet animé en continu (vent), message + « De la part de *fromName* » en fondu, bouton discret « Rejouer l'ouverture » |

`N` = `boxTaps` renvoyé par l'API (défaut `GIFT_BOX_TAPS=5`). Si le destinataire ne tape pas, rien ne s'ouvre (pas d'ouverture automatique).

## Appel API

À l'entrée dans `opening`, **une seule fois** : `POST /api/public/gifts/:token/opened` (ignorer l'échec : ne jamais bloquer l'animation).

## Rendu : deux options

**A (recommandée) — la boîte est dessinée par le même moteur ASCII** : même grille, mêmes styles (la boîte adopte le style choisi pour le bouquet), cohérence totale. Éléments : corps (rectangle avec ombrage latéral), ruban en croix, nœud (réutiliser `bow()` de l'emballage papier), couvercle (rectangle séparé, déplaçable). Animation = décalages `dx/dy` et petite rotation par cisaillement de colonnes.

**B (plan de secours) — SVG/CSS** : boîte vectorielle + CSS animations ; à l'ouverture, on bascule vers le `<pre>` du bouquet. Plus rapide à faire, moins « signature ».

Commence par **B** si tu veux valider la mécanique (états, taps, API) avant d'investir dans A.

## UX / accessibilité

- Zone de tap = **toute la boîte**, minimum 48×48 px ; `touch-action: manipulation` ; pas de zoom au double-tap.
- Clavier : `Entrée`/`Espace` = tap (la boîte est un `<button>` avec `aria-label="Boîte à cadeau, touche pour ouvrir"`).
- `prefers-reduced-motion: reduce` : pas de rebond ni de frétillement ; secousse remplacée par un simple changement de teinte ; l'ouverture reste possible, fondu simple.
- Retour haptique optionnel : `navigator.vibrate?.(15)` à chaque tap, `[30,40,60]` à l'ouverture.
- Mobile d'abord (la plupart des destinataires ouvriront le lien sur téléphone) : résolution *Standard* par défaut si `window.innerWidth < 600`, *Haute* sinon.
- Son : aucun par défaut (éviter la surprise en public).

## Critères de réussite

- Un destinataire qui n'a jamais vu la page comprend **sans explication** qu'il doit toucher la boîte.
- Ouverture en 3–6 taps ; aucune action requise après.
- Fonctionne sur iOS Safari, Android Chrome, Firefox/Chrome desktop.
