import {
  SHAPE_EXTENT,
  SLOT,
  bouquetById,
  headsForPalette,
  normalizePalette,
  styleById,
  wrapById,
  type BouquetId,
  type FlowerKind,
  type StyleId,
  type WrapId,
} from './catalog.js';
import { bez, bezTangent, clamp, ease, easeBack, type Bez } from './math.js';
import { mulberry32, placementRng } from './rng.js';
import { sampleShape } from './shapes.js';

export interface RenderOptions {
  bouquetId: BouquetId;
  style: StyleId;
  wrap: WrapId;
  cols: number;
  rows: number;
  charAspect?: number;
  wind?: number;
  seed?: number;
  petals?: boolean;
  palette?: string;
}

export interface ResolvedOptions {
  bouquetId: BouquetId;
  style: StyleId;
  wrap: WrapId;
  cols: number;
  rows: number;
  charAspect: number;
  wind: number;
  seed: number;
  petals: boolean;
  palette: string;
}

export interface Grid {
  cols: number;
  rows: number;
  val: Float32Array;
  slot: Uint8Array;
  ovr: Uint16Array;
  cellW: number;
  cellH: number;
}

interface Head {
  k: FlowerKind;
  x: number;
  y: number;
  R: number;
  s: number;
  lip?: number;
  idx: number;
  ph: number;
  bow: number;
  d: number;
  filler: boolean;
  dots: [number, number, number][];
  hx: number;
  hy: number;
  P: Bez;
  ux: number;
  uy: number;
  g: number;
  b: number;
}

interface Foliage {
  ang: number;
  len: number;
  width: number;
}

interface Particle {
  x: number;
  y: number;
  vy: number;
  ph: number;
  s: number;
  m: number;
}

export interface Scene {
  options: ResolvedOptions;
  grid: Grid;
  heads: Head[];
  fillers: Head[];
  mains: Head[];
  foliage: Foliage[];
  leafL?: number;
  particles: Particle[];
  partT: number;
  random: () => number;
}

function makeGrid(cols: number, rows: number, charAspect: number): Grid {
  const cellH = 100 / rows;
  return {
    cols,
    rows,
    val: new Float32Array(cols * rows),
    slot: new Uint8Array(cols * rows),
    ovr: new Uint16Array(cols * rows),
    cellW: charAspect * cellH,
    cellH,
  };
}

function initHead(src: { k: FlowerKind; x: number; y: number; R: number; s: number; lip?: number }, index: number, idLength: number): Head {
  const random = placementRng(index * 977 + idLength * 131 + 7);
  const head: Head = {
    k: src.k,
    x: src.x,
    y: src.y,
    R: src.R,
    s: src.s,
    lip: src.lip,
    idx: index,
    ph: random() * 6.283,
    bow: (random() - 0.5) * 7,
    d: 0.1 * index + random() * 0.1,
    filler: src.k === 'gyp' || src.k === 'lav',
    dots: [],
    hx: 0,
    hy: 0,
    P: [0, 0, 0, 0, 0, 0],
    ux: 0,
    uy: -1,
    g: 0,
    b: 0,
  };
  if (head.filler) {
    head.x *= 0.85;
    head.y = 40 + (head.y - 40) * 0.88;
  } else {
    head.x *= 0.8;
    head.y = 41 + (head.y - 41) * 0.86;
    head.R *= head.k === 'orch' ? 1.12 : 1.22;
  }
  if (head.k === 'gyp') {
    for (let j = 0; j < 8; j++) {
      const angle = random() * 6.283;
      const dist = Math.sqrt(random()) * head.R;
      head.dots.push([Math.cos(angle) * dist, Math.sin(angle) * dist * 0.8, random() * 6.283]);
    }
  }
  return head;
}

export function createScene(options: RenderOptions): Scene {
  const bouquet = bouquetById(options.bouquetId);
  const palette = normalizePalette(options.bouquetId, options.palette);
  const resolved: ResolvedOptions = {
    bouquetId: options.bouquetId,
    style: options.style,
    wrap: options.wrap,
    cols: options.cols,
    rows: options.rows,
    charAspect: options.charAspect ?? 0.6,
    wind: options.wind ?? 1,
    seed: options.seed ?? 1,
    petals: options.petals ?? true,
    palette,
  };
  const heads = headsForPalette(bouquet, palette).map((head, index) => initHead(head, index, bouquet.id.length));
  return {
    options: resolved,
    grid: makeGrid(resolved.cols, resolved.rows, resolved.charAspect),
    heads,
    fillers: heads.filter((head) => head.filler),
    mains: heads.filter((head) => !head.filler).sort((a, b) => a.y - b.y),
    foliage: bouquet.foliage.map(([ang, len, width]) => ({ ang, len, width })),
    leafL: bouquet.leafL,
    particles: [],
    partT: 0,
    random: mulberry32(resolved.seed),
  };
}

export function clearParticles(scene: Scene): void {
  scene.particles.length = 0;
  scene.partT = 0;
}

interface Draw {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  cx: number;
  val: Float32Array;
  slot: Uint8Array;
  ovr: Uint16Array;
}

function area(draw: Draw, x0: number, y0: number, x1: number, y1: number, fn: (sx: number, sy: number, i: number) => void): void {
  const c0 = Math.max(0, Math.floor(x0 / draw.cellW));
  const c1 = Math.min(draw.cols - 1, Math.floor(x1 / draw.cellW));
  const r0 = Math.max(0, Math.floor(y0 / draw.cellH));
  const r1 = Math.min(draw.rows - 1, Math.floor(y1 / draw.cellH));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) fn((c + 0.5) * draw.cellW, (r + 0.5) * draw.cellH, r * draw.cols + c);
  }
}

function put(draw: Draw, x: number, y: number, v: number, s: number, ch?: string): void {
  const c = Math.floor(x / draw.cellW);
  const r = Math.floor(y / draw.cellH);
  if (c < 0 || c >= draw.cols || r < 0 || r >= draw.rows) return;
  const i = r * draw.cols + c;
  draw.val[i] = v;
  draw.slot[i] = s;
  draw.ovr[i] = ch ? ch.charCodeAt(0) : 0;
}

function pose(head: Head, t: number, wind: number, cx: number, endK: number, endY: number): void {
  const height = (94 - head.y) / 70;
  const swx =
    wind *
    (2.4 * Math.sin(t * 1.1 + head.ph) + 1.1 * Math.sin(t * 2.3 + head.ph * 1.7) + 1.4 * Math.sin(t * 0.45)) *
    height;
  const swy = wind * 0.5 * Math.sin(t * 1.3 + head.ph);
  head.hx = cx + head.x + swx;
  head.hy = head.y + swy;
  const ex = cx + head.x * endK;
  const ey = endY;
  const p1x = head.hx * 0.45 + ex * 0.55 + head.bow;
  const p1y = (head.hy + ey) / 2;
  head.P = [head.hx, head.hy, p1x, p1y, ex, ey];
  let ux = head.hx - p1x;
  let uy = head.hy - p1y;
  const length = Math.hypot(ux, uy) || 1;
  ux /= length;
  uy /= length;
  head.ux = ux;
  head.uy = uy;
}

function drawStem(draw: Draw, head: Head, stem: string): void {
  const grown = head.g;
  if (grown <= 0) return;
  const thin = head.k === 'gyp' || head.k === 'lav';
  const steps = 110;
  for (let i = 0; i <= steps; i++) {
    const q = 1 - i / steps;
    if (q < 1 - grown) break;
    const point = bez(head.P, q);
    const tangent = bezTangent(head.P, q);
    const ax = Math.abs(tangent[0]);
    const ay = Math.abs(tangent[1]);
    const ch = ax < 0.38 * ay ? stem.charAt(0) : tangent[0] * tangent[1] > 0 ? stem.charAt(2) : stem.charAt(1);
    put(draw, point[0], point[1], thin ? 0.55 : 0.7, SLOT.stem, ch);
  }
}

function drawLeaf(draw: Draw, ax: number, ay: number, ang: number, length: number, width: number, grown: number): void {
  const reached = length * grown;
  if (reached < 1.2) return;
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const tx = ax + dx * length;
  const ty = ay + dy * length;
  const margin = width + 1;
  area(draw, Math.min(ax, tx) - margin, Math.min(ay, ty) - margin, Math.max(ax, tx) + margin, Math.max(ay, ty) + margin, (sx, sy, i) => {
    const px = sx - ax;
    const py = sy - ay;
    const u = (px * dx + py * dy) / length;
    const w = -px * dy + py * dx;
    if (u < 0 || u > grown) return;
    const uu = u / grown;
    const hw = width * Math.pow(Math.sin(Math.PI * Math.pow(uu, 0.8)), 0.9) * (0.4 + 0.6 * grown);
    const aw = Math.abs(w);
    if (aw < hw) {
      draw.val[i] = aw < 0.55 ? 0.95 : 0.32 + 0.38 * (1 - aw / hw);
      draw.slot[i] = SLOT.leaf;
      draw.ovr[i] = 0;
    }
  });
}

function drawHead(draw: Draw, head: Head, t: number): void {
  const kind = head.k;
  const radius = head.R * head.b * (1 + 0.03 * Math.sin(t * 1.7 + head.ph));
  if (head.b <= 0.02 || radius < 0.6 || kind === 'gyp') return;
  const ux = head.ux;
  const uy = head.uy;
  const rx = -uy;
  const ry = ux;
  const extent = SHAPE_EXTENT[kind] * radius;
  area(draw, head.hx - extent, head.hy - extent, head.hx + extent, head.hy + extent, (sx, sy, i) => {
    const dx = sx - head.hx;
    const dy = sy - head.hy;
    const u = (dx * rx + dy * ry) / radius;
    const w = -(dx * ux + dy * uy) / radius;
    const hit = sampleShape(kind, u, w, t, head);
    const current = draw.val[i] ?? 0;
    if (hit && hit.v > 0) {
      draw.val[i] = hit.v;
      draw.slot[i] = hit.slot;
      draw.ovr[i] = 0;
    } else if (kind !== 'lav' && current > 0) {
      const ring = sampleShape(kind, u * 0.86, w * 0.86, t, head);
      if (ring && ring.v > 0) {
        draw.val[i] = 0;
        draw.ovr[i] = 0;
      }
    }
  });
}

function drawGyp(draw: Draw, head: Head, t: number): void {
  if (head.b <= 0.02) return;
  for (const dot of head.dots) {
    const twinkle = 0.65 + 0.35 * Math.sin(t * 3 + dot[2]);
    put(draw, head.hx + dot[0] * head.b, head.hy + dot[1] * head.b, twinkle, head.s);
  }
  put(draw, head.hx, head.hy, 0.9, head.s);
}

function bow(draw: Draw, by: number, k: number, t: number): void {
  if (k <= 0) return;
  for (const s of [-1, 1]) {
    const ccx = draw.cx + s * 6.5 * k;
    const ccy = by - 1.6;
    const rx = 6.2 * k;
    const ry = 3.5 * k;
    area(draw, ccx - rx - 1, ccy - ry - 1, ccx + rx + 1, ccy + ry + 1, (sx, sy, i) => {
      const d = Math.hypot((sx - ccx) / rx, (sy - ccy) / ry);
      if (d < 1 && d > 0.6) {
        draw.val[i] = 0.92;
        draw.slot[i] = SLOT.ribbon;
        draw.ovr[i] = 0;
      } else if (d <= 0.6) {
        draw.val[i] = 0.4;
        draw.slot[i] = SLOT.ribbon;
        draw.ovr[i] = 0;
      }
    });
  }
  for (const s of [-1, 1]) {
    for (let q = 0; q <= 1; q += 0.04) {
      const x = draw.cx + s * (q * 5.5) * k + Math.sin(t * 1.3 + s) * q * 0.6;
      const y = by + 2 + q * 11 * k;
      put(draw, x, y, 0.85, SLOT.ribbon);
      put(draw, x + s * 1.1, y, 0.7, SLOT.ribbon);
    }
  }
  area(draw, draw.cx - 2.4, by - 2.6, draw.cx + 2.4, by + 1, (sx, sy, i) => {
    if (Math.hypot((sx - draw.cx) / 2.3, (sy - by + 0.8) / 1.6) < 1) {
      draw.val[i] = 1;
      draw.slot[i] = SLOT.ribbon;
      draw.ovr[i] = 0;
    }
  });
}

function drawPaper(draw: Draw, tb: number, t: number): void {
  const reveal = ease(tb / 0.9);
  const yMin = 98 - 33 * reveal;
  const top = (dxa: number) => 66 + 7 * (1 - Math.pow(Math.min(1, dxa / 27), 1.5));
  area(draw, 0, 64, draw.cols * draw.cellW, 99, (sx, sy, i) => {
    if (sy < yMin) return;
    const ad = Math.abs(sx - draw.cx);
    const hw = 3 + (98 - sy) * 0.75;
    if (ad > hw || sy < top(ad) || sy > 98.5) return;
    let v = 0.42 + 0.22 * Math.sin((sx + sy) * 1.15) + 0.12 * Math.sin((sx - sy) * 0.5);
    v *= 1 - 0.3 * Math.pow(ad / hw, 2);
    if (ad > hw - 1.3) v = 0.95;
    else if (sy < top(ad) + 1.9) v = Math.max(v, 0.8);
    draw.val[i] = clamp(v);
    draw.slot[i] = SLOT.kraft;
    draw.ovr[i] = 0;
  });
  const by = 84;
  if (tb > 2.2) {
    area(draw, 0, by - 3, draw.cols * draw.cellW, by + 3, (sx, sy, i) => {
      const ad = Math.abs(sx - draw.cx);
      const hw = 3 + (98 - sy) * 0.75;
      if (ad < hw - 0.5 && Math.abs(sy - by) < 1.5) {
        draw.val[i] = 0.78;
        draw.slot[i] = SLOT.ribbon;
        draw.ovr[i] = 0;
      }
    });
  }
  if (tb > 2.4) bow(draw, by, ease((tb - 2.4) / 0.6), t);
}

function drawVase(draw: Draw, tb: number, t: number): void {
  const reveal = ease(tb / 0.9);
  area(draw, 0, 62, draw.cols * draw.cellW, 99, (sx, sy, i) => {
    const u = (sy - 64) / 33;
    if (u < 0 || u > 1 || sy > 97.2) return;
    const hw = (9 + 11 * Math.sin(Math.PI * Math.pow(u, 0.75))) * (0.4 + 0.6 * reveal);
    const ad = Math.abs(sx - draw.cx);
    if (ad > hw + (u < 0.07 ? 2 : 0)) return;
    if (ad > hw - 1.4) {
      draw.val[i] = 0.88;
      draw.slot[i] = SLOT.glass;
      draw.ovr[i] = 0;
      return;
    }
    if (u < 0.07) return;
    if ((draw.val[i] ?? 0) === 0) {
      if (Math.abs(sx - draw.cx + 0.55 * hw) < 0.9) {
        draw.val[i] = 0.55;
        draw.slot[i] = SLOT.glass;
      } else if (sy > 71) {
        draw.val[i] = 0.2 + 0.1 * Math.sin(sx * 1.2 + sy * 0.8 + t * 1.5);
        draw.slot[i] = SLOT.glass;
      }
    }
  });
  area(draw, 0, 96.5, draw.cols * draw.cellW, 99, (sx, sy, i) => {
    if (Math.abs(sx - draw.cx) < 26 && sy > 96.5 && sy < 98.3) {
      draw.val[i] = 0.8;
      draw.slot[i] = SLOT.kraft;
      draw.ovr[i] = 0;
    }
  });
}

function drawRibbon(draw: Draw, tb: number, t: number): void {
  const by = 79;
  if (tb > 2) {
    area(draw, draw.cx - 8, by - 3, draw.cx + 8, by + 3, (sx, sy, i) => {
      if (Math.abs(sx - draw.cx) < 6.5 && Math.abs(sy - by) < 1.4) {
        draw.val[i] = 0.8;
        draw.slot[i] = SLOT.ribbon;
        draw.ovr[i] = 0;
      }
    });
  }
  if (tb > 2.2) bow(draw, by, ease((tb - 2.2) / 0.6), t);
}

function spawnParticles(scene: Scene, tb: number): void {
  if (!(scene.options.petals && tb > 3.4)) return;
  while (scene.partT > 0.28 && scene.particles.length < 18) {
    scene.partT -= 0.28;
    const main = scene.mains[Math.floor(scene.random() * scene.mains.length)];
    if (!main) break;
    scene.particles.push({
      x: main.hx + (scene.random() - 0.5) * main.R,
      y: main.hy + (scene.random() - 0.3) * main.R * 0.6,
      vy: 3 + scene.random() * 4,
      ph: scene.random() * 6.28,
      s: main.s,
      m: 0.6 + scene.random() * 1.4,
    });
  }
  scene.partT = Math.min(scene.partT, 0.28);
}

export function renderFrame(scene: Scene, t: number, tb: number, dt: number): Grid {
  const { options } = scene;
  if (scene.grid.cols !== options.cols || scene.grid.rows !== options.rows) {
    scene.grid = makeGrid(options.cols, options.rows, options.charAspect);
  }
  const cellH = 100 / options.rows;
  const cellW = options.charAspect * cellH;
  const grid = scene.grid;
  grid.cellW = cellW;
  grid.cellH = cellH;
  grid.val.fill(0);
  grid.slot.fill(0);
  grid.ovr.fill(0);

  const draw: Draw = {
    cols: options.cols,
    rows: options.rows,
    cellW,
    cellH,
    cx: (options.cols * cellW) / 2,
    val: grid.val,
    slot: grid.slot,
    ovr: grid.ovr,
  };
  const wrap = wrapById(options.wrap);
  const style = styleById(options.style);

  for (const head of scene.heads) {
    pose(head, t, options.wind, draw.cx, wrap.endK, wrap.endY);
    head.g = ease((tb - head.d) / 1.3);
    head.b = head.filler ? ease((tb - head.d - 1) / 0.8) : easeBack((tb - head.d - 1) / 1.1);
  }

  scene.foliage.forEach((leaf, index) => {
    const grown = ease((tb - 0.15 - index * 0.08) / 1.2);
    const side = Math.sign(leaf.ang);
    const ang = leaf.ang + 0.07 * options.wind * Math.sin(t * 1.2 + index * 1.3);
    drawLeaf(draw, draw.cx + side * (2 + Math.abs(leaf.ang) * 3), wrap.anchorY, ang, leaf.len, leaf.width, grown);
  });

  for (const head of scene.heads) {
    drawStem(draw, head, style.stem);
    if (head.k === 'gyp' || head.k === 'lav') continue;
    const length = scene.leafL ?? 10;
    const stations = head.idx % 3 === 0 ? [0.55, 0.38] : [0.55];
    stations.forEach((q, j) => {
      const point = bez(head.P, q);
      const grown = clamp((head.g - (1 - q)) * 4);
      if (grown <= 0) return;
      const side = (head.x === 0 ? (head.idx % 2 ? 1 : -1) : Math.sign(head.x)) * (j ? -1 : 1);
      drawLeaf(
        draw,
        point[0],
        point[1],
        side * (0.95 + 0.1 * j) + 0.08 * options.wind * Math.sin(t * 1.4 + head.ph),
        length * (1 - 0.25 * j),
        scene.leafL ? 3.2 : 2.1,
        grown,
      );
    });
  }

  for (const head of scene.fillers) {
    if (head.k === 'gyp') drawGyp(draw, head, t);
    else drawHead(draw, head, t);
  }
  for (const head of scene.mains) drawHead(draw, head, t);

  if (options.wrap === 'paper') drawPaper(draw, tb, t);
  else if (options.wrap === 'vase') drawVase(draw, tb, t);
  else drawRibbon(draw, tb, t);

  if (options.petals && tb > 3.4) scene.partT += dt;
  spawnParticles(scene, tb);
  for (let i = scene.particles.length - 1; i >= 0; i--) {
    const particle = scene.particles[i];
    if (!particle) continue;
    particle.y += particle.vy * dt;
    particle.x += Math.sin(t * 1.6 + particle.ph) * particle.m * dt * 3 + options.wind * dt * 0.8;
    if (particle.y > 93 || !options.petals) scene.particles.splice(i, 1);
  }
  for (const particle of scene.particles) put(draw, particle.x, particle.y, 0.82, particle.s, style.part);

  return grid;
}
