import {
  RESOLUTIONS,
  createScene,
  renderFrame,
  slotCss,
  toHtml,
  type BouquetId,
  type ColorMode,
  type ResolutionId,
  type Scene,
  type StyleId,
  type WrapId,
} from '../../engine/index.js';
import './styles.css';

interface Named { id: string; name: string }
interface Catalog {
  bouquets: Named[];
  styles: Named[];
  colorModes: Named[];
  wraps: Named[];
  resolutions: Named[];
}
interface Gift {
  id: number;
  shareUrl: string;
  bouquetId: BouquetId;
  style: StyleId;
  colorMode: ColorMode;
  wrap: WrapId;
  resolution: ResolutionId;
  fromName: string;
  message: string | null;
  recipientEmail: string | null;
  status: string;
  createdAt: string;
  openCount: number;
  sendError: string | null;
}
interface ApiError { error: string; message: string }

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(selector);
  return node;
}

const app = required<HTMLElement>('#app');
const colors = document.createElement('style');
colors.textContent = slotCss();
document.head.appendChild(colors);

const choice = {
  bouquetId: 'roses' as BouquetId,
  style: 'classique' as StyleId,
  colorMode: 'color' as ColorMode,
  wrap: 'paper' as WrapId,
  resolution: 'high' as ResolutionId,
};

let catalog: Catalog | null = null;
let scene: Scene | null = null;
let frame = 0;
let running = false;
let clock = 0;

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function resolutionOf(id: ResolutionId) {
  const found = RESOLUTIONS.find((item) => item.id === id) ?? RESOLUTIONS[1] ?? RESOLUTIONS[0];
  if (!found) throw new Error('résolution');
  return found;
}

function ensureScene(cols: number, rows: number): Scene {
  if (!scene || scene.options.bouquetId !== choice.bouquetId || scene.options.cols !== cols || scene.options.rows !== rows) {
    scene = createScene({
      bouquetId: choice.bouquetId,
      style: choice.style,
      wrap: choice.wrap,
      cols,
      rows,
      seed: 1,
      wind: 1,
    });
    clock = 6;
  }
  scene.options.style = choice.style;
  scene.options.wrap = choice.wrap;
  return scene;
}

function paint(target: HTMLElement, cols: number, rows: number, animate: boolean): void {
  const current = ensureScene(cols, rows);
  const time = animate ? clock : 6;
  const grid = renderFrame(current, time, 8, animate ? 0 : 0);
  target.className = `art${choice.colorMode === 'color' ? '' : ` mono ${choice.colorMode}`}`;
  target.innerHTML = toHtml(grid, { style: choice.style, colorMode: choice.colorMode, t: time });
}

function fit(pre: HTMLElement, box: HTMLElement, cols: number, rows: number): void {
  const width = box.clientWidth;
  const height = box.clientHeight;
  if (width < 20 || height < 20) return;
  const size = Math.max(2, Math.min((width - 12) / (cols * 0.6), (height - 12) / rows));
  pre.style.fontSize = `${size.toFixed(2)}px`;
}

function loop(): void {
  if (!running) return;
  frame = requestAnimationFrame(loop);
  const pre = document.querySelector<HTMLElement>('#preview');
  const box = pre?.parentElement;
  const resolution = resolutionOf(choice.resolution);
  if (!pre || !box || !resolution) return;
  clock += 1 / 30;
  paint(pre, resolution.cols, resolution.rows, true);
  fit(pre, box, resolution.cols, resolution.rows);
}

function stop(): void {
  running = false;
  cancelAnimationFrame(frame);
}

function pills(items: Named[], current: string, onPick: (id: string) => void): HTMLElement {
  const wrap = el('div', 'pills');
  for (const item of items) {
    const button = el('button', '', item.name);
    button.type = 'button';
    button.dataset.id = item.id;
    button.setAttribute('aria-pressed', String(item.id === current));
    button.addEventListener('click', () => {
      onPick(item.id);
      for (const child of wrap.querySelectorAll('button')) {
        child.setAttribute('aria-pressed', String(child.dataset.id === item.id));
      }
    });
    wrap.append(button);
  }
  return wrap;
}

function showLogin(message = ''): void {
  stop();
  app.replaceChildren();
  const screen = el('div', 'login');
  const form = el('form');
  form.append(el('h1', '', 'FlowerGift'));
  form.append(el('p', 'muted', 'Entre dans le jardin.'));
  const email = el('input');
  email.type = 'email';
  email.name = 'email';
  email.autocomplete = 'username';
  email.required = true;
  const password = el('input');
  password.type = 'password';
  password.name = 'password';
  password.autocomplete = 'current-password';
  password.required = true;
  const error = el('p', 'error', message);
  const submit = el('button', 'primary', 'Entrer');
  submit.type = 'submit';
  form.append(el('label', '', 'Courriel'), email, el('label', '', 'Mot de passe'), password, error, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const result = await api<ApiError>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    if (result.status === 200) await showDash();
    else error.textContent = result.body?.message ?? 'Connexion impossible';
  });
  screen.append(form);
  app.append(screen);
  email.focus();
}

async function showDash(): Promise<void> {
  const me = await api<{ email: string; smtpConfigured: boolean }>('/api/me');
  if (me.status !== 200) return showLogin();
  const loaded = await api<Catalog>('/api/catalog');
  if (loaded.status !== 200 || !loaded.body) return showLogin();
  catalog = loaded.body;
  app.replaceChildren();
  const dash = el('div', 'dash');
  const head = el('div', 'row');
  head.append(el('h1', '', 'FlowerGift'), el('span', 'muted', me.body.email));
  const logout = el('button', 'ghost', 'Sortir');
  logout.type = 'button';
  logout.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    showLogin();
  });
  head.append(logout);
  dash.append(head);
  if (!me.body.smtpConfigured) {
    dash.append(el('p', 'banner', 'Les mails ne partent pas encore. Ajoute SMTP_USER et SMTP_PASS dans .env, puis redémarre.'));
  }

  const layout = el('div', 'layout');
  const stage = el('div', 'preview');
  const preview = el('pre', 'art');
  preview.id = 'preview';
  stage.append(preview);
  const side = el('div');
  const thumbs = el('div', 'thumbs');
  side.append(el('h2', '', 'Bouquets'), thumbs);
  side.append(el('h2', '', 'Style'), pills(catalog.styles, choice.style, (id) => { choice.style = id as StyleId; }));
  side.append(el('h2', '', 'Couleurs'), pills(catalog.colorModes, choice.colorMode, (id) => { choice.colorMode = id as ColorMode; }));
  side.append(el('h2', '', 'Emballage'), pills(catalog.wraps, choice.wrap, (id) => { choice.wrap = id as WrapId; }));
  side.append(el('h2', '', 'Résolution'), pills(catalog.resolutions, choice.resolution, (id) => { choice.resolution = id as ResolutionId; scene = null; }));

  const fromName = el('input');
  fromName.value = 'Arthur';
  fromName.maxLength = 60;
  fromName.required = true;
  const message = el('textarea');
  message.maxLength = 500;
  const email = el('input');
  email.type = 'email';
  email.placeholder = 'pour un envoi';
  const linkButton = el('button', 'primary', 'Générer un lien');
  linkButton.type = 'button';
  const sendButton = el('button', 'ghost', 'Envoyer par mail');
  sendButton.type = 'button';
  const note = el('p', 'muted', 'Toute personne qui a le lien peut voir le cadeau.');
  const feedback = el('p', 'error');
  const share = el('p', 'share');
  side.append(el('label', '', 'De la part de'), fromName, el('label', '', 'Message'), message, el('label', '', 'Courriel du destinataire'), email);
  const actions = el('div', 'row');
  actions.append(linkButton, sendButton);
  side.append(actions, note, feedback, share);
  layout.append(stage, side);
  dash.append(layout);
  const history = el('section');
  history.append(el('h2', '', 'Historique'));
  const list = el('div', 'history');
  history.append(list);
  dash.append(history);
  app.append(dash);

  const selected = choice.bouquetId;
  const small = RESOLUTIONS[0];
  for (const bouquet of catalog.bouquets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = bouquet.id;
    button.setAttribute('aria-pressed', String(bouquet.id === selected));
    button.setAttribute('aria-label', bouquet.name);
    const thumb = el('pre', 'art');
    choice.bouquetId = bouquet.id as BouquetId;
    scene = null;
    if (small) paint(thumb, small.cols, Math.round(small.rows * 0.45), false);
    button.append(thumb, el('span', '', bouquet.name));
    button.addEventListener('click', () => {
      choice.bouquetId = bouquet.id as BouquetId;
      scene = null;
      for (const child of thumbs.querySelectorAll('button')) {
        child.setAttribute('aria-pressed', String(child.dataset.id === bouquet.id));
      }
    });
    thumbs.append(button);
  }
  choice.bouquetId = selected;
  scene = null;

  async function payload() {
    return {
      ...choice,
      fromName: fromName.value.trim(),
      message: message.value,
      recipientEmail: email.value.trim(),
    };
  }

  linkButton.addEventListener('click', async () => {
    feedback.textContent = '';
    if (!fromName.value.trim()) { feedback.textContent = 'Indique ton prénom.'; return; }
    const result = await api<Gift & ApiError>('/api/gifts', { method: 'POST', body: JSON.stringify(await payload()) });
    if (result.status !== 201 || !result.body.shareUrl) { feedback.textContent = result.body.message ?? 'Création impossible'; return; }
    share.textContent = result.body.shareUrl;
    try { await navigator.clipboard.writeText(result.body.shareUrl); feedback.textContent = 'Lien copié.'; }
    catch { feedback.textContent = 'Lien prêt, copie-le à la main.'; }
    await refreshHistory();
  });

  sendButton.addEventListener('click', async () => {
    feedback.textContent = '';
    if (!fromName.value.trim() || !email.value.trim()) { feedback.textContent = 'Il faut un prénom et un courriel.'; return; }
    const created = await api<Gift & ApiError>('/api/gifts', { method: 'POST', body: JSON.stringify(await payload()) });
    if (created.status !== 201 || !created.body.id) { feedback.textContent = created.body.message ?? 'Création impossible'; return; }
    const sent = await api<Gift & ApiError>(`/api/gifts/${created.body.id}/send`, { method: 'POST', body: '{}' });
    feedback.textContent = sent.status === 200 ? 'Mail confié au serveur.' : (sent.body.message ?? 'Envoi impossible');
    share.textContent = created.body.shareUrl;
    await refreshHistory();
  });

  async function refreshHistory(): Promise<void> {
    const result = await api<{ items: Gift[] }>('/api/gifts');
    list.replaceChildren();
    if (result.status !== 200) return;
    for (const gift of result.body.items) {
      const card = el('article');
      card.append(el('strong', '', `${gift.fromName} · ${gift.status}`));
      card.append(el('p', 'muted', new Date(gift.createdAt).toLocaleString('fr')));
      if (gift.message) card.append(el('p', '', gift.message));
      const url = el('p', 'share', gift.shareUrl);
      const buttons = el('div', 'row');
      const copy = el('button', 'ghost', 'Copier');
      copy.type = 'button';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(gift.shareUrl); } catch { /* le lien reste affiché */ } });
      const revoke = el('button', 'ghost', 'Révoquer');
      revoke.type = 'button';
      revoke.addEventListener('click', async () => { await api(`/api/gifts/${gift.id}/revoke`, { method: 'POST' }); await refreshHistory(); });
      const remove = el('button', 'ghost', 'Supprimer');
      remove.type = 'button';
      remove.addEventListener('click', async () => { await api(`/api/gifts/${gift.id}`, { method: 'DELETE' }); await refreshHistory(); });
      buttons.append(copy, revoke, remove);
      card.append(url, buttons);
      list.append(card);
    }
    if (result.body.items.length === 0) list.append(el('p', 'muted', 'Aucun cadeau pour l’instant.'));
  }

  await refreshHistory();
  running = true;
  loop();
}

const me = await api('/api/me');
if (me.status === 200) await showDash();
else showLogin();
