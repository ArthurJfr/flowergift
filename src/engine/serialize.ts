import { LEVEL_M, SLOTS, styleById, type ColorMode, type StyleId } from './catalog.js';
import type { Grid } from './scene.js';

const WORD = 'FLEURS';

export interface HtmlOptions {
  style: StyleId;
  colorMode: ColorMode;
  t: number;
}

export interface TextOptions {
  style: StyleId;
  t: number;
}

export interface EmailOptions {
  style: StyleId;
  t?: number;
}

interface Cell {
  ch: string;
  slot: number;
  level: number;
}

function occupied(grid: Grid, c: number, r: number): number {
  if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return 0;
  return (grid.val[r * grid.cols + c] ?? 0) > 0.03 ? 1 : 0;
}

function hash(c: number, r: number, k: number): number {
  let h = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(k, 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return (h >>> 7) & 1;
}

function edgeChar(grid: Grid, c: number, r: number, v: number): string {
  const here = (cc: number, rr: number) => occupied(grid, cc, rr);
  const filled = here(c - 1, r) && here(c + 1, r) && here(c, r - 1) && here(c, r + 1);
  if (filled) return v > 0.62 ? '.' : ' ';
  const gx = (here(c + 1, r) - here(c - 1, r)) / grid.cellW;
  const gy = (here(c, r + 1) - here(c, r - 1)) / grid.cellH;
  const tx = -gy;
  const ty = gx;
  if (gx === 0 && gy === 0) return '*';
  const ax = Math.abs(tx);
  const ay = Math.abs(ty);
  if (ax > 2 * ay) return '-';
  if (ay > 2 * ax) return '|';
  return tx * ty > 0 ? '\\' : '/';
}

function glyph(grid: Grid, c: number, r: number, styleId: StyleId, t: number): Cell {
  const index = r * grid.cols + c;
  const v = grid.val[index] ?? 0;
  const slot = grid.slot[index] ?? 0;
  const ovr = grid.ovr[index] ?? 0;
  const style = styleById(styleId);
  let ch = ' ';
  if (ovr) ch = String.fromCharCode(ovr);
  else if (v > 0.03) {
    if (style.kind === 'text') {
      if (v < 0.26) ch = '.';
      else {
        const shift = Math.floor(t * 3);
        const letter = WORD[(c + r * 2 + shift) % WORD.length] ?? 'F';
        ch = v < 0.62 ? letter.toLowerCase() : letter;
      }
    } else if (style.kind === 'bin') {
      ch = v < 0.24 ? '.' : hash(c, r, Math.floor(t * 5)) ? '1' : '0';
    } else if (style.kind === 'edge') {
      ch = edgeChar(grid, c, r, v);
    } else {
      const ramp = style.ramp ?? '';
      ch = ramp.charAt(Math.max(1, Math.round(v * (ramp.length - 1)))) || ' ';
    }
  }
  return { ch, slot, level: Math.min(4, Math.floor(v * 5)) };
}

function escapeHtml(ch: string): string {
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '&') return '&amp;';
  return ch;
}

function hslChannels(hp: number, chroma: number, x: number): [number, number, number] {
  if (hp < 1) return [chroma, x, 0];
  if (hp < 2) return [x, chroma, 0];
  if (hp < 3) return [0, chroma, x];
  if (hp < 4) return [0, x, chroma];
  if (hp < 5) return [x, 0, chroma];
  return [chroma, 0, x];
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const chroma = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hslChannels(hp, chroma, x);
  const m = lig - chroma / 2;
  const byte = (channel: number) =>
    Math.round(Math.min(1, Math.max(0, channel + m)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function emailColor(slot: number, level: number): string {
  const color = SLOTS[slot] ?? SLOTS[0];
  if (!color) return '#888888';
  const gain = LEVEL_M[level] ?? 1;
  return hslToHex(color[0], color[1], Math.min(94, color[2] * gain));
}

export function toText(grid: Grid, options: TextOptions): string {
  let out = '';
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) out += glyph(grid, c, r, options.style, options.t).ch;
    out += '\n';
  }
  return out;
}

export function toHtml(grid: Grid, options: HtmlOptions): string {
  let out = '';
  let current = -1;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = glyph(grid, c, r, options.style, options.t);
      if (cell.ch === ' ') {
        if (current >= 0) {
          out += '</span>';
          current = -1;
        }
        out += ' ';
        continue;
      }
      const key = cell.slot * 8 + cell.level;
      if (key !== current) {
        if (current >= 0) out += '</span>';
        out += `<span class="s${cell.slot} l${cell.level}">`;
        current = key;
      }
      out += escapeHtml(cell.ch);
    }
    if (current >= 0) {
      out += '</span>';
      current = -1;
    }
    out += '\n';
  }
  void options.colorMode;
  return out;
}

export function toEmailHtml(grid: Grid, options: EmailOptions): string {
  const t = options.t ?? 0;
  const colors = new Map<number, string>();
  let body = '';
  let current = -1;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = glyph(grid, c, r, options.style, t);
      if (cell.ch === ' ') {
        if (current >= 0) {
          body += '</span>';
          current = -1;
        }
        body += ' ';
        continue;
      }
      const key = cell.slot * 8 + cell.level;
      if (key !== current) {
        if (current >= 0) body += '</span>';
        let color = colors.get(key);
        if (!color) {
          color = emailColor(cell.slot, cell.level);
          colors.set(key, color);
        }
        body += `<span style="color:${color}">`;
        current = key;
      }
      body += escapeHtml(cell.ch);
    }
    if (current >= 0) {
      body += '</span>';
      current = -1;
    }
    body += '\n';
  }
  return `<pre style="margin:0;line-height:1;font-family:ui-monospace,Menlo,Consolas,monospace">${body}</pre>`;
}
