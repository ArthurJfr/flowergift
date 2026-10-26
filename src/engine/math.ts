export function clamp(x: number, a = 0, b = 1): number {
  return x < a ? a : x > b ? b : x;
}

export function ease(x: number): number {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
}

export function easeBack(x: number): number {
  const t = clamp(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export type Bez = [number, number, number, number, number, number];

export function bez(p: Bez, q: number): [number, number] {
  const a = (1 - q) * (1 - q);
  const b = 2 * (1 - q) * q;
  const c = q * q;
  return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]];
}

export function bezTangent(p: Bez, q: number): [number, number] {
  return [
    2 * (1 - q) * (p[2] - p[0]) + 2 * q * (p[4] - p[2]),
    2 * (1 - q) * (p[3] - p[1]) + 2 * q * (p[5] - p[3]),
  ];
}
