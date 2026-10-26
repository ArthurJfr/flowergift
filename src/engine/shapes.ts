import { SLOT, type FlowerKind } from './catalog.js';
import { clamp } from './math.js';

export interface ShapeHead {
  ph: number;
  s: number;
}

export interface ShapeHit {
  v: number;
  slot: number;
}

function rose(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u);
  const edge = 0.9 + 0.1 * Math.cos(5 * th + head.ph);
  if (r > edge) return null;
  const k = r * 3.1 + (th + t * 0.12) / 6.2832;
  const f = k - Math.floor(k);
  let v = (0.3 + 0.7 * Math.pow(f, 0.7)) * (0.62 + 0.5 * r);
  if (r > edge - 0.08) v = Math.max(v, 0.95);
  return { v: clamp(v), slot: head.s };
}

function daisy(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u) + t * 0.05 + head.ph;
  const a = Math.abs(Math.cos(7 * th));
  const pr = 0.52 + 0.48 * Math.pow(a, 0.45);
  if (r < 0.27) {
    return { v: 0.55 + 0.4 * (0.5 + 0.5 * Math.cos(r * 38) * Math.cos(th * 6)), slot: SLOT.yellow };
  }
  if (r < pr) {
    return { v: r > pr - 0.1 ? 1 : 0.45 + 0.5 * a * (1 - 0.35 * r), slot: head.s };
  }
  return null;
}

function sun(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const r = Math.hypot(u, w);
  const th = Math.atan2(w, u) + t * 0.04 + head.ph;
  if (r < 0.5) {
    if (r > 0.43) return { v: 0.85, slot: SLOT.orange };
    const lat = Math.cos(13 * th + 14 * r) * Math.cos(21 * th - 9 * r);
    return { v: clamp(0.5 + 0.42 * lat), slot: SLOT.brown };
  }
  const a = Math.abs(Math.cos(11 * th));
  const pr = 0.6 + 0.4 * Math.pow(a, 0.7);
  if (r < pr) {
    return { v: r > pr - 0.09 ? 1 : 0.4 + 0.5 * a * (1 - 0.3 * r), slot: head.s };
  }
  const a2 = Math.abs(Math.cos(11 * th + 1.571));
  const pr2 = 0.52 + 0.3 * Math.pow(a2, 0.7);
  if (r < pr2) return { v: 0.38, slot: SLOT.orange };
  return null;
}

function tulip(u: number, w: number, _t: number, head: ShapeHead): ShapeHit | null {
  const yn = (w + 1.3) / 1.9;
  if (yn < 0 || yn > 1) return null;
  const au = Math.abs(u);
  let hw = 0.3 + 0.62 * Math.sin(yn * Math.PI * 0.78 + 0.25);
  if (yn > 0.85) {
    const q = (yn - 0.85) / 0.15;
    hw *= Math.sqrt(Math.max(0, 1 - q * q));
  }
  if (au > hw) return null;
  const g = 0.5 + 0.5 * Math.cos((6.2832 * u) / 0.4);
  if (yn < 0.17 * (1 - g)) return null;
  let v = 0.5 + 0.4 * Math.cos(u * 2.2);
  if (Math.abs(au - 0.2) < 0.035 && yn > 0.2) v = 0.22;
  if (au > hw - 0.09) v = Math.max(v, 0.92);
  return { v: clamp(v * (0.75 + 0.35 * (1 - yn))), slot: head.s };
}

function orch(u: number, w: number, t: number, head: ShapeHead): ShapeHit | null {
  const el = (cx: number, cy: number, rx: number, ry: number) => Math.hypot((u - cx) / rx, (w - cy) / ry);
  const sw = 0.03 * Math.sin(t * 1.2 + head.ph);
  let d = el(0, 0.22, 0.2, 0.3);
  if (d < 1) {
    if (el(0, 0.02, 0.1, 0.1) < 1) return { v: 0.95, slot: SLOT.yellow };
    return { v: d > 0.8 ? 0.95 : 0.5 + 0.3 * Math.sin(w * 22), slot: SLOT.red };
  }
  for (const s of [-1, 1]) {
    d = el(s * (0.52 + sw), -0.12, 0.52, 0.47);
    if (d < 1) {
      const vein = 0.5 + 0.5 * Math.cos((Math.atan2(w + 0.12, u - s * 0.5) + s) * 7);
      return { v: clamp(d > 0.88 ? 0.96 : 0.4 + 0.35 * (1 - d) + 0.22 * vein * (1 - d)), slot: head.s };
    }
  }
  d = el(0, -0.7, 0.3, 0.36);
  if (d < 1) return { v: d > 0.85 ? 0.95 : 0.45 + 0.4 * (1 - d), slot: head.s };
  for (const s of [-1, 1]) {
    d = el(s * (0.3 - sw), 0.58, 0.24, 0.4);
    if (d < 1) return { v: d > 0.85 ? 0.92 : 0.35 + 0.4 * (1 - d), slot: head.s };
  }
  return null;
}

function lav(u: number, w: number, _t: number, head: ShapeHead): ShapeHit | null {
  const t0 = -w / 2.4;
  if (t0 < 0 || t0 > 1) return null;
  const hw = 0.42 * (1 - 0.62 * t0);
  if (Math.abs(u) > hw) return null;
  return { v: clamp(0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t0 * 30 + u * 9 + head.ph))), slot: head.s };
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
