'use strict';
/* Pinturas: colores sólidos y gradientes de bajo contraste cromático */
function hex2rgb(hex) {
  let x = String(hex || '#000').replace('#', '');
  if (x.length === 3) x = [...x].map((c) => c + c).join('');
  const n = parseInt(x.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb2hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
const rgba = (c, a) => { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; };

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  let H = 0;
  if (d) {
    if (M === r) H = ((g - b) / d) % 6;
    else if (M === g) H = (b - r) / d + 2;
    else H = (r - g) / d + 4;
    H *= 60; if (H < 0) H += 360;
  }
  return [H, M ? d / M : 0, M];
}
function hsv2rgb(H, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = v - c;
  const t = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return t.map((u) => (u + m) * 255);
}

const solid = (c, a) => (a == null ? { t: 'solid', c } : { t: 'solid', c, a });
const NONE = { t: 'none' };

function _stops(list) {
  return list.map((s, i) => (typeof s === 'string'
    ? { o: list.length > 1 ? i / (list.length - 1) : 0, c: s }
    : { o: s[1], c: s[0], ...(s[2] != null ? { a: s[2] } : {}) }));
}
const _L = (n, a, ...s) => ({ n, p: { t: 'linear', a, s: _stops(s), g: 0.3 } });
const _R = (n, x, y, ...s) => ({ n, p: { t: 'radial', x, y, s: _stops(s), g: 0.3 } });

const GRADIENTS = [
  _L('Ónix', 160, '#2a2b2f', '#0c0d10'),
  _L('Grafito', 145, '#3a3c42', '#16171b'),
  _R('Humo', 0.3, 0.15, '#4b4c52', ['#1c1d21', 0.62], '#0e0f12'),
  _L('Neblina', 135, '#65686e', '#2a2c31'),
  _L('Ceniza', 170, '#4a4641', '#1c1a18'),
  _R('Foco', 0.5, 0, '#6a6862', ['#24231f', 0.55], '#0f0f0e'),
  _L('Tungsteno', 150, '#4e3d2a', '#1f1914', '#100e0c'),
  _R('Ámbar tenue', 0.82, 1, '#7c5c38', ['#2d231a', 0.58], '#12100e'),
  _L('Cobre', 135, '#5c3d2d', '#241813'),
  _L('Ocaso', 170, '#15161d', ['#3a2a2e', 0.6], '#7a5240'),
  _L('Vino', 150, '#4b2027', '#221013', '#110809'),
  _R('Granate', 0.25, 0.2, '#5f2b31', ['#2a1417', 0.6], '#140a0c'),
  _L('Petróleo', 155, '#20393f', '#101d21', '#0a1114'),
  _L('Madrugada', 180, '#25394b', '#131d27', '#0b0f14'),
  _L('Acero', 140, '#47535f', '#1a2027'),
  _R('Luz de luna', 0.7, 0.05, '#5d6f84', ['#1d2530', 0.6], '#0b0e13'),
  _L('Índigo', 150, '#2c2b4e', '#15142b', '#0b0b16'),
  _L('Malva', 150, '#463b50', '#1d1823'),
  _L('Musgo', 150, '#303b2b', '#161b14'),
  _L('Oliva', 150, '#464631', '#1c1c13'),
  _L('Teal y ámbar', 120, '#14343c', ['#14171a', 0.5], '#5b3b25'),
  _L('Horizonte', 180, '#0b0c10', ['#1d2430', 0.55], '#5c5b59'),
  _R('Eclipse', 0.5, 1.18, '#b9a98f', ['#3b342b', 0.13], ['#131211', 0.4], '#08080a'),
  _L('Hueso', 145, '#ded7ca', '#a9a194'),
];
const FRAME_FILL = { t: 'linear', a: 165, s: [{ o: 0, c: '#ffffff', a: 0.045 }, { o: 1, c: '#ffffff', a: 0.012 }], g: 0 };

function grad(name) {
  const g = GRADIENTS.find((x) => x.n === name) || GRADIENTS[0];
  return clone(g.p);
}

const SWATCHES = [
  '#f2eee6', '#c9c5bc', '#8c8981', '#55534e', '#2b2a28', '#0e0e10',
  '#d9bd94', '#b98f5e', '#8a5f34', '#c07f62', '#9c5546', '#6e2a32',
  '#a9c0c2', '#6f9aa0', '#2f5e68', '#8ea4bb', '#5a738e', '#2c3f58',
  '#b4bd9c', '#7f8f68', '#46553a', '#a79bc0', '#6e6491', '#3d3760',
];

const BRANCH_COLORS = ['#d9bd94', '#8fb0b4', '#b98f8a', '#a3b08c', '#9f9ac0', '#c2a877', '#7f9bb5', '#b39a78'];

const SCENES = [
  { id: 'noir', n: 'Noir', base: '#08090b', key: '#7b8088', rim: '#31353c', haze: '#3f434a', kx: -0.5, ky: 0.42, rx: 0.65, ry: -0.42 },
  { id: 'tungsteno', n: 'Tungsteno', base: '#0a0908', key: '#86694a', rim: '#20343a', haze: '#3a2d21', kx: 0.55, ky: -0.42, rx: -0.6, ry: 0.4 },
  { id: 'madrugada', n: 'Madrugada', base: '#070b0d', key: '#3c6a74', rim: '#20354f', haze: '#1e383d', kx: -0.35, ky: 0.48, rx: 0.65, ry: -0.3 },
  { id: 'vino', n: 'Vino', base: '#0b0708', key: '#6c3840', rim: '#2e1e2e', haze: '#361e23', kx: 0.45, ky: 0.42, rx: -0.65, ry: -0.35 },
  { id: 'luna', n: 'Luz de luna', base: '#080a0e', key: '#8a9fbb', rim: '#2c3850', haze: '#323e50', kx: 0.42, ky: 0.5, rx: -0.65, ry: -0.42 },
  { id: 'musgo', n: 'Musgo', base: '#090b08', key: '#5c6f46', rim: '#2c3328', haze: '#2d3727', kx: -0.5, ky: -0.36, rx: 0.6, ry: 0.42 },
  { id: 'indigo', n: 'Índigo', base: '#08080e', key: '#4f4a80', rim: '#222d4c', haze: '#2a2848', kx: 0.5, ky: 0.4, rx: -0.55, ry: -0.44 },
  { id: 'ceniza', n: 'Ceniza', base: '#0e0d0c', key: '#7d756a', rim: '#3e3a34', haze: '#514b43', kx: 0, ky: 0.55, rx: 0.65, ry: -0.5 },
  { id: 'ocaso', n: 'Ocaso', base: '#0a0809', key: '#8e6248', rim: '#2b2540', haze: '#35232a', kx: 0.1, ky: -0.72, rx: -0.5, ry: 0.5 },
  { id: 'eclipse', n: 'Eclipse', base: '#050506', key: '#c6b08f', rim: '#3a3a40', haze: '#1b1b1d', kx: 0.42, ky: 0.05, rx: -0.6, ry: -0.42, ring: 1 },
  { id: 'negro', n: 'Sin luz', base: '#09090b', key: '#000000', rim: '#000000', haze: '#000000', kx: 0, ky: 0, rx: 0, ry: 0 },
];

function sceneCSS(sc) {
  const k = rgba(sc.key, 0.5), r = rgba(sc.rim, 0.55);
  const x1 = 50 + sc.kx * 62, y1 = 50 - sc.ky * 62, x2 = 50 + sc.rx * 62, y2 = 50 - sc.ry * 62;
  return `radial-gradient(90% 90% at ${x1}% ${y1}%, ${k}, transparent 70%), radial-gradient(70% 70% at ${x2}% ${y2}%, ${r}, transparent 72%), ${sc.base}`;
}

const stopColor = (s) => (s.a != null && s.a < 1 ? rgba(s.c, s.a) : s.c);

function paintCSS(p) {
  if (!p || p.t === 'none') return 'transparent';
  if (p.t === 'solid') return p.a != null && p.a < 1 ? rgba(p.c, p.a) : p.c;
  const st = p.s.map((s) => `${stopColor(s)} ${round2(s.o * 100)}%`).join(',');
  if (p.t === 'linear') return `linear-gradient(${p.a}deg,${st})`;
  return `radial-gradient(circle at ${round2(p.x * 100)}% ${round2(p.y * 100)}%,${st})`;
}

function linearPts(a, w, H) {
  const t = (a * Math.PI) / 180, sx = Math.sin(t), cy = Math.cos(t);
  const L = Math.abs(w * sx) + Math.abs(H * cy);
  return [w / 2 - (sx * L) / 2, H / 2 + (cy * L) / 2, w / 2 + (sx * L) / 2, H / 2 - (cy * L) / 2];
}
function radialR(p, w, H) {
  const cx = p.x * w, cy = p.y * H;
  return Math.max(1, Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, H - cy), Math.hypot(w - cx, H - cy)) * (p.r || 1);
}

function paintSVG(p, w, H, defs, id) {
  if (!p || p.t === 'none') return 'none';
  if (p.t === 'solid') return paintCSS(p);
  const stops = p.s.map((s) => sv('stop', { offset: s.o, 'stop-color': s.c, 'stop-opacity': s.a != null ? s.a : null }));
  let g;
  if (p.t === 'linear') {
    const [x1, y1, x2, y2] = linearPts(p.a, w, H);
    g = sv('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, stops);
  } else {
    g = sv('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx: p.x * w, cy: p.y * H, r: radialR(p, w, H) }, stops);
  }
  defs.append(g);
  return `url(#${id})`;
}

function paintAlong(p, A, B, defs, id) {
  if (!p || p.t === 'none') return 'none';
  if (p.t === 'solid') return paintCSS(p);
  const stops = p.s.map((s) => sv('stop', { offset: s.o, 'stop-color': s.c, 'stop-opacity': s.a != null ? s.a : null }));
  defs.append(sv('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: A.x, y1: A.y, x2: B.x + 0.01, y2: B.y + 0.01 }, stops));
  return `url(#${id})`;
}

function paintCanvas(ctx, p, w, H) {
  if (!p || p.t === 'none') return null;
  if (p.t === 'solid') return paintCSS(p);
  let g;
  if (p.t === 'linear') {
    const [x1, y1, x2, y2] = linearPts(p.a, w, H);
    g = ctx.createLinearGradient(x1, y1, x2, y2);
  } else {
    g = ctx.createRadialGradient(p.x * w, p.y * H, 0, p.x * w, p.y * H, radialR(p, w, H));
  }
  for (const s of p.s) g.addColorStop(clamp(s.o, 0, 1), stopColor(s));
  return g;
}

const firstColor = (p) => (p?.t === 'solid' ? paintCSS(p) : p?.s ? stopColor(p.s[0]) : '#ccc');
const lastColor = (p) => (p?.t === 'solid' ? paintCSS(p) : p?.s ? stopColor(p.s[p.s.length - 1]) : '#ccc');

/* Grano fino: evita el banding en gradientes oscuros */
let GRAIN_URL = '';
function initGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const x = c.getContext('2d'), im = x.createImageData(180, 180);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random();
    const light = v > 0.5 ? 255 : 0;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = light;
    im.data[i + 3] = Math.abs(v - 0.5) * 2 * 42;
  }
  x.putImageData(im, 0, 0);
  GRAIN_URL = c.toDataURL('image/png');
  const defs = sv('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' },
    sv('defs', {}, sv('pattern', { id: 'grainP', width: 180, height: 180, patternUnits: 'userSpaceOnUse' },
      sv('image', { href: GRAIN_URL, width: 180, height: 180 }))));
  document.body.prepend(defs);
  document.documentElement.style.setProperty('--grain', `url(${GRAIN_URL})`);
}
