import {
  RESOLUTIONS,
  SLOTS,
  bouquetById,
  clearParticles,
  createScene,
  renderFrame,
  toHtml,
  type ColorMode,
  type ResolutionId,
  type StyleId,
  type WrapId,
  type BouquetId,
} from '../../engine/index.js';
import './styles.css';

interface PublicGift {
  bouquetId: BouquetId;
  style: StyleId;
  colorMode: ColorMode;
  wrap: WrapId;
  resolution: ResolutionId;
  fromName: string;
  message: string | null;
  boxTaps: number;
}

interface ConstellationGlyph {
  ch: string;
  color: string;
  col: number;
  row: number;
  seed: number;
}

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(selector);
  return node;
}

const app = required<HTMLElement>('#app');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fromMail = new URLSearchParams(location.search).get('via') === 'mail';
const token = location.pathname.split('/').filter(Boolean).at(-1) ?? '';

function unavailable(): void {
  app.removeAttribute('aria-busy');
  app.replaceChildren();
  const main = document.createElement('main');
  const title = document.createElement('h1');
  title.textContent = 'Ce cadeau n’est plus disponible';
  main.append(title);
  app.append(main);
}

if (!token || token === 'gift' || token === 'index.html') unavailable();
else void openGift(token);

async function openGift(giftToken: string): Promise<void> {
  const response = await fetch(`/api/public/gifts/${giftToken}`, { headers: { accept: 'application/json' } });
  if (!response.ok) { unavailable(); return; }
  if (fromMail) {
    const clean = new URL(location.href);
    clean.searchParams.delete('via');
    history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`);
    void fetch(`/api/public/gifts/${giftToken}/clicked`, { method: 'POST' }).catch(() => undefined);
  }
  const gift = await response.json() as PublicGift;
  renderBox(gift, giftToken);
}

function renderBox(gift: PublicGift, giftToken: string): void {
  app.removeAttribute('aria-busy');
  app.replaceChildren();
  const main = document.createElement('main');
  const stage = document.createElement('div');
  stage.className = 'stage';
  const visual = document.createElement('div');
  visual.className = 'visual';
  const canvas = document.createElement('canvas');
  canvas.className = 'constellation';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const button = document.createElement('button');
  button.className = 'box';
  button.type = 'button';
  button.setAttribute('aria-label', 'Boîte à cadeau, touche pour ouvrir');
  button.innerHTML = `<svg class="present" viewBox="20 100 240 236" aria-hidden="true">
    <defs>
      <linearGradient id="fg-paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f3b4c2"/><stop offset=".42" stop-color="#d86d86"/><stop offset="1" stop-color="#a94460"/>
      </linearGradient>
      <linearGradient id="fg-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8a3550"/><stop offset="1" stop-color="#4d1b2b"/>
      </linearGradient>
      <linearGradient id="fg-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe3ea"/><stop offset="1" stop-color="#e7a8b8"/>
      </linearGradient>
    </defs>
    <ellipse cx="132" cy="314" rx="86" ry="12" fill="#000" opacity=".28"/>
    <path d="M192 150 L236 134 L236 282 L192 298 Z" fill="url(#fg-side)"/>
    <path d="M48 150 H192 V298 H48 Z" fill="url(#fg-paper)"/>
    <g class="lid">
      <path d="M40 124 L200 124 L244 108 L84 108 Z" fill="url(#fg-lid)"/>
      <path d="M200 124 L244 108 L244 142 L200 158 Z" fill="#a24b64"/>
      <path d="M40 124 H200 V158 H40 Z" fill="#e7a8b8"/>
    </g>
  </svg>`;
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.setAttribute('aria-live', 'polite');
  const description = document.createElement('p');
  description.className = 'sr-only';
  description.textContent = `Bouquet ASCII offert par ${gift.fromName}.`;
  const bouquetName = document.createElement('p');
  bouquetName.className = 'bouquet-name';
  bouquetName.hidden = true;
  bouquetName.textContent = bouquetById(gift.bouquetId).name;
  const message = document.createElement('p');
  message.className = 'message';
  message.hidden = true;
  const from = document.createElement('p');
  from.className = 'hint';
  from.hidden = true;
  const replay = document.createElement('button');
  replay.className = 'replay';
  replay.type = 'button';
  replay.textContent = 'Rejouer l’ouverture';
  replay.hidden = true;
  visual.append(canvas, button);
  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.append(hint, bouquetName, message, from, replay);
  stage.append(visual, description, caption);
  main.append(stage);
  app.append(main);

  let taps = 0;
  let state: 'idle' | 'tapping' | 'opening' | 'revealed' = 'idle';
  let idleTimer = 0;
  let hintTimer = 0;
  let wiggleTimer = 0;
  let formationStarted = 0;
  let animationFrame = 0;
  let clock = 6;
  let previousFrame = 0;
  let openedSent = false;
  const resolution = window.innerWidth < 600
    ? RESOLUTIONS[0]
    : RESOLUTIONS.find((item) => item.id === gift.resolution) ?? RESOLUTIONS[1];
  if (!resolution) return;
  const gridSize = resolution;

  const scene = createScene({
    bouquetId: gift.bouquetId,
    style: gift.style,
    wrap: gift.wrap,
    cols: gridSize.cols,
    rows: gridSize.rows,
    seed: 1,
  });

  const grid = renderFrame(scene, 6, 8, 0);
  const glyphs = constellationGlyphs(
    toHtml(grid, { style: gift.style, colorMode: gift.colorMode, t: 6 }),
    gift.colorMode,
  );
  const placed = placementOf(glyphs);

  function drawConstellation(now: number): void {
    const rect = visual.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const context = canvas.getContext('2d');
    if (!context || glyphs.length === 0) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    drawStars(context, width, height, now);

    const { fontSize, cellWidth, left, top, minCol, minRow } = fitBouquet(width, height, placed);
    const elapsed = reduced ? 10_000 : now - formationStarted;
    context.font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
    context.textBaseline = 'top';

    for (const glyph of glyphs) {
      const targetX = left + (glyph.col - minCol) * cellWidth;
      const targetY = top + (glyph.row - minRow) * fontSize;
      const delay = (glyph.seed % 701);
      const duration = 1900 + (glyph.seed % 901);
      const progress = Math.min(1, Math.max(0, (elapsed - delay) / duration));
      if (progress <= 0) continue;
      const eased = 1 - Math.pow(1 - progress, 4);
      const origin = glyphOrigin(glyph.seed, width, height);
      const curve = Math.sin(progress * Math.PI) * (((glyph.seed >>> 8) % 81) - 40);
      const x = origin.x + (targetX - origin.x) * eased + curve * origin.nx;
      const y = origin.y + (targetY - origin.y) * eased + curve * origin.ny;
      const twinkle = progress === 1 ? 0.88 + Math.sin(now / 420 + glyph.seed) * 0.12 : progress;

      context.fillStyle = glyph.color;
      if (progress < 0.96) {
        context.globalAlpha = Math.max(0, progress * 0.16);
        context.fillText(glyph.ch, x - (targetX - origin.x) * 0.035, y - (targetY - origin.y) * 0.035);
        context.globalAlpha = Math.max(0, progress * 0.3);
        context.fillText(glyph.ch, x - (targetX - origin.x) * 0.015, y - (targetY - origin.y) * 0.015);
      }
      context.shadowColor = glyph.color;
      context.shadowBlur = progress < 1 ? 9 : 3;
      context.globalAlpha = twinkle;
      context.fillText(glyph.ch, x, y);
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  function drawLiving(now: number): void {
    const dt = previousFrame ? Math.min(0.05, (now - previousFrame) / 1000) : 1 / 30;
    previousFrame = now;
    clock += dt;
    const frame = renderFrame(scene, clock, 8, dt);
    const cells = cellsFromHtml(toHtml(frame, { style: gift.style, colorMode: gift.colorMode, t: clock }), gift.colorMode);
    const rect = visual.getBoundingClientRect();
    const context = prepareCanvas(rect);
    if (!context) return;
    drawStars(context, rect.width, rect.height, now);
    const { fontSize, cellWidth, left, top, minCol, minRow } = fitBouquet(rect.width, rect.height, placed);
    context.font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
    context.textBaseline = 'top';
    for (const cell of cells) {
      context.fillStyle = cell.color;
      context.globalAlpha = 0.9 + Math.sin(now / 480 + cell.col * 0.7 + cell.row) * 0.1;
      context.fillText(cell.ch, left + (cell.col - minCol) * cellWidth, top + (cell.row - minRow) * fontSize);
    }
    context.globalAlpha = 1;
  }

  function prepareCanvas(rect: DOMRect): CanvasRenderingContext2D | null {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    return context;
  }

  function animate(now: number): void {
    if (state === 'opening') drawConstellation(now);
    else if (state === 'revealed') drawLiving(now);
    else return;
    animationFrame = requestAnimationFrame(animate);
  }

  function armIdle(): void {
    window.clearTimeout(wiggleTimer);
    if (reduced || state === 'opening' || state === 'revealed') return;
    const wait = 2000 + Math.random() * 1500;
    wiggleTimer = window.setTimeout(() => {
      if (state === 'idle') {
        button.classList.add('wiggle');
        window.setTimeout(() => button.classList.remove('wiggle'), 500);
      }
      armIdle();
    }, wait);
  }

  function setIdle(): void {
    state = 'idle';
    button.classList.add('idle');
    button.hidden = false;
    armIdle();
    hintTimer = window.setTimeout(() => { if (state === 'idle') hint.textContent = 'Touche-moi'; }, 4000);
  }

  function tap(): void {
    if (state === 'opening' || state === 'revealed') return;
    state = 'tapping';
    window.clearTimeout(idleTimer);
    window.clearTimeout(hintTimer);
    hint.textContent = '';
    taps += 1;
    button.classList.remove('idle');
    if (!reduced) {
      button.classList.remove('shake');
      void button.offsetWidth;
      button.classList.add('shake');
    }
    navigator.vibrate?.(taps >= gift.boxTaps ? [30, 40, 60] : 15);
    if (taps >= gift.boxTaps) { void open(); return; }
    idleTimer = window.setTimeout(setIdle, 2500);
  }

  async function open(): Promise<void> {
    state = 'opening';
    window.clearTimeout(wiggleTimer);
    canvas.hidden = false;
    canvas.classList.add('forming');
    button.classList.add('opening');
    formationStarted = performance.now();
    hint.textContent = 'Les étoiles dessinent ton bouquet…';
    if (reduced) drawConstellation(formationStarted + 10_000);
    else animationFrame = requestAnimationFrame(animate);
    if (!openedSent) {
      openedSent = true;
      void fetch(`/api/public/gifts/${giftToken}/opened`, { method: 'POST' }).catch(() => undefined);
    }
    const reveal = () => {
      state = 'revealed';
      previousFrame = 0;
      if (reduced) {
        cancelAnimationFrame(animationFrame);
        drawConstellation(formationStarted + 10_000);
      }
      button.hidden = true;
      canvas.classList.remove('forming');
      hint.textContent = 'Bouquet révélé';
      bouquetName.hidden = false;
      message.hidden = false;
      from.hidden = false;
      replay.hidden = false;
      message.textContent = gift.message ?? '';
      from.textContent = `De la part de ${gift.fromName}`;
      replay.focus({ preventScroll: true });
    };
    if (reduced) reveal();
    else window.setTimeout(reveal, 3700);
  }

  button.addEventListener('click', tap);
  replay.addEventListener('click', () => {
    taps = 0;
    formationStarted = 0;
    clock = 6;
    previousFrame = 0;
    clearParticles(scene);
    cancelAnimationFrame(animationFrame);
    button.hidden = false;
    button.classList.remove('opening');
    bouquetName.hidden = true;
    message.hidden = true;
    from.hidden = true;
    replay.hidden = true;
    canvas.hidden = true;
    canvas.classList.remove('forming');
    hint.textContent = '';
    setIdle();
  });
  setIdle();
}

function constellationGlyphs(html: string, colorMode: ColorMode): ConstellationGlyph[] {
  return cellsFromHtml(html, colorMode).map((cell, index) => {
    const seed = Math.imul(cell.col + 11, 73856093) ^ Math.imul(cell.row + 17, 19349663) ^ index;
    return { ch: cell.ch, color: cell.color, col: cell.col, row: cell.row, seed: seed >>> 0 };
  });
}

interface Placement {
  minCol: number;
  minRow: number;
  cols: number;
  rows: number;
}

function placementOf(glyphs: ConstellationGlyph[]): Placement {
  const minCol = Math.min(...glyphs.map((glyph) => glyph.col));
  const maxCol = Math.max(...glyphs.map((glyph) => glyph.col));
  const minRow = Math.min(...glyphs.map((glyph) => glyph.row));
  const maxRow = Math.max(...glyphs.map((glyph) => glyph.row));
  return { minCol, minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
}

function fitBouquet(width: number, height: number, placed: Placement) {
  const padX = Math.max(6, width * 0.015);
  const padY = Math.max(6, height * 0.015);
  const fontSize = Math.max(3, Math.min((width - padX * 2) / (placed.cols * 0.62), (height - padY * 2) / placed.rows));
  const cellWidth = fontSize * 0.62;
  return {
    fontSize,
    cellWidth,
    left: (width - placed.cols * cellWidth) / 2,
    top: (height - placed.rows * fontSize) / 2,
    minCol: placed.minCol,
    minRow: placed.minRow,
  };
}

const LEVEL_GAIN = [0.55, 0.75, 0.95, 1.1, 1.28];
const MONO: Partial<Record<ColorMode, readonly [number, number, number]>> = {
  'mono-green': [142, 100, 56],
  'mono-amber': [36, 100, 54],
  'mono-white': [300, 12, 82],
};
const colorCache = new Map<string, string>();

function colorFor(slot: number, level: number, colorMode: ColorMode): string {
  const key = `${colorMode}:${slot}:${level}`;
  const cached = colorCache.get(key);
  if (cached) return cached;
  const gain = LEVEL_GAIN[level] ?? 1;
  const source = colorMode === 'color' ? SLOTS[slot] ?? SLOTS[0] : MONO[colorMode];
  const color = source
    ? `hsl(${source[0]} ${source[1]}% ${Math.min(94, source[2] * gain)}%)`
    : '#f6efe8';
  colorCache.set(key, color);
  return color;
}

function cellsFromHtml(html: string, colorMode: ColorMode): { ch: string; color: string; col: number; row: number }[] {
  const cells: { ch: string; color: string; col: number; row: number }[] = [];
  let col = 0;
  let row = 0;
  let index = 0;
  while (index < html.length) {
    if (html.startsWith('<span class="', index)) {
      const closeTag = html.indexOf('>', index);
      const marker = html.slice(index, closeTag);
      const slot = Number(/s(\d+)/.exec(marker)?.[1] ?? 0);
      const level = Number(/l(\d+)/.exec(marker)?.[1] ?? 0);
      const color = colorFor(slot, level, colorMode);
      const end = html.indexOf('</span>', closeTag);
      const text = html.slice(closeTag + 1, end).replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
      for (const ch of text) {
        cells.push({ ch, color, col, row });
        col += 1;
      }
      index = end + '</span>'.length;
    } else if (html[index] === '\n') {
      col = 0;
      row += 1;
      index += 1;
    } else {
      col += 1;
      index += 1;
    }
  }
  return cells;
}

function glyphOrigin(seed: number, width: number, height: number): { x: number; y: number; nx: number; ny: number } {
  const along = ((seed >>> 4) % 10_000) / 10_000;
  const margin = 24 + (seed % 48);
  switch (seed % 4) {
    case 0: return { x: -margin, y: along * height, nx: 0, ny: 1 };
    case 1: return { x: width + margin, y: along * height, nx: 0, ny: -1 };
    case 2: return { x: along * width, y: -margin, nx: -1, ny: 0 };
    default: return { x: along * width, y: height + margin, nx: 1, ny: 0 };
  }
}

function drawStars(context: CanvasRenderingContext2D, width: number, height: number, now: number): void {
  context.save();
  context.shadowBlur = 5;
  context.shadowColor = '#d8c7ff';
  for (let index = 0; index < 64; index++) {
    const x = ((index * 73) % 997) / 997 * width;
    const y = ((index * 193) % 991) / 991 * height;
    const glow = 0.18 + (Math.sin(now / 700 + index * 1.7) + 1) * 0.12;
    context.globalAlpha = glow;
    context.fillStyle = index % 5 === 0 ? '#f5d58a' : '#d8c7ff';
    context.fillRect(x, y, index % 7 === 0 ? 1.8 : 1, index % 7 === 0 ? 1.8 : 1);
  }
  context.restore();
}
