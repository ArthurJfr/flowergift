import {
  BOUQUETS,
  COLOR_MODES,
  RESOLUTIONS,
  STYLES,
  WRAPS,
  clearParticles,
  createScene,
  renderFrame,
  slotCss,
  toHtml,
  type Scene,
} from '../../engine/index.js';

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`élément manquant : ${selector}`);
  return node;
}

const art = required<HTMLPreElement>('#art');
const stage = required<HTMLElement>('#stage');
const toast = required<HTMLElement>('#toast');
const pauseButton = required<HTMLButtonElement>('#bPause');

const slotStyle = document.createElement('style');
slotStyle.textContent = slotCss();
document.head.appendChild(slotStyle);

const ui = {
  bouquet: 0,
  style: 0,
  color: 0,
  wrap: 0,
  res: 1,
  wind: 1,
  speed: 1,
  part: true,
  paused: false,
};

let tw = 0;
let tb = 0;
let chw = 0.6;
let scene: Scene = makeScene();

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(label);
  return value;
}

function makeScene(): Scene {
  const resolution = must(RESOLUTIONS[ui.res], 'résolution');
  const bouquet = must(BOUQUETS[ui.bouquet], 'bouquet');
  const style = must(STYLES[ui.style], 'style');
  const wrap = must(WRAPS[ui.wrap], 'emballage');
  return createScene({
    bouquetId: bouquet.id,
    style: style.id,
    wrap: wrap.id,
    cols: resolution.cols,
    rows: resolution.rows,
    charAspect: chw,
    wind: ui.wind,
    seed: 1,
    petals: ui.part,
  });
}

function syncOptions(): void {
  const resolution = must(RESOLUTIONS[ui.res], 'résolution');
  const style = must(STYLES[ui.style], 'style');
  const wrap = must(WRAPS[ui.wrap], 'emballage');
  scene.options.style = style.id;
  scene.options.wrap = wrap.id;
  scene.options.cols = resolution.cols;
  scene.options.rows = resolution.rows;
  scene.options.charAspect = chw;
  scene.options.wind = ui.wind;
  scene.options.petals = ui.part;
}

function draw(dt: number): void {
  syncOptions();
  const style = must(STYLES[ui.style], 'style').id;
  const colorMode = must(COLOR_MODES[ui.color], 'couleur').id;
  const grid = renderFrame(scene, tw, tb, dt);
  art.innerHTML = toHtml(grid, { style, colorMode, t: tw });
}

function pills(id: string, items: readonly { name: string }[], key: 'bouquet' | 'style' | 'color' | 'wrap' | 'res', after?: () => void): () => void {
  const el = document.querySelector<HTMLElement>(`#${id}`);
  if (!el) throw new Error(id);
  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.name;
    button.addEventListener('click', () => {
      ui[key] = index;
      sync();
      after?.();
    });
    el.appendChild(button);
  });
  return () => {
    [...el.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(ui[key] === index));
    });
  };
}

const syncs = [
  pills('pBouquet', BOUQUETS, 'bouquet', () => {
    scene = makeScene();
    replay();
  }),
  pills('pStyle', STYLES, 'style'),
  pills('pColor', COLOR_MODES, 'color', applyColor),
  pills('pWrap', WRAPS, 'wrap', () => replay()),
  pills('pRes', RESOLUTIONS, 'res', () => fit()),
];

function sync(): void {
  for (const update of syncs) update();
}

function applyColor(): void {
  const id = must(COLOR_MODES[ui.color], 'couleur').id;
  art.classList.toggle('mono', id !== 'color');
  for (const mode of ['mono-green', 'mono-amber', 'mono-white'] as const) {
    art.classList.toggle(mode, mode === id);
  }
}

function replay(): void {
  tb = 0;
  clearParticles(scene);
}

function setPause(paused: boolean): void {
  ui.paused = paused;
  pauseButton.textContent = paused ? '▶ Lecture' : '⏸ Pause';
}

const wind = document.querySelector<HTMLInputElement>('#rWind');
const speed = document.querySelector<HTMLInputElement>('#rSpeed');
const petals = document.querySelector<HTMLInputElement>('#cPart');
wind?.addEventListener('input', () => {
  ui.wind = Number(wind.value);
});
speed?.addEventListener('input', () => {
  ui.speed = Number(speed.value);
});
petals?.addEventListener('change', () => {
  ui.part = petals.checked;
});
document.querySelector('#bReplay')?.addEventListener('click', () => replay());
pauseButton.addEventListener('click', () => setPause(!ui.paused));

let toastTimer = 0;
function say(message: string): void {
  toast.textContent = message;
  toast.classList.add('on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('on'), 1600);
}

document.querySelector('#bCopy')?.addEventListener('click', async () => {
  const text = (art.textContent ?? '').replace(/[ \t]+$/gm, '').replace(/\n+$/, '\n');
  try {
    await navigator.clipboard.writeText(text);
    say('Image ASCII copiée');
  } catch {
    say('Copie impossible ici');
  }
});

addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === 'range' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
  if (event.key >= '1' && event.key <= '6') {
    ui.bouquet = Number(event.key) - 1;
    scene = makeScene();
    replay();
    sync();
  } else if (event.key === 'ArrowRight') {
    ui.style = (ui.style + 1) % STYLES.length;
    sync();
  } else if (event.key === 'ArrowLeft') {
    ui.style = (ui.style + STYLES.length - 1) % STYLES.length;
    sync();
  } else if (event.key === ' ' && !(target instanceof HTMLButtonElement)) {
    event.preventDefault();
    setPause(!ui.paused);
  }
});

function measure(): void {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:100px;line-height:1;font-family:${getComputedStyle(art).fontFamily}`;
  probe.textContent = 'M'.repeat(50);
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 50 / 100;
  probe.remove();
  if (width > 0.3 && width < 0.8) chw = width;
}

function fit(): void {
  const box = stage.getBoundingClientRect();
  const cols = scene.options.cols;
  const rows = scene.options.rows;
  const size = Math.max(3, Math.min((box.width - 16) / (cols * chw), (box.height - 16) / rows));
  art.style.fontSize = `${size.toFixed(2)}px`;
}

new ResizeObserver(fit).observe(stage);

const params = new URLSearchParams(location.search);
if (params.has('tb')) tb = Number(params.get('tb'));
if (params.has('tw')) tw = Number(params.get('tw'));
if (params.get('pause') === '1') setPause(true);

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  requestAnimationFrame(loop);
  const step = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += step;
  const budget = ui.res > 1 ? 1 / 20 : 1 / 30;
  if (acc < budget) return;
  const dt = acc;
  acc = 0;
  if (!ui.paused) {
    tw += dt * ui.speed;
    tb += dt * ui.speed;
  }
  draw(ui.paused ? 0 : dt * ui.speed);
}

sync();
applyColor();
const fontsReady = document.fonts?.ready ?? Promise.resolve();
void fontsReady.then(() => {
  measure();
  fit();
});
measure();
fit();
requestAnimationFrame(loop);

declare global {
  interface Window {
    __bouquet: {
      ui: typeof ui;
      replay: () => void;
      tb: number;
      tw: number;
    };
  }
}

window.__bouquet = {
  ui,
  replay,
  get tb() {
    return tb;
  },
  set tb(value: number) {
    tb = value;
  },
  get tw() {
    return tw;
  },
  set tw(value: number) {
    tw = value;
  },
};
