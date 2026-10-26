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
      H('rose', 0, 26, 10, SLOT.red),
      H('rose', -15, 34, 9, SLOT.pink),
      H('rose', 15, 34, 9, SLOT.peach),
      H('rose', -28, 44, 8, SLOT.coral),
      H('rose', 28, 44, 8, SLOT.red),
      H('rose', -8, 46, 8.5, SLOT.pink),
      H('rose', 9, 47, 8, SLOT.peach),
      H('gyp', -36, 29, 5, SLOT.white),
      H('gyp', 36, 27, 5, SLOT.white),
      H('gyp', -22, 15, 5, SLOT.white),
      H('gyp', 23, 14, 5, SLOT.white),
      H('gyp', 1, 9, 5, SLOT.white),
      H('gyp', -40, 46, 4.5, SLOT.white),
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
  {
    id: 'tulipes',
    name: 'Tulipes',
    heads: [
      H('tulip', 0, 32, 7.5, SLOT.pink),
      H('tulip', -13, 38, 7, SLOT.red),
      H('tulip', 13, 38, 7, SLOT.yellow),
      H('tulip', -25, 46, 7, SLOT.orange),
      H('tulip', 25, 46, 7, SLOT.violet),
      H('tulip', -6, 50, 6.5, SLOT.yellow),
      H('tulip', 7, 51, 6.5, SLOT.coral),
    ],
    foliage: [
      [-0.5, 32, 5],
      [0.5, 32, 5],
      [-0.95, 28, 4.5],
      [0.95, 28, 4.5],
      [-0.2, 30, 4.5],
      [0.22, 30, 4.5],
    ],
    leafL: 18,
  },
  {
    id: 'marguerites',
    name: 'Marguerites',
    heads: [
      H('daisy', 0, 24, 6.5, SLOT.white),
      H('daisy', -12, 30, 6.5, SLOT.white),
      H('daisy', 12, 29, 6.5, SLOT.pink),
      H('daisy', -24, 36, 6.5, SLOT.white),
      H('daisy', 24, 35, 6.5, SLOT.white),
      H('daisy', -6, 40, 6.5, SLOT.peach),
      H('daisy', 7, 41, 6.5, SLOT.white),
      H('daisy', -33, 47, 6, SLOT.white),
      H('daisy', 33, 46, 6, SLOT.pink),
      H('gyp', -38, 30, 4.5, SLOT.white),
      H('gyp', 38, 28, 4.5, SLOT.white),
      H('gyp', 0, 12, 4.5, SLOT.white),
    ],
    foliage: [
      [-0.5, 20, 4],
      [0.5, 20, 4],
      [-1, 18, 3.6],
      [1, 18, 3.6],
    ],
  },
  {
    id: 'tournesols',
    name: 'Tournesols',
    heads: [
      H('sun', 0, 28, 11, SLOT.yellow),
      H('sun', -19, 38, 10, SLOT.orange),
      H('sun', 19, 37, 10, SLOT.yellow),
      H('sun', -9, 52, 8.5, SLOT.yellow),
      H('sun', 11, 52, 8.5, SLOT.orange),
    ],
    foliage: [
      [-0.6, 26, 7],
      [0.6, 26, 7],
      [-1.1, 22, 6],
      [1.1, 22, 6],
      [-0.2, 22, 6],
      [0.2, 22, 6],
    ],
    leafL: 14,
  },
  {
    id: 'orchidees',
    name: 'Orchidées',
    heads: [
      H('orch', 0, 27, 7, SLOT.white),
      H('orch', -19, 36, 6.5, SLOT.pink),
      H('orch', 19, 36, 6.5, SLOT.violet),
      H('orch', -9, 50, 6.5, SLOT.violet),
      H('orch', 10, 51, 6.5, SLOT.white),
      H('gyp', -36, 28, 4.5, SLOT.pink),
      H('gyp', 35, 26, 4.5, SLOT.pink),
      H('gyp', -20, 14, 4, SLOT.violet),
      H('gyp', 21, 12, 4, SLOT.pink),
      H('gyp', 2, 8, 4, SLOT.white),
    ],
    foliage: [
      [-0.6, 30, 6],
      [0.6, 30, 6],
      [-1.05, 26, 5.5],
      [1.05, 26, 5.5],
      [-0.25, 28, 5],
      [0.28, 28, 5],
    ],
    leafL: 16,
  },
  {
    id: 'champetre',
    name: 'Champêtre',
    heads: [
      H('lav', -33, 58, 5.5, SLOT.lav),
      H('lav', 34, 56, 5.5, SLOT.lav),
      H('lav', -21, 57, 5, SLOT.violet),
      H('lav', 21, 58, 5, SLOT.lav),
      H('rose', -16, 34, 8, SLOT.pink),
      H('rose', 14, 36, 8, SLOT.red),
      H('daisy', 0, 27, 7, SLOT.white),
      H('daisy', -28, 44, 6, SLOT.white),
      H('daisy', 26, 45, 6, SLOT.peach),
      H('tulip', -6, 50, 6.5, SLOT.yellow),
      H('tulip', 8, 51, 6.5, SLOT.orange),
      H('gyp', -36, 28, 4.5, SLOT.white),
      H('gyp', 36, 26, 4.5, SLOT.white),
      H('gyp', 0, 12, 4.5, SLOT.white),
      H('gyp', -44, 38, 4, SLOT.white),
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
  orch: 1.15,
  rose: 1.1,
  daisy: 1.1,
  sun: 1.12,
  tulip: 1.5,
  lav: 2.7,
};

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
