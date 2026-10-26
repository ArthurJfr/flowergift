# Moteur ASCII — porter le prototype

Source de vérité : [`reference/bouquet-prototype.html`](reference/bouquet-prototype.html) (un seul fichier, ~600 lignes de JS). Ce document explique **comment il fonctionne** et **comment le transformer** en module propre.

## Principe

Le rendu est **procédural** : aucune image ASCII figée. À chaque frame, on remplit une grille de cellules `{valeur 0‥1, couleur, caractère forcé?}` en évaluant des formules géométriques, puis un *style* convertit la valeur en caractère.

```
catalogue + état + temps t  ──►  renderFrame()  ──►  Grid (val, slot, ovr)  ──►  sérialiseur  ──►  HTML / texte / mail
```

## Concepts du prototype (à retrouver dans le code)

| Concept | Dans le prototype | Notes pour le portage |
|---|---|---|
| **Grille** | `COLS × ROWS` : 100×56 / 140×78 / 180×100 selon la résolution | Paramètre de `renderFrame`, pas une constante globale |
| **Unités de scène** | Hauteur totale = 100 ; une cellule fait `cellW = chw·S` × `cellH = S` (`S = 100/ROWS`) | `chw` = ratio largeur/hauteur d'un caractère monospace (~0,6). **Mesuré dans le DOM** dans le prototype ⇒ en TS : paramètre `charAspect` (défaut 0.6), la mesure reste côté web |
| **Buffers** | `val` (Float32), `slt` (couleur), `ovr` (caractère forcé : tiges, pétales) | Regrouper dans un type `Grid {cols, rows, val, slot, ovr}` |
| **Palette** | `SLOTS` = 16 couleurs `[teinte, sat, lum]` ; la luminosité varie selon `val` (5 niveaux `l0‥l4`) | Données dans `catalog.ts` |
| **Têtes de fleurs** | Fonctions `FN.rose/daisy/sun/tulip/orch/lav` : prennent `(u, w, t, head)` en repère local (rayon ≈ 1) et posent `oV`/`oS` | Les rendre **pures** : retourner `{v, slot}` ou `null` au lieu de variables globales `oV/oS` |
| **Remplissage** | `gyp` (gypsophile) = petits points ; `lav` = épis | idem |
| **Pose / vent** | `pose(h,t)` : balancement de la tête, courbe de Bézier quadratique pour la tige, vecteur « haut » de la fleur | Pure : `(head, t, wind, wrap) → HeadPose` |
| **Ordre de dessin** | feuillage → tiges + feuilles → remplissages → fleurs (triées par `y`) → emballage → pétales qui tombent | À conserver tel quel (c'est le « z-order ») |
| **Éclosion** | Chronologie `tb` : tige `ease((tb−d)/1.3)`, fleur `easeBack((tb−d−1)/1.1)`, papier 0–0.9 s, ruban dès 2.2 s | Le `tb` doit être un paramètre (la page cadeau le démarre à l'ouverture de la boîte) |
| **Anneau de séparation** | Dans `drawHead`, les cellules juste autour d'une fleur sont vidées (forme × 0.86) pour détacher les fleurs entre elles | À garder : c'est ce qui rend la lisibilité |
| **Styles** | `STYLES` : rampes de caractères (`classique`, `detail`, `blocs`) + modes `texte`, `binaire`, `contour` (détection de bord) | `contour` utilise les voisins ⇒ passe en post-traitement sur la grille |
| **Emballages** | `drawPaper` (cône + ruban + nœud), `drawVase`, `drawRibbon` | 3 fonctions, même signature |
| **Particules** | pétales qui tombent (`Math.random`) | ⚠ remplacer par le PRNG seedé |

## Cible d'API (suggestion)

```ts
// src/engine/index.ts
export interface RenderOptions {
  bouquetId: BouquetId; style: StyleId; wrap: WrapId;
  cols: number; rows: number;
  charAspect?: number;          // défaut 0.6
  wind?: number;                // 0‥2, défaut 1
  seed?: number;                // pour particules et placements → rendu déterministe
}
export interface Grid { cols: number; rows: number; val: Float32Array; slot: Uint8Array; ovr: Uint16Array }

export function createScene(opts: RenderOptions): Scene;          // pré-calcul (têtes, dots, fillers)
export function renderFrame(scene: Scene, t: number, tb: number, dt: number): Grid;

// src/engine/serialize.ts
export function toHtml(grid: Grid, o: { style: StyleId; colorMode: ColorMode; t: number }): string;   // <span class="s3 l2">…
export function toText(grid: Grid, o: { style: StyleId; t: number }): string;                         // texte brut (copier)
export function toEmailHtml(grid: Grid, o: { style: StyleId }): string;                               // styles INLINE (pas de classes CSS)
```

## Pièges connus

1. **Déterminisme** : le prototype appelle `Math.random()` pour les pétales ⇒ snapshot impossible. Utilise `mulberry32(seed)`.
2. **Largeur des caractères** : `░▒▓█`, `│╱╲` peuvent avoir une largeur différente selon la police de repli ⇒ garder une pile de polices monospace explicite (cf. `<pre>` du prototype).
3. **Performance** : l'ancien rendu reconstruit tout le `innerHTML` à chaque frame (regroupé en *runs* de même classe). Suffisant jusqu'à ~180×100 à 20 fps ; si besoin → `<canvas>` + `fillText`, mais on perd la sélection de texte.
4. **Galerie** : n'animer qu'un bouquet à la fois ; les autres = 1 frame statique (`toHtml` une seule fois).
5. **Mail** : les clients mail ignorent `<style>` et les variables CSS ⇒ `toEmailHtml` doit écrire `style="color:#rrggbb"` sur chaque `<span>` (convertir HSL → hex, appliquer le niveau de luminosité). Garder l'aperçu petit (≈ 100 colonnes max) et fournir un fallback texte.

## Tests

- `renderFrame(createScene({bouquetId:'roses', style:'classique', cols:100, rows:56, seed:1}), t=6, tb=6)` → `toText` → **snapshot** (un par bouquet).
- Test d'import : aucun fichier de `src/engine` ne référence `window`, `document`, `navigator`.
