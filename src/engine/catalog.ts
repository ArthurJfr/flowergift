export const SLOT = {
  red: 0,
  pink: 1,
  peach: 2,
  yellow: 3,
  white: 4,
  violet: 5,
  blue: 6,
  orange: 7,
  leaf: 8,
  stem: 9,
  brown: 10,
  kraft: 11,
  ribbon: 12,
  glass: 13,
  lav: 14,
  coral: 15,
} as const;

/** [teinte, saturation %, luminosité %] */
export const SLOTS: readonly (readonly [number, number, number])[] = [
  [350, 78, 52],
  [332, 72, 66],
  [18, 88, 70],
  [48, 96, 58],
  [40, 22, 90],
  [275, 58, 66],
  [212, 78, 66],
  [28, 96, 56],
  [128, 52, 44],
  [105, 42, 38],
  [26, 60, 34],
  [34, 46, 62],
  [352, 86, 52],
  [192, 48, 68],
  [255, 55, 72],
  [8, 85, 62],
];

export const LEVEL_M = [0.55, 0.75, 0.95, 1.1, 1.28] as const;

export type BouquetId =
  | 'roses'
  | 'tulipes'
  | 'marguerites'
  | 'tournesols'
  | 'orchidees'
  | 'champetre';

export type StyleId = 'classique' | 'detail' | 'blocs' | 'texte' | 'binaire' | 'contour';
export type ColorMode = 'color' | 'mono-green' | 'mono-amber' | 'mono-white';
export type WrapId = 'paper' | 'vase' | 'ribbon';
export type ResolutionId = 'standard' | 'high' | 'ultra';
export type FlowerKind = 'rose' | 'daisy' | 'sun' | 'tulip' | 'orch' | 'lav' | 'gyp';

export interface HeadSource {
  k: FlowerKind;
  x: number;
  y: number;
  R: number;
  s: number;
  /** Lèvre des orchidées, quand la palette est un duo. */
  lip?: number;
}

export interface BouquetDef {
  id: BouquetId;
  name: string;
  heads: readonly HeadSource[];
  foliage: readonly (readonly [number, number, number])[];
  leafL?: number;
}

export interface StyleDef {
  id: StyleId;
  name: string;
  ramp?: string;
  kind?: 'text' | 'bin' | 'edge';
  stem: string;
  part: string;
}

export interface ColorModeDef {
  id: ColorMode;
  name: string;
}

export interface WrapDef {
  id: WrapId;
  name: string;
  endK: number;
  endY: number;
  anchorY: number;
}

export interface ResolutionDef {
  id: ResolutionId;
  name: string;
  cols: number;
  rows: number;
}

const H = (k: FlowerKind, x: number, y: number, R: number, s: number): HeadSource => ({ k, x, y, R, s });

export const BOUQUETS: readonly BouquetDef[] = [
  {
    id: 'roses',
    name: 'Roses',
    heads: [
      H('rose', 0, 24, 11, SLOT.red),
      H('rose', -16, 30, 9.5, SLOT.pink),
      H('rose', 16, 31, 9.5, SLOT.coral),
      H('rose', -30, 40, 8.5, SLOT.red),
      H('rose', 30, 41, 8.5, SLOT.pink),
      H('rose', -8, 42, 8, SLOT.peach),
      H('rose', 9, 44, 8, SLOT.white),
      H('rose', 0, 50, 7.5, SLOT.red),
      H('gyp', -38, 22, 5, SLOT.white),
      H('gyp', 38, 20, 5, SLOT.white),
      H('gyp', -24, 14, 4.5, SLOT.white),
      H('gyp', 24, 13, 4.5, SLOT.white),
      H('gyp', 0, 8, 4.5, SLOT.white),
      H('gyp', -42, 38, 4, SLOT.white),
      H('gyp', 42, 36, 4, SLOT.white),
    ],
    foliage: [
      [-0.7, 24, 5],
      [0.7, 24, 5],
      [-1.15, 22, 4.4],
      [1.15, 22, 4.4],
      [-0.25, 20, 4.2],
      [0.3, 20, 4.2],
    ],
  },
  {
    id: 'tulipes',
    name: 'Tulipes',
    heads: [
      H('tulip', 0, 14, 8, SLOT.red),
      H('tulip', -18, 18, 7.5, SLOT.yellow),
      H('tulip', 18, 20, 7.5, SLOT.pink),
      H('tulip', -32, 28, 7, SLOT.violet),
      H('tulip', 32, 30, 7, SLOT.white),
      H('tulip', -8, 36, 6.5, SLOT.orange),
      H('tulip', 10, 38, 6.5, SLOT.coral),
    ],
    foliage: [
      [-0.85, 28, 4.2],
      [0.85, 28, 4.2],
      [-1.35, 24, 3.6],
      [1.35, 24, 3.6],
    ],
    leafL: 22,
  },
  {
    id: 'marguerites',
    name: 'Marguerites',
    heads: [
      H('daisy', 0, 20, 8, SLOT.white),
      H('daisy', -18, 26, 7, SLOT.white),
      H('daisy', 18, 25, 7, SLOT.white),
      H('daisy', -34, 34, 6.5, SLOT.pink),
      H('daisy', 34, 33, 6.5, SLOT.white),
      H('daisy', -8, 38, 6.5, SLOT.white),
      H('daisy', 10, 40, 6.5, SLOT.peach),
      H('daisy', -24, 46, 6, SLOT.white),
      H('daisy', 24, 47, 6, SLOT.pink),
      H('gyp', -42, 18, 4.5, SLOT.white),
      H('gyp', 42, 16, 4.5, SLOT.white),
      H('gyp', -12, 10, 4, SLOT.white),
      H('gyp', 14, 9, 4, SLOT.white),
      H('gyp', 0, 8, 4, SLOT.white),
    ],
    foliage: [
      [-0.45, 18, 3.4],
      [0.45, 18, 3.4],
      [-0.95, 16, 3],
      [0.95, 16, 3],
    ],
  },
  {
    id: 'tournesols',
    name: 'Tournesols',
    heads: [
      H('sun', -6, 20, 13.5, SLOT.yellow),
      H('sun', 20, 32, 12, SLOT.orange),
      H('sun', -24, 42, 10.5, SLOT.yellow),
      H('sun', 8, 50, 9, SLOT.yellow),
    ],
    foliage: [
      [-0.9, 30, 7.5],
      [0.9, 30, 7.5],
      [-1.4, 26, 6.5],
      [1.4, 26, 6.5],
      [-0.2, 24, 6],
      [0.25, 24, 6],
    ],
    leafL: 20,
  },
  {
    id: 'orchidees',
    name: 'Orchidées',
    heads: [
      H('orch', -4, 16, 8.5, SLOT.white),
      H('orch', 18, 28, 8, SLOT.violet),
      H('orch', -22, 36, 7.5, SLOT.pink),
      H('orch', 6, 48, 7.5, SLOT.lav),
      H('gyp', 32, 18, 3.5, SLOT.white),
      H('gyp', -34, 22, 3.5, SLOT.pink),
      H('gyp', 28, 44, 3, SLOT.violet),
    ],
    foliage: [
      [-0.4, 26, 4.5],
      [0.45, 26, 4.5],
      [-0.9, 22, 4],
      [0.95, 22, 4],
    ],
    leafL: 18,
  },
  {
    id: 'champetre',
    name: 'Champêtre',
    heads: [
      H('lav', -36, 16, 6, SLOT.lav),
      H('lav', 38, 18, 6, SLOT.violet),
      H('lav', -24, 22, 5.2, SLOT.lav),
      H('lav', 26, 24, 5.2, SLOT.blue),
      H('daisy', -8, 28, 7, SLOT.white),
      H('daisy', 12, 34, 6.5, SLOT.blue),
      H('daisy', -30, 42, 6, SLOT.white),
      H('daisy', 32, 44, 6, SLOT.peach),
      H('rose', 0, 46, 8, SLOT.coral),
      H('tulip', -14, 52, 6.2, SLOT.yellow),
      H('tulip', 16, 54, 6, SLOT.red),
      H('gyp', -44, 34, 4.5, SLOT.white),
      H('gyp', 46, 32, 4.5, SLOT.white),
      H('gyp', -6, 12, 4, SLOT.white),
      H('gyp', 8, 10, 4, SLOT.white),
      H('gyp', 0, 58, 3.5, SLOT.white),
    ],
    foliage: [
      [-0.55, 22, 4.5],
      [0.55, 22, 4.5],
      [-1.05, 20, 4],
      [1.05, 20, 4],
      [-0.2, 18, 4],
      [0.25, 18, 4],
    ],
  },
];

export const STYLES: readonly StyleDef[] = [
  { id: 'classique', name: 'Classique', ramp: ' .:-=+*#%@', stem: '|/\\', part: '*' },
  {
    id: 'detail',
    name: 'Détaillé',
    ramp: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    stem: '|/\\',
    part: 'o',
  },
  { id: 'blocs', name: 'Blocs', ramp: ' ░▒▓█', stem: '│╱╲', part: '▒' },
  { id: 'texte', name: 'Texte', kind: 'text', stem: '|/\\', part: '*' },
  { id: 'binaire', name: 'Binaire', kind: 'bin', stem: '|/\\', part: '1' },
  { id: 'contour', name: 'Contour', kind: 'edge', stem: '|/\\', part: 'o' },
];

export const COLOR_MODES: readonly ColorModeDef[] = [
  { id: 'color', name: 'Couleurs' },
  { id: 'mono-green', name: 'Terminal' },
  { id: 'mono-amber', name: 'Ambre' },
  { id: 'mono-white', name: 'Blanc' },
];

export const WRAPS: readonly WrapDef[] = [
  { id: 'paper', name: 'Papier', endK: 0.3, endY: 74, anchorY: 70 },
  { id: 'vase', name: 'Vase', endK: 0.26, endY: 90, anchorY: 67 },
  { id: 'ribbon', name: 'Ruban', endK: 0.1, endY: 93, anchorY: 80 },
];

export const RESOLUTIONS: readonly ResolutionDef[] = [
  { id: 'standard', name: 'Standard', cols: 100, rows: 56 },
  { id: 'high', name: 'Haute', cols: 140, rows: 78 },
  { id: 'ultra', name: 'Ultra', cols: 180, rows: 100 },
];

export const SHAPE_EXTENT: Record<Exclude<FlowerKind, 'gyp'>, number> = {
  orch: 1.2,
  rose: 1.08,
  daisy: 1.08,
  sun: 1.16,
  tulip: 1.55,
  lav: 2.85,
};

export interface PaletteDef {
  id: string;
  name: string;
  /** Absent : on garde les couleurs dessinées dans le bouquet. */
  colors?: readonly number[];
  /** Orchidées : pétales et lèvre échangent les deux teintes d'une fleur à l'autre. */
  duo?: boolean;
}

export const PALETTES: Record<BouquetId, readonly PaletteDef[]> = {
  roses: [
    { id: 'origine', name: 'Varié' },
    { id: 'rouge-rose', name: 'Rouge & rose', colors: [SLOT.red, SLOT.pink] },
    { id: 'blanc-rose', name: 'Blanc & rose', colors: [SLOT.white, SLOT.pink] },
    { id: 'corail-peche', name: 'Corail & pêche', colors: [SLOT.coral, SLOT.peach] },
    { id: 'rouge-blanc', name: 'Rouge & blanc', colors: [SLOT.red, SLOT.white] },
    { id: 'peche-blanc', name: 'Pêche & blanc', colors: [SLOT.peach, SLOT.white] },
  ],
  tulipes: [
    { id: 'origine', name: 'Jardin' },
    { id: 'rouge-jaune', name: 'Rouge & jaune', colors: [SLOT.red, SLOT.yellow] },
    { id: 'rose-blanc', name: 'Rose & blanc', colors: [SLOT.pink, SLOT.white] },
    { id: 'violet-blanc', name: 'Violet & blanc', colors: [SLOT.violet, SLOT.white] },
    { id: 'orange-jaune', name: 'Orange & jaune', colors: [SLOT.orange, SLOT.yellow] },
  ],
  marguerites: [
    { id: 'origine', name: 'Mélange' },
    { id: 'blanc', name: 'Blanc', colors: [SLOT.white] },
    { id: 'rose-blanc', name: 'Rose & blanc', colors: [SLOT.pink, SLOT.white] },
    { id: 'peche-blanc', name: 'Pêche & blanc', colors: [SLOT.peach, SLOT.white] },
  ],
  tournesols: [
    { id: 'origine', name: 'Soleil' },
    { id: 'jaune', name: 'Jaune', colors: [SLOT.yellow] },
    { id: 'orange-jaune', name: 'Orange & jaune', colors: [SLOT.orange, SLOT.yellow] },
  ],
  orchidees: [
    { id: 'origine', name: 'Varié' },
    { id: 'rose-blanc', name: 'Rose & blanc', colors: [SLOT.pink, SLOT.white], duo: true },
    { id: 'violet-blanc', name: 'Violet & blanc', colors: [SLOT.violet, SLOT.white], duo: true },
    { id: 'lavande-blanc', name: 'Lavande & blanc', colors: [SLOT.lav, SLOT.white], duo: true },
    { id: 'corail-blanc', name: 'Corail & blanc', colors: [SLOT.coral, SLOT.white], duo: true },
    { id: 'peche-rose', name: 'Pêche & rose', colors: [SLOT.peach, SLOT.pink], duo: true },
    { id: 'violet-rose', name: 'Violet & rose', colors: [SLOT.violet, SLOT.pink], duo: true },
  ],
  champetre: [
    { id: 'origine', name: 'Mélange' },
    { id: 'lavande-blanc', name: 'Lavande & blanc', colors: [SLOT.lav, SLOT.white] },
    { id: 'bleu-blanc', name: 'Bleu & blanc', colors: [SLOT.blue, SLOT.white] },
    { id: 'rose-peche', name: 'Rose & pêche', colors: [SLOT.pink, SLOT.peach] },
  ],
};

export function isPalette(bouquetId: BouquetId, id: string): boolean {
  return PALETTES[bouquetId].some((palette) => palette.id === id);
}

export function normalizePalette(bouquetId: BouquetId, id: string | undefined): string {
  return id && isPalette(bouquetId, id) ? id : 'origine';
}

export function paletteSwatches(bouquetId: BouquetId, paletteId: string): readonly number[] {
  const palette = PALETTES[bouquetId].find((item) => item.id === paletteId);
  if (palette?.colors) return palette.colors;
  const seen: number[] = [];
  for (const head of bouquetById(bouquetId).heads) {
    if (head.k === 'gyp' || seen.includes(head.s)) continue;
    seen.push(head.s);
  }
  return seen;
}

function lighterSlot(colors: readonly number[]): number {
  let best = colors[0] ?? SLOT.white;
  let light = SLOTS[best]?.[2] ?? 0;
  for (const slot of colors) {
    const value = SLOTS[slot]?.[2] ?? 0;
    if (value > light) {
      best = slot;
      light = value;
    }
  }
  return best;
}

export function headsForPalette(bouquet: BouquetDef, paletteId: string | undefined): readonly HeadSource[] {
  const palette = PALETTES[bouquet.id].find((item) => item.id === normalizePalette(bouquet.id, paletteId));
  const colors = palette?.colors;
  if (!colors || colors.length === 0) return bouquet.heads;
  const fill = lighterSlot(colors);
  let flower = 0;
  return bouquet.heads.map((head) => {
    if (head.k === 'gyp') return { ...head, s: fill };
    const petal = colors[flower % colors.length] ?? head.s;
    const lip = palette?.duo ? colors[(flower + 1) % colors.length] : undefined;
    flower += 1;
    return lip === undefined ? { ...head, s: petal } : { ...head, s: petal, lip };
  });
}

export function bouquetById(id: BouquetId): BouquetDef {
  const found = BOUQUETS.find((bouquet) => bouquet.id === id);
  if (!found) throw new Error(`Bouquet inconnu : ${id}`);
  return found;
}

export function styleById(id: StyleId): StyleDef {
  const found = STYLES.find((style) => style.id === id);
  if (!found) throw new Error(`Style inconnu : ${id}`);
  return found;
}

export function wrapById(id: WrapId): WrapDef {
  const found = WRAPS.find((wrap) => wrap.id === id);
  if (!found) throw new Error(`Emballage inconnu : ${id}`);
  return found;
}

export function slotCss(): string {
  return SLOTS.map((color, index) => `.s${index}{--h:${color[0]};--s:${color[1]}%;--l:${color[2]}%}`).join('');
}
