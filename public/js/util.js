'use strict';
/* Utilidades, iconos y diálogos */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

function _fill(e, p, k) {
  if (p) for (const a in p) {
    const v = p[a];
    if (v == null || v === false) continue;
    if (a === 'style' && typeof v === 'object') {
      for (const k in v) { if (k.startsWith('--')) e.style.setProperty(k, v[k]); else e.style[k] = v[k]; }
    }
    else if (a.startsWith('on') && typeof v === 'function') e.addEventListener(a.slice(2), v);
    else if (a === 'text') e.textContent = v;
    else e.setAttribute(a, v === true ? '' : v);
  }
  for (const c of k.flat(9)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : String(c));
  }
  return e;
}
const h = (t, p, ...k) => _fill(document.createElement(t), p, k);
const sv = (t, p, ...k) => _fill(document.createElementNS(SVGNS, t), p, k);

function setKids(n, ...k) { n.replaceChildren(...k.flat(9).filter((x) => x != null && x !== false)); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const round2 = (n) => Math.round(n * 100) / 100;

function uid(n = 12) {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = a[Math.floor(Math.random() * 26)];
  for (const x of crypto.getRandomValues(new Uint8Array(n - 1))) s += a[x % 36];
  return s;
}

function throttle(fn, ms) {
  let last = 0, t = null, args;
  const run = () => { last = performance.now(); t = null; fn(...args); };
  return (...a) => {
    args = a;
    const d = ms - (performance.now() - last);
    if (d <= 0) { clearTimeout(t); run(); } else if (!t) t = setTimeout(run, d);
  };
}
function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

const LS = {
  get(k, d) { try { const v = localStorage.getItem('seebase.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('seebase.' + k, JSON.stringify(v)); } catch {} },
};

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const ICONS = {
  select: '<path d="M5 3.5l14 8-6.2 1.6L10 19.5z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  sticky: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9l-5 5H6a2 2 0 0 1-2-2z"/><path d="M15 20v-3a2 2 0 0 1 2-2h3"/>',
  text: '<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
  shapes: '<rect x="3.5" y="3.5" width="10" height="10" rx="1.5"/><circle cx="15.5" cy="15.5" r="5"/>',
  line: '<circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><path d="M7 17.5C13 17.5 11 6.5 17 6.5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l6.6 6.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  frame: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-4.5-4.5L7 20"/>',
  mind: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5.5" r="1.8"/><circle cx="19.5" cy="5.5" r="1.8"/><circle cx="4.5" cy="18.5" r="1.8"/><circle cx="19.5" cy="18.5" r="1.8"/><path d="M9.7 10 5.9 6.7M14.3 10l3.8-3.3M9.7 14l-3.8 3.3M14.3 14l3.8 3.3"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
  comment: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  stamp: '<path d="M12 3a4 4 0 0 0-2.5 7.1c.6.5 1 1.2 1 2V14H6a2 2 0 0 0-2 2v2h16v-2a2 2 0 0 0-2-2h-4.5v-1.9c0-.8.4-1.5 1-2A4 4 0 0 0 12 3z"/><path d="M5 21h14"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="m3 3 18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3 3.8M6.6 6.6A18 18 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  group: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="7" height="6" rx="1"/><rect x="10" y="11" width="7" height="6" rx="1"/>',
  ungroup: '<rect x="3.5" y="3.5" width="9" height="8" rx="1"/><rect x="11.5" y="12.5" width="9" height="8" rx="1"/>',
  front: '<path d="M12 20V8M6.5 13.5 12 8l5.5 5.5M5 4h14"/>',
  back: '<path d="M12 4v12M6.5 10.5 12 16l5.5-5.5M5 20h14"/>',
  alignL: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alignC: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignR: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  alignT: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  alignM: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignB: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  distH: '<path d="M4 3v18M20 3v18"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>',
  distV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>',
  flipH: '<path d="M12 3v18"/><path d="M8 7 3 17h5zM16 7l5 10h-5z"/>',
  flipV: '<path d="M3 12h18"/><path d="M7 8 17 3v5zM7 16l10 5v-5z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>',
  chevR: '<path d="m9 5 7 7-7 7"/>',
  chevD: '<path d="m5 9 7 7 7-7"/>',
  chevU: '<path d="m5 15 7-7 7 7"/>',
  grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  map: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="6" height="5" rx="1"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
  download: '<path d="M12 3v12M7 10.5l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 8.5l5-5 5 5M4 20h16"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 9.5V20h14V9.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8"/><path d="M12 17h.01"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M14 5h5M5 19h5M14.5 5l-5 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/>',
  tL: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  tC: '<path d="M4 6h16M7 12h10M5.5 18h13"/>',
  tR: '<path d="M4 6h16M10 12h10M7 18h13"/>',
  vT: '<path d="M4 4h16M12 20V9M8 12.5l4-4 4 4"/>',
  vM: '<path d="M4 12h16M12 3v5M12 21v-5M9.5 6 12 8.5 14.5 6M9.5 18l2.5-2.5 2.5 2.5"/>',
  vB: '<path d="M4 20h16M12 4v11M8 11.5l4 4 4-4"/>',
  vote: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  logo: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  routeS: '<path d="M5 19 19 5"/>',
  routeC: '<path d="M5 19C13 19 11 5 19 5"/>',
  routeE: '<path d="M5 19h7V5h7"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  command: '<path d="M9 9h6v6H9zM9 9V6a3 3 0 1 0-3 3zM15 9h3a3 3 0 1 0-3-3zM15 15v3a3 3 0 1 0 3-3zM9 15H6a3 3 0 1 0 3 3z"/>',
  wand: '<path d="m4 20 11-11M15 4V2M15 12v-1M19 8h2M9 8H8M18 5l1-1M12 5l-1-1M18 11l1 1"/>',
  grip: '<circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
};

function icon(name, size = 18) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.5');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

function btn(ic, title, onclick, cls = '') {
  return h('button', { class: 'ib ' + cls, type: 'button', title, 'aria-label': title, onclick }, icon(ic));
}

function toast(msg, opt = {}) {
  const t = h('div', { class: 'toast glass', role: 'status' }, h('span', {}, msg),
    opt.action && h('button', { class: 'link', type: 'button', onclick() { opt.action.fn(); t.remove(); } }, opt.action.label));
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, opt.ms || 3400);
}

function modal(content, { cls = '', onClose } = {}) {
  const box = h('div', { class: 'modal glass ' + cls, role: 'dialog', 'aria-modal': 'true' }, content);
  const wrap = h('div', { class: 'modal-wrap', onpointerdown(e) { if (e.target === wrap) closeIt(); } }, box);
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeIt(); } };
  function closeIt() { wrap.remove(); document.removeEventListener('keydown', onKey, true); onClose?.(); }
  document.addEventListener('keydown', onKey, true);
  document.body.append(wrap);
  return { close: closeIt, box, wrap };
}

function ask({ title, text, ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
    const m = modal([
      h('h3', {}, title),
      text && h('p', { class: 'muted' }, text),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => finish(false) }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => finish(true) }, ok)),
    ], { onClose: () => finish(false) });
  });
}

function askText({ title, value = '', placeholder = '', ok = 'Guardar', id = 'ask-text' }) {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
    const input = h('input', { class: 'input', id, value, placeholder, onkeydown(e) { if (e.key === 'Enter') finish(input.value.trim()); } });
    const m = modal([
      h('h3', {}, title), input,
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => finish(null) }, 'Cancelar'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => finish(input.value.trim()) }, ok)),
    ], { onClose: () => finish(null) });
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

function copyText(text) {
  try {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch { return Promise.resolve(false); }
}

function loadImg(src, cors) {
  return new Promise((res, rej) => {
    const i = document.createElement('img');
    if (cors) i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

function saveFile(blob, filename) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h2 = Math.round(m / 60);
  if (h2 < 24) return `hace ${h2} h`;
  const d = Math.round(h2 / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(t).toLocaleDateString('es');
}
