import { SLOT, type FlowerKind } from './catalog.js';
import { clamp } from './math.js';

export interface ShapeHead {
  ph: number;
  s: number;
  lip?: number;
}

export interface ShapeHit {
  v: number;
  slot: number;
}

function rose(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u);
  const lobe = 0.5 + 0.5 * Math.cos(5 * th + head.ph);
  const edge = 0.78 + 0.22 * Math.pow(lobe, 0.6);
  if (r > edge) return null;
  if (r > 0.58 && lobe < 0.16) return null;
  if (r < 0.18) return { v: 0.28 + 0.15 * (1 - r / 0.18), slot: head.s };
  const turn = r * 4.4 + (th + t * 0.14) / 6.2832;
  const band = turn - Math.floor(turn);
  let v = 0.42 + 0.5 * Math.pow(band, 0.62) * (0.45 + 0.55 * r);
  if (r > edge - 0.07 && lobe > 0.45) v = Math.max(v, 0.96);
  return { v: clamp(v), slot: head.s };
}

function daisy(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u) + t * 0.04 + head.ph;
  const petal = Math.pow(Math.max(0, Math.cos(8 * th)), 0.42);
  if (r < 0.3) {
    const grain = 0.5 + 0.5 * Math.cos(r * 36) * Math.cos(th * 5);
    return { v: r > 0.24 ? 0.95 : 0.5 + 0.35 * grain, slot: SLOT.yellow };
  }
  if (petal < 0.2) return null;
  const tip = 0.36 + 0.64 * petal;
  if (r > tip) return null;
  return { v: r > tip - 0.08 ? 1 : 0.58 + 0.32 * petal * (1 - 0.25 * r), slot: head.s };
}

function sun(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u) + t * 0.03 + head.ph;
  if (r < 0.42) {
    if (r > 0.36) return { v: 0.92, slot: SLOT.orange };
    const seed = Math.cos(17 * th + 16 * r) * Math.cos(11 * th - 13 * r);
    return { v: clamp(0.32 + 0.55 * (0.5 + 0.5 * seed)), slot: SLOT.brown };
  }
  const ray = Math.pow(Math.max(0, Math.cos(13 * th)), 0.62);
  if (ray < 0.14) return null;
  const tip = 0.5 + 0.55 * ray;
  if (r > tip) return null;
  return { v: r > tip - 0.07 ? 1 : 0.48 + 0.45 * ray * (1 - 0.2 * r), slot: head.s };
}

function tulip(u: number, w: number, _t: number, head: ShapeHead): ShapeHit | null {
  const yn = (w + 1.35) / 2.15;
  if (yn < 0 || yn > 1) return null;
  const lobe = 0.62 + 0.38 * Math.cos(3 * Math.atan2(u, yn - 0.42));
  let hw = (0.16 + 0.58 * Math.sin(yn * Math.PI * 0.82)) * lobe;
  if (yn > 0.76) {
    const q = (yn - 0.76) / 0.24;
    hw *= Math.sqrt(Math.max(0, 1 - q * q));
  }
  if (Math.abs(u) > hw) return null;
  if (yn < 0.1) return { v: 0.72, slot: SLOT.leaf };
  let v = 0.5 + 0.38 * Math.cos(u * 3.4);
  if (Math.abs(Math.abs(u) - hw * 0.42) < 0.028 && yn > 0.22 && yn < 0.82) v = 0.24;
  if (Math.abs(u) > hw - 0.06) v = Math.max(v, 0.94);
  return { v: clamp(v), slot: head.s };
}

function orch(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const el = (cx: number, cy: number, rx: number, ry: number) => Math.hypot((u - cx) / rx, (w - cy) / ry);
  const lip = head.lip ?? head.s;
  const column = head.lip === undefined ? SLOT.red : lip;
  const sw = 0.03 * Math.sin(t * 1.2 + head.ph);
  let d = el(0, 0.22, 0.2, 0.3);
  if (d < 1) {
    if (el(0, 0.02, 0.1, 0.1) < 1) return { v: 0.95, slot: SLOT.yellow };
    return { v: d > 0.8 ? 0.95 : 0.5 + 0.3 * Math.sin(w * 22), slot: column };
  }
  for (const s of [-1, 1]) {
    d = el(s * (0.52 + sw), -0.12, 0.52, 0.47);
    if (d < 1) {
      const vein = 0.5 + 0.5 * Math.cos((Math.atan2(w + 0.12, u - s * 0.5) + s) * 7);
      return { v: clamp(d > 0.88 ? 0.96 : 0.4 + 0.35 * (1 - d) + 0.22 * vein * (1 - d)), slot: head.s };
    }
  }
  d = el(0, -0.72, 0.34, 0.4);
  if (d < 1) {
    const spot = 0.5 + 0.5 * Math.cos(u * 28) * Math.cos((w + 0.72) * 18);
    const marked = d < 0.62 && spot > 0.72;
    return { v: marked ? 0.22 : d > 0.84 ? 0.96 : 0.42 + 0.4 * (1 - d), slot: marked ? SLOT.yellow : lip };
  }
  for (const s of [-1, 1]) {
    d = el(s * (0.3 - sw), 0.58, 0.24, 0.4);
    if (d < 1) return { v: d > 0.85 ? 0.92 : 0.35 + 0.4 * (1 - d), slot: head.s };
  }
  return null;
}

function lav(u: number, w: number, _t: number, head: ShapeHead): ShapeHit | null {
  const t0 = -w / 2.7;
  if (t0 < 0 || t0 > 1) return null;
  const hw = 0.3 * (1 - 0.72 * t0);
  if (Math.abs(u) > hw) return null;
  if (t0 < 0.07) return { v: 0.62, slot: SLOT.leaf };
  const bead = 0.5 + 0.5 * Math.sin(t0 * 46 + head.ph + u * 4);
  if (bead < 0.38) return null;
  return { v: clamp(0.5 + 0.45 * bead), slot: head.s };
}

const SHAPES = { rose, daisy, sun, tulip, orch, lav };

export function sampleShape(
  kind: Exclude<FlowerKind, 'gyp'>,
  u: number,
  w: number,
  t: number,
  head: ShapeHead,
): ShapeHit | null {
  return SHAPES[kind](u, w, t, head);
}
