'use strict';
/* Geometría de formas, máscaras y conectores */
const fmt = (n) => Math.round(n * 100) / 100;

function rr(w, H, r) {
  r = Math.min(r || 0, w / 2, H / 2);
  if (!r) return `M0 0H${fmt(w)}V${fmt(H)}H0Z`;
  const R = fmt(r);
  return `M${R} 0H${fmt(w - r)}A${R} ${R} 0 0 1 ${fmt(w)} ${R}V${fmt(H - r)}A${R} ${R} 0 0 1 ${fmt(w - r)} ${fmt(H)}H${R}A${R} ${R} 0 0 1 0 ${fmt(H - r)}V${R}A${R} ${R} 0 0 1 ${R} 0Z`;
}
function ell(w, H) {
  const a = fmt(w / 2), b = fmt(H / 2);
  return `M0 ${b}A${a} ${b} 0 1 1 ${fmt(w)} ${b}A${a} ${b} 0 1 1 0 ${b}Z`;
}
function poly(pts, r) {
  const n = pts.length;
  if (!r) return 'M' + pts.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L') + 'Z';
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const q = Math.min(r, la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / la) * q, p[1] + ((a[1] - p[1]) / la) * q];
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * q, p[1] + ((b[1] - p[1]) / lb) * q];
    d += `${i ? 'L' : 'M'}${fmt(p1[0])} ${fmt(p1[1])}Q${fmt(p[0])} ${fmt(p[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d + 'Z';
}
const _P = (pts) => (w, H, r) => poly(pts.map(([x, y]) => [x * w, y * H]), r);
const _S = (d) => (w, H) => { let i = 0; return d.replace(/-?\d+(\.\d+)?/g, (m) => fmt((+m / 100) * (i++ % 2 ? H : w))); };

function _star(n, inner) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner : 1;
    pts.push([0.5 + Math.cos(a) * r * 0.5, 0.52 + Math.sin(a) * r * 0.5]);
  }
  return _P(pts);
}
function _ngon(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push([0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
  }
  return _P(pts);
}

const SHAPES = {
  rect: { n: 'Rectángulo', d: rr },
  ellipse: { n: 'Elipse', d: ell, inset: [0.15, 0.15, 0.15, 0.15] },
  triangle: { n: 'Triángulo', d: _P([[0.5, 0], [1, 1], [0, 1]]), inset: [0.46, 0.22, 0.05, 0.22] },
  diamond: { n: 'Rombo', d: _P([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]), inset: [0.25, 0.25, 0.25, 0.25] },
  pentagon: { n: 'Pentágono', d: _ngon(5), inset: [0.2, 0.18, 0.1, 0.18] },
  hexagon: { n: 'Hexágono', d: _P([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]), inset: [0.08, 0.2, 0.08, 0.2] },
  octagon: { n: 'Octágono', d: _P([[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]]), inset: [0.1, 0.1, 0.1, 0.1] },
  star: { n: 'Estrella', d: _star(5, 0.46), inset: [0.36, 0.3, 0.22, 0.3] },
  para: { n: 'Paralelogramo', d: _P([[0.18, 0], [1, 0], [0.82, 1], [0, 1]]), inset: [0.05, 0.2, 0.05, 0.2] },
  trapezoid: { n: 'Trapecio', d: _P([[0.18, 0], [0.82, 0], [1, 1], [0, 1]]), inset: [0.05, 0.2, 0.05, 0.2] },
  chevron: { n: 'Chevrón', d: _P([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]]), inset: [0.05, 0.26, 0.05, 0.26] },
  arrow: { n: 'Flecha', d: _P([[0, 0.28], [0.62, 0.28], [0.62, 0], [1, 0.5], [0.62, 1], [0.62, 0.72], [0, 0.72]]), inset: [0.3, 0.3, 0.3, 0.05] },
  cross: { n: 'Cruz', d: _P([[0.33, 0], [0.67, 0], [0.67, 0.33], [1, 0.33], [1, 0.67], [0.67, 0.67], [0.67, 1], [0.33, 1], [0.33, 0.67], [0, 0.67], [0, 0.33], [0.33, 0.33]]), inset: [0.33, 0.1, 0.33, 0.1] },
  bubble: { n: 'Globo', d: _P([[0, 0], [1, 0], [1, 0.78], [0.42, 0.78], [0.22, 1], [0.24, 0.78], [0, 0.78]]), inset: [0.04, 0.05, 0.26, 0.05] },
  cloud: { n: 'Nube', d: _S('M26 82C12 82 2 72 2 59C2 47 11 38 23 37C26 22 39 12 54 12C69 12 82 23 85 38C93 41 98 49 98 59C98 72 88 82 75 82Z'), inset: [0.28, 0.16, 0.2, 0.16] },
  heart: { n: 'Corazón', d: _S('M50 92C20 68 3 50 3 31C3 16 15 6 28 6C37 6 45 11 50 19C55 11 63 6 72 6C85 6 97 16 97 31C97 50 80 68 50 92Z'), inset: [0.2, 0.2, 0.28, 0.2] },
  doc: { n: 'Documento', d: _S('M0 0L100 0L100 86C75 106 50 68 25 86C15 93 7 94 0 90Z'), inset: [0.04, 0.05, 0.16, 0.05] },
  cylinder: {
    n: 'Base de datos',
    d: (w, H) => { const e = Math.min(H * 0.16, 26), a = fmt(w / 2); return `M0 ${fmt(e)}A${a} ${fmt(e)} 0 0 1 ${fmt(w)} ${fmt(e)}V${fmt(H - e)}A${a} ${fmt(e)} 0 0 1 0 ${fmt(H - e)}Z`; },
    extra: (w, H) => { const e = Math.min(H * 0.16, 26), a = fmt(w / 2); return `M0 ${fmt(e)}A${a} ${fmt(e)} 0 0 0 ${fmt(w)} ${fmt(e)}`; },
    inset: [0.26, 0.05, 0.08, 0.05],
  },
  arch: { n: 'Arco', d: (w, H) => { const r = Math.min(w / 2, H); return `M0 ${fmt(H)}V${fmt(r)}A${fmt(w / 2)} ${fmt(r)} 0 0 1 ${fmt(w)} ${fmt(r)}V${fmt(H)}Z`; } },
  squircle: { n: 'Súper elipse', d: _S('M50 0C90 0 100 10 100 50C100 90 90 100 50 100C10 100 0 90 0 50C0 10 10 0 50 0Z'), inset: [0.08, 0.08, 0.08, 0.08] },
  blob: { n: 'Orgánica', d: _S('M52 3C72 1 93 14 97 36C101 57 93 78 74 90C57 101 33 99 17 85C1 71 -2 47 7 29C15 13 33 5 52 3Z'), inset: [0.16, 0.16, 0.16, 0.16] },
};
const SHAPE_ORDER = ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'para', 'trapezoid', 'chevron', 'arrow', 'cross', 'bubble', 'cloud', 'heart', 'doc', 'cylinder', 'arch', 'squircle', 'blob'];
const MASK_ORDER = ['rect', 'ellipse', 'squircle', 'arch', 'hexagon', 'diamond', 'triangle', 'octagon', 'star', 'heart', 'cloud', 'blob'];

function shapeThumb(kind, s = 22) {
  const d = SHAPES[kind].d(s, s, kind === 'rect' ? 3 : 1.5);
  return sv('svg', { width: s, height: s, viewBox: `-1 -1 ${s + 2} ${s + 2}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'aria-hidden': 'true' }, sv('path', { d, 'stroke-linejoin': 'round' }));
}

/* ------------- Conectores ------------- */
const SIDE = { t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0] };
function rotV([x, y], deg) {
  if (!deg) return [x, y];
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}
const centerOf = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

function anchor(el, side) {
  const [nx, ny] = SIDE[side];
  const [dx, dy] = rotV([(nx * el.w) / 2, (ny * el.h) / 2], el.r || 0);
  const [ax, ay] = rotV([nx, ny], el.r || 0);
  return { x: el.x + el.w / 2 + dx, y: el.y + el.h / 2 + dy, nx: ax, ny: ay };
}
function autoSide(a, b) {
  const dx = b.x - (a.x + a.w / 2), dy = b.y - (a.y + a.h / 2);
  return Math.abs(dx) / (a.w / 2 + 1) > Math.abs(dy) / (a.h / 2 + 1) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
}
function endRef(end) {
  if (end.id) { const e = S.els.get(end.id); if (e) return centerOf(e); }
  return { x: end.x ?? 0, y: end.y ?? 0 };
}
function resolveEnd(end, other) {
  if (end.id) {
    const el = S.els.get(end.id);
    if (el) return anchor(el, end.side && end.side !== 'auto' ? end.side : autoSide(el, other));
  }
  return { x: end.x ?? 0, y: end.y ?? 0, nx: 0, ny: 0, free: true };
}
const _unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const _axis = (x, y) => (Math.abs(x) >= Math.abs(y) ? [Math.sign(x) || 1, 0] : [0, Math.sign(y) || 1]);
const capLen = (cap, sw) => (cap === 'arrow' || cap === 'tri' ? 5 + sw * 2.6 : 0);

function roundPolyline(pts, r) {
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const q = Math.min(r, la / 2, lb / 2);
    if (q < 0.5) { d += `L${fmt(p.x)} ${fmt(p.y)}`; continue; }
    d += `L${fmt(p.x + ((a.x - p.x) / la) * q)} ${fmt(p.y + ((a.y - p.y) / la) * q)}Q${fmt(p.x)} ${fmt(p.y)} ${fmt(p.x + ((b.x - p.x) / lb) * q)} ${fmt(p.y + ((b.y - p.y) / lb) * q)}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${fmt(l.x)} ${fmt(l.y)}`;
}
function elbowPoints(p0, n0, p3, n3) {
  const s = 26;
  const a = { x: p0.x + n0[0] * s, y: p0.y + n0[1] * s }, b = { x: p3.x + n3[0] * s, y: p3.y + n3[1] * s };
  const pts = [p0, a];
  const h0 = n0[0] !== 0, h3 = n3[0] !== 0;
  if (h0 && h3) { const mx = (a.x + b.x) / 2; pts.push({ x: mx, y: a.y }, { x: mx, y: b.y }); }
  else if (!h0 && !h3) { const my = (a.y + b.y) / 2; pts.push({ x: a.x, y: my }, { x: b.x, y: my }); }
  else if (h0) pts.push({ x: b.x, y: a.y });
  else pts.push({ x: a.x, y: b.y });
  pts.push(b, p3);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) > 0.5) out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a2 = out[i - 1], p = out[i], b2 = out[i + 1];
    if ((Math.abs(a2.x - p.x) < 0.5 && Math.abs(p.x - b2.x) < 0.5) || (Math.abs(a2.y - p.y) < 0.5 && Math.abs(p.y - b2.y) < 0.5)) out.splice(i, 1);
  }
  return out;
}

function lineGeom(l) {
  const ca = endRef(l.a), cb = endRef(l.b);
  const A = resolveEnd(l.a, cb), B = resolveEnd(l.b, ca);
  const route = l.route || 'curve';
  let na, nb;
  const [ux, uy] = _unit(B.x - A.x, B.y - A.y);
  if (route === 'straight') { na = [ux, uy]; nb = [-ux, -uy]; }
  else {
    na = A.free ? _axis(B.x - A.x, B.y - A.y) : (route === 'elbow' ? _axis(A.nx, A.ny) : [A.nx, A.ny]);
    nb = B.free ? _axis(A.x - B.x, A.y - B.y) : (route === 'elbow' ? _axis(B.nx, B.ny) : [B.nx, B.ny]);
  }
  const ia = capLen(l.capA, l.sw) * 0.8, ib = capLen(l.capB, l.sw) * 0.8;
  const p0 = { x: A.x + na[0] * ia, y: A.y + na[1] * ia }, p3 = { x: B.x + nb[0] * ib, y: B.y + nb[1] * ib };
  let d, mid, pts;
  if (route === 'straight') {
    d = `M${fmt(p0.x)} ${fmt(p0.y)}L${fmt(p3.x)} ${fmt(p3.y)}`;
    mid = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
    pts = [A, B];
  } else if (route === 'elbow') {
    const poly2 = elbowPoints(p0, na, p3, nb);
    d = roundPolyline(poly2, 12);
    const m = Math.floor((poly2.length - 1) / 2);
    mid = { x: (poly2[m].x + poly2[m + 1].x) / 2, y: (poly2[m].y + poly2[m + 1].y) / 2 };
    pts = [A, B, ...poly2];
  } else {
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const k = clamp(dist * 0.45, 24, 260);
    const c1 = { x: p0.x + na[0] * k, y: p0.y + na[1] * k }, c2 = { x: p3.x + nb[0] * k, y: p3.y + nb[1] * k };
    d = `M${fmt(p0.x)} ${fmt(p0.y)}C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
    mid = { x: 0.125 * p0.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p3.x, y: 0.125 * p0.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p3.y };
    pts = [A, B, c1, c2];
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  return { a: A, b: B, na, nb, d, mid, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

function capNode(cap, tip, n, sw, color) {
  if (!cap || cap === 'none') return null;
  const L = capLen(cap, sw) || 0, W = 3.4 + sw * 1.6;
  const [nx, ny] = n, px = -ny, py = nx;
  const bx = tip.x + nx * L, by = tip.y + ny * L;
  const f = (x, y) => `${fmt(x)} ${fmt(y)}`;
  if (cap === 'arrow') return sv('path', { d: `M${f(bx + px * W, by + py * W)}L${f(tip.x, tip.y)}L${f(bx - px * W, by - py * W)}`, fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (cap === 'tri') return sv('path', { d: `M${f(bx + px * W, by + py * W)}L${f(tip.x, tip.y)}L${f(bx - px * W, by - py * W)}Z`, fill: color });
  if (cap === 'circle') return sv('circle', { cx: tip.x + nx * W * 0.8, cy: tip.y + ny * W * 0.8, r: W * 0.8, fill: color });
  if (cap === 'diamond') return sv('path', { d: `M${f(tip.x, tip.y)}L${f(tip.x + nx * W + px * W, tip.y + ny * W + py * W)}L${f(tip.x + nx * 2 * W, tip.y + ny * 2 * W)}L${f(tip.x + nx * W - px * W, tip.y + ny * W - py * W)}Z`, fill: color });
  if (cap === 'bar') return sv('path', { d: `M${f(tip.x + px * W, tip.y + py * W)}L${f(tip.x - px * W, tip.y - py * W)}`, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' });
  return null;
}

/* Caja envolvente en coordenadas de mundo */
function elBox(e) {
  if (e.type === 'line') return lineGeom(e).box;
  if (e.type === 'comment') return { x: e.x, y: e.y, w: 1, h: 1 };
  const r = e.r || 0;
  if (!r) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const c = centerOf(e);
  const pts = [[-e.w / 2, -e.h / 2], [e.w / 2, -e.h / 2], [e.w / 2, e.h / 2], [-e.w / 2, e.h / 2]].map((p) => rotV(p, r));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: c.x + x0, y: c.y + y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}
function unionBox(list) {
  if (!list.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of list) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const boxesOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const boxInside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const ptInBox = (p, b, m = 0) => p.x >= b.x - m && p.y >= b.y - m && p.x <= b.x + b.w + m && p.y <= b.y + b.h + m;

/* ------------- Medición de texto ------------- */
const FONTS = [
  ['Geist', 'Geist, system-ui, -apple-system, sans-serif'],
  ['Cormorant', 'Cormorant, Georgia, serif'],
  ['Bebas Neue', '"Bebas Neue", Impact, sans-serif'],
  ['Geist Mono', '"Geist Mono", ui-monospace, Menlo, monospace'],
  ['Caveat', 'Caveat, "Segoe Script", cursive'],
];
const fontStack = (n) => (FONTS.find((f) => f[0] === n) || FONTS[0])[1];
const _mc = document.createElement('canvas').getContext('2d');
const fontStr = (el, size) => `${el.italic ? 'italic ' : ''}${el.weight || 400} ${size}px ${fontStack(el.font)}`;

function wrapText(text, font, maxW) {
  _mc.font = font;
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    if (!para) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      if (_mc.measureText(line + word).width <= maxW) { line += word; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      let w2 = word.trimStart();
      while (_mc.measureText(w2).width > maxW && w2.length > 1) {
        let i = w2.length - 1;
        while (i > 1 && _mc.measureText(w2.slice(0, i)).width > maxW) i--;
        lines.push(w2.slice(0, i));
        w2 = w2.slice(i);
      }
      line = w2;
    }
    lines.push(line);
  }
  return lines;
}
function fitSize(el, w, H, max = 40, min = 9) {
  if (!el.text) return Math.min(max, 20);
  let lo = min, hi = max;
  while (hi - lo > 0.5) {
    const m = (lo + hi) / 2, f = fontStr(el, m), lines = wrapText(el.text, f, w);
    _mc.font = f;
    const ok = lines.length * m * 1.3 <= H && lines.every((l) => _mc.measureText(l).width <= w + 0.5);
    if (ok) lo = m; else hi = m;
  }
  return Math.floor(lo * 2) / 2;
}
function textMetrics(el, maxW) {
  const size = el.size || 16, f = fontStr(el, size), lines = wrapText(el.text || ' ', f, maxW);
  _mc.font = f;
  return { w: Math.max(...lines.map((l) => _mc.measureText(l).width), 1), h: lines.length * size * 1.3, lines };
}
