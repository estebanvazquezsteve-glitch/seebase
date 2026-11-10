'use strict';
/* Cámara, dibujo de elementos y capa de selección */
const stage = $('#stage'), world = $('#world'), wFrames = $('#w-frames'), wEls = $('#w-els');
const ov = $('#ov'), gridEl = $('#grid'), cursorsEl = $('#cursors');
const NODES = new Map(), Dirty = new Set();
let orderDirty = false, overlayDirty = false, minimapDirty = false, rafOn = false, animateNew = false;
const MINZ = 0.04, MAXZ = 6;

function schedule() { if (rafOn) return; rafOn = true; requestAnimationFrame(flush); }
function invalidate(id) { Dirty.add(id); schedule(); }
function touchOverlay() { overlayDirty = true; schedule(); }

function flush() {
  rafOn = false;
  if (Dirty.size) {
    const ids = new Set(Dirty);
    Dirty.clear();
    const dep = new Set();
    for (const e of S.els.values()) {
      if (e.type === 'line' && ((e.a.id && ids.has(e.a.id)) || (e.b.id && ids.has(e.b.id)))) dep.add(e.id);
      else if (e.type === 'mind' && e.parent && ids.has(e.parent)) dep.add(e.id);
    }
    for (const id of dep) ids.add(id);
    for (const id of ids) {
      const e = S.els.get(id);
      if (e) drawEl(e);
      else { NODES.get(id)?.remove(); NODES.delete(id); }
    }
    if (ids.has('_meta')) applyMeta();
    overlayDirty = true; minimapDirty = true;
  }
  if (orderDirty && !S.editing) { resort(); orderDirty = false; }
  if (overlayDirty) renderOverlay();
  if (minimapDirty) drawMinimap();
}

function resort() {
  const items = [...S.els.values()].filter((e) => NODES.has(e.id)).sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const e of items) (e.type === 'frame' ? wFrames : wEls).append(NODES.get(e.id));
}

function clearWorld() {
  wFrames.replaceChildren(); wEls.replaceChildren(); NODES.clear(); Dirty.clear();
}
function drawAll() {
  for (const e of S.els.values()) drawEl(e);
  resort();
  applyMeta();
  touchOverlay();
  minimapDirty = true;
}

function applyMeta() {
  const m = getMeta();
  if (!m) return;
  Scene.set(m.scene);
  applyGrid();
  renderTimer();
  if (!S.sel.size) renderInspectorSoon();
}

/* ---------- Cámara ---------- */
function applyCam() {
  const { x, y, z } = S.cam;
  world.style.transform = `translate(${x}px,${y}px) scale(${z})`;
  world.style.setProperty('--z', z);
  applyGrid();
  Scene.cam(x, y);
  const l = $('#zoomLabel');
  if (l) l.textContent = Math.round(z * 100) + '%';
  touchOverlay();
  minimapDirty = true;
  saveCamSoon();
  Presence.sendView();
  renderCursors();
}
const saveCamSoon = debounce(() => { if (S.boardId) LS.set('cam.' + S.boardId, S.cam); }, 400);

function applyGrid() {
  const m = getMeta(), mode = m?.grid?.mode || 'dots';
  const { x, y, z } = S.cam;
  gridEl.style.display = mode === 'none' ? 'none' : '';
  if (mode === 'none') return;
  let step = 24;
  while (step * z < 16) step *= 4;
  const s = step * z;
  gridEl.className = mode;
  gridEl.style.backgroundSize = `${s}px ${s}px`;
  gridEl.style.backgroundPosition = `${x}px ${y}px`;
}

const screenToWorld = (sx, sy) => ({ x: (sx - S.cam.x) / S.cam.z, y: (sy - S.cam.y) / S.cam.z });

function viewArea() {
  const narrow = innerWidth < 760;
  const l = narrow ? 8 : 76 + ($('#side')?.hidden === false ? 276 : 0);
  const r = narrow ? 8 : ($('#insp')?.classList.contains('closed') ? 16 : 316);
  return { x: l, y: 68, w: Math.max(120, innerWidth - l - r), h: Math.max(120, innerHeight - 68 - (narrow ? 84 : 20)) };
}

function zoomAt(sx, sy, factor) {
  const z = clamp(S.cam.z * factor, MINZ, MAXZ), k = z / S.cam.z;
  S.cam.x = sx - (sx - S.cam.x) * k;
  S.cam.y = sy - (sy - S.cam.y) * k;
  S.cam.z = z;
  stopCamAnim();
  applyCam();
}
let _camAnim = 0;
const stopCamAnim = () => cancelAnimationFrame(_camAnim);

function animateCam(to, dur = 520) {
  stopCamAnim();
  if (prefersReduced() || dur <= 0) { S.cam = { ...to }; applyCam(); return; }
  const a = viewCenterOf(S.cam), b = viewCenterOf(to);
  const z0 = Math.log(S.cam.z), z1 = Math.log(to.z), t0 = performance.now();
  const W = innerWidth / 2, H = innerHeight / 2;
  const step = (now) => {
    const t = clamp((now - t0) / dur, 0, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const z = Math.exp(lerp(z0, z1, e)), cx = lerp(a.x, b.x, e), cy = lerp(a.y, b.y, e);
    S.cam = { x: W - cx * z, y: H - cy * z, z };
    applyCam();
    if (t < 1) _camAnim = requestAnimationFrame(step);
    else { S.cam = { ...to }; applyCam(); }
  };
  _camAnim = requestAnimationFrame(step);
}
const viewCenterOf = (c) => ({ x: (innerWidth / 2 - c.x) / c.z, y: (innerHeight / 2 - c.y) / c.z });

function camForBox(box, { pad = 70, maxZ = 1.6, area = viewArea() } = {}) {
  const z = clamp(Math.min((area.w - pad * 2) / Math.max(box.w, 1), (area.h - pad * 2) / Math.max(box.h, 1)), MINZ, maxZ);
  return { x: area.x + area.w / 2 - (box.x + box.w / 2) * z, y: area.y + area.h / 2 - (box.y + box.h / 2) * z, z };
}
function flyTo(box, opt = {}) { animateCam(camForBox(box, opt), opt.dur ?? 560); }
function fitAll(dur = 560) {
  const list = allEls().filter((e) => !e.hidden).map(elBox);
  if (!list.length) { animateCam({ x: innerWidth / 2, y: innerHeight / 2, z: 1 }, dur); return; }
  flyTo(unionBox(list), { dur, maxZ: 1.2 });
}

/* ---------- Dibujo de elementos ---------- */
function nodeFor(el) {
  let n = NODES.get(el.id);
  if (!n) {
    n = h('div', { 'data-id': el.id });
    NODES.set(el.id, n);
    (el.type === 'frame' ? wFrames : wEls).append(n);
    orderDirty = true;
    if (animateNew && !prefersReduced()) n.animate([{ opacity: 0 }, { opacity: el.opa ?? 1 }], { duration: 240, easing: 'ease-out' });
  }
  return n;
}

function placeEl(el, n = NODES.get(el.id)) {
  if (!n) return;
  n.style.transform = `translate(${el.x}px,${el.y}px) rotate(${el.r || 0}deg)`;
  n.style.width = el.w + 'px';
  n.style.height = el.h + 'px';
}

const strokeDash = (d, sw) => (d === 'dash' ? `${sw * 4} ${sw * 3}` : d === 'dot' ? `0.01 ${sw * 2.4}` : null);

function shapeLayer(el, d, extra) {
  const { w, h: H, id } = el, defs = sv('defs');
  const f = paintSVG(el.fill, w, H, defs, 'f' + id);
  const root = sv('svg', { class: 'sv', width: w, height: H, viewBox: `0 0 ${w} ${H}` }, defs,
    sv('path', { d, fill: f === 'none' ? 'transparent' : f, 'pointer-events': 'all' }));
  if (el.fill && el.fill.t !== 'none' && el.fill.g > 0) root.append(sv('path', { d, fill: 'url(#grainP)', opacity: Math.min(1, el.fill.g), 'pointer-events': 'none' }));
  if (el.sw > 0 && el.stroke && el.stroke.t !== 'none') {
    const st = paintSVG(el.stroke, w, H, defs, 's' + id);
    const a = { fill: 'none', stroke: st, 'stroke-width': el.sw, 'stroke-dasharray': strokeDash(el.dash, el.sw), 'stroke-linecap': el.dash === 'dot' ? 'round' : null, 'stroke-linejoin': 'round', 'pointer-events': 'none' };
    root.append(sv('path', { d, ...a }));
    if (extra) root.append(sv('path', { d: extra, ...a }));
  }
  return root;
}

function styleText(t, el, size) {
  t.style.fontFamily = fontStack(el.font);
  t.style.fontSize = size + 'px';
  t.style.fontWeight = el.weight || 400;
  t.style.fontStyle = el.italic ? 'italic' : '';
  t.style.textDecoration = el.underline ? 'underline' : '';
  t.style.textAlign = el.align || 'left';
  t.style.letterSpacing = el.track ? el.track + 'em' : '';
  const p = el.color || solid('#ece8e1');
  if (p.t === 'solid') { t.style.color = paintCSS(p); t.style.backgroundImage = ''; t.classList.remove('gt'); }
  else { t.style.backgroundImage = paintCSS(p); t.style.color = 'transparent'; t.classList.add('gt'); }
}

const VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
function textBox(el, ins = [0, 0, 0, 0], pad = 10) {
  const size = el.autofit ? fitSize(el, el.w - pad * 2, el.h - pad * 2, 30) : el.size;
  const tw = h('div', { class: 'tw' });
  tw.style.top = el.h * ins[0] + pad + 'px';
  tw.style.right = el.w * ins[1] + pad + 'px';
  tw.style.bottom = el.h * ins[2] + pad + 'px';
  tw.style.left = el.w * ins[3] + pad + 'px';
  tw.style.justifyContent = VALIGN[el.valign] || 'center';
  const t = h('div', { class: 't' });
  styleText(t, el, size);
  t.textContent = el.text || '';
  tw.append(t);
  return tw;
}

function imageLayout(el) {
  const nw = el.nw || el.w, nh = el.nh || el.h;
  if (el.fit === 'stretch') return { left: 0, top: 0, dw: el.w, dh: el.h };
  const s = Math.max(el.w / nw, el.h / nh) * (el.zoom || 1);
  const dw = nw * s, dh = nh * s;
  return {
    left: clamp(el.w / 2 - (el.fcx ?? 0.5) * dw, el.w - dw, 0),
    top: clamp(el.h / 2 - (el.fcy ?? 0.5) * dh, el.h - dh, 0),
    dw, dh,
  };
}
function imgFilter(fx = {}) {
  const a = [];
  if (fx.b != null && fx.b !== 100) a.push(`brightness(${fx.b}%)`);
  if (fx.c != null && fx.c !== 100) a.push(`contrast(${fx.c}%)`);
  if (fx.s != null && fx.s !== 100) a.push(`saturate(${fx.s}%)`);
  if (fx.g) a.push(`grayscale(${fx.g}%)`);
  if (fx.bl) a.push(`blur(${fx.bl}px)`);
  return a.join(' ');
}

function drawImageEl(el, n) {
  const d = SHAPES[el.mask || 'rect'].d(el.w, el.h, el.rad || 0);
  const L = imageLayout(el);
  const wrap = h('div', { class: 'imgwrap' });
  wrap.style.clipPath = `path('${d}')`;
  wrap.style.webkitClipPath = `path('${d}')`;
  const url = Assets.url(el);
  if (!url) wrap.classList.add('loading');
  const place = (img) => {
    img.style.left = L.left + 'px'; img.style.top = L.top + 'px';
    img.style.width = L.dw + 'px'; img.style.height = L.dh + 'px';
    const fl = `${el.flipH ? 'scaleX(-1) ' : ''}${el.flipV ? 'scaleY(-1)' : ''}`.trim();
    img.style.transform = fl;
  };
  const img = h('img', { draggable: 'false', alt: el.alt || '' });
  if (url) img.src = url;
  place(img);
  img.style.filter = imgFilter(el.fx);
  wrap.append(img);
  const fx = el.fx || {};
  if (fx.w) wrap.append(h('div', { class: 'imo', style: { background: fx.w > 0 ? '#d69a55' : '#4f7d9a', opacity: Math.abs(fx.w) / 100, mixBlendMode: 'soft-light' } }));
  if (el.ov && el.ov.p) wrap.append(h('div', { class: 'imo', style: { background: paintCSS(el.ov.p), opacity: el.ov.o ?? 1, mixBlendMode: el.ov.m || 'normal' } }));
  if (fx.v) wrap.append(h('div', { class: 'imo', style: { background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${fx.v / 100}) 100%)` } }));
  const kids = [wrap];
  if (S.crop?.id === el.id) {
    const ghost = h('img', { class: 'ghost', draggable: 'false', alt: '' });
    if (url) ghost.src = url;
    place(ghost);
    kids.unshift(ghost);
  }
  if (el.sw > 0) {
    const ring = shapeLayer({ ...el, fill: NONE }, d);
    ring.style.pointerEvents = 'none';
    ring.querySelectorAll('path').forEach((p) => p.setAttribute('pointer-events', 'none'));
    kids.push(ring);
  }
  n.replaceChildren(...kids);
}

function drawLineEl(el, n) {
  const g = lineGeom(el), pad = el.sw * 4 + 16;
  const ox = g.box.x - pad, oy = g.box.y - pad, W = g.box.w + pad * 2, H = g.box.h + pad * 2;
  n.style.transform = `translate(${ox}px,${oy}px)`;
  n.style.width = W + 'px';
  n.style.height = H + 'px';
  const defs = sv('defs');
  const stroke = paintAlong(el.stroke, g.a, g.b, defs, 's' + el.id);
  const body = sv('g', { transform: `translate(${-ox} ${-oy})` },
    sv('path', { class: 'ln-hit', d: g.d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(16, el.sw + 12) }),
    sv('path', { class: 'ln-glow', d: g.d, fill: 'none', stroke, 'stroke-width': el.sw + 5, opacity: 0.1, 'stroke-linecap': 'round', 'pointer-events': 'none' }),
    sv('path', { d: g.d, fill: 'none', stroke, 'stroke-width': el.sw, 'stroke-dasharray': strokeDash(el.dash, el.sw), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' }),
    el.flow && sv('path', { class: 'ln-flow', d: g.d, fill: 'none', stroke: 'rgba(255,255,255,.75)', 'stroke-width': Math.max(1.2, el.sw * 0.7), 'stroke-dasharray': '2 26', 'stroke-linecap': 'round', 'pointer-events': 'none' }),
    capNode(el.capA, g.a, g.na, el.sw, firstColor(el.stroke)),
    capNode(el.capB, g.b, g.nb, el.sw, lastColor(el.stroke)));
  const kids = [sv('svg', { class: 'sv', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, defs, body)];
  if (el.label || S.editing === el.id) {
    const lab = h('div', { class: 'ln-label' }, h('div', { class: 't' }, el.label || ''));
    lab.style.left = g.mid.x - ox + 'px';
    lab.style.top = g.mid.y - oy + 'px';
    kids.push(lab);
  }
  n.replaceChildren(...kids);
}

function strokePath(pts, sx, sy) {
  if (pts.length < 4) { const x = pts[0] * sx, y = pts[1] * sy; return `M${fmt(x)} ${fmt(y)}L${fmt(x + 0.1)} ${fmt(y + 0.1)}`; }
  let d = `M${fmt(pts[0] * sx)} ${fmt(pts[1] * sy)}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = ((pts[i] + pts[i + 2]) / 2) * sx, my = ((pts[i + 1] + pts[i + 3]) / 2) * sy;
    d += `Q${fmt(pts[i] * sx)} ${fmt(pts[i + 1] * sy)} ${fmt(mx)} ${fmt(my)}`;
  }
  const l = pts.length;
  return d + `L${fmt(pts[l - 2] * sx)} ${fmt(pts[l - 1] * sy)}`;
}
function drawStrokeEl(el, n) {
  const d = strokePath(el.pts, el.w / (el.ow || 1), el.h / (el.oh || 1));
  const defs = sv('defs');
  const st = paintSVG(el.stroke, el.w, el.h, defs, 's' + el.id);
  n.replaceChildren(sv('svg', { class: 'sv', width: el.w || 1, height: el.h || 1, style: 'overflow:visible' }, defs,
    sv('path', { class: 'ln-hit', d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(14, el.sw + 8), 'stroke-linecap': 'round' }),
    sv('path', { d, fill: 'none', stroke: st, 'stroke-width': el.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' })));
}

function drawMindEl(el, n) {
  const isRoot = !el.parent;
  const p = isRoot ? null : S.els.get(el.parent);
  const kids = [];
  if (p) {
    const dir = el.side === 'l' ? -1 : 1;
    const sx = (dir > 0 ? p.x + p.w : p.x) - el.x, sy = p.y + p.h / 2 - el.y;
    const ex = dir > 0 ? 0 : el.w, ey = el.h / 2;
    const k = Math.abs(ex - sx) * 0.55;
    const d = `M${fmt(sx)} ${fmt(sy)}C${fmt(sx + dir * k)} ${fmt(sy)} ${fmt(ex - dir * k)} ${fmt(ey)} ${fmt(ex)} ${fmt(ey)}`;
    const defs = sv('defs');
    defs.append(sv('linearGradient', { id: 'b' + el.id, gradientUnits: 'userSpaceOnUse', x1: sx, y1: sy, x2: ex + 0.01, y2: ey + 0.01 },
      sv('stop', { offset: 0, 'stop-color': p.branch || el.branch, 'stop-opacity': 0.55 }),
      sv('stop', { offset: 1, 'stop-color': el.branch })));
    kids.push(sv('svg', { class: 'mm-branch', width: 1, height: 1 }, defs,
      sv('path', { d, fill: 'none', stroke: `url(#b${el.id})`, 'stroke-width': p.parent ? 1.4 : 2, 'stroke-linecap': 'round' })));
  }
  const body = { ...el };
  if (!isRoot && (!el.fill || el.fill.t === 'none')) body.stroke = solid(el.branch, 0.5);
  kids.push(shapeLayer(body, rr(el.w, el.h, isRoot ? Math.min(el.rad + 8, el.h / 2) : el.rad)));
  const t = h('div', { class: 'tw', style: { inset: '0', padding: isRoot ? '16px 26px' : '9px 14px', justifyContent: 'center' } });
  const tx = h('div', { class: 't' });
  styleText(tx, el, el.size);
  tx.style.textAlign = 'left';
  tx.textContent = el.text || '';
  t.append(tx);
  kids.push(t);
  const count = mindKidsCount(el.id);
  if (count) {
    const dir = el.side === 'l' && !isRoot ? -1 : 1;
    kids.push(h('button', { class: 'mm-fold', type: 'button', 'data-fold': el.id, title: el.collapsed ? 'Expandir rama' : 'Contraer rama', style: { [dir > 0 ? 'right' : 'left']: '-11px' } }, el.collapsed ? String(count) : '−'));
  }
  n.replaceChildren(...kids);
}
function mindKidsCount(id) { let c = 0; for (const e of S.els.values()) if (e.type === 'mind' && e.parent === id) c++; return c; }

function drawTableEl(el, n) {
  const rows = el.cells.length, cols = el.cells[0]?.length || 1;
  const g = h('div', { class: 'tbl', style: { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${rows},minmax(0,1fr))`, background: paintCSS(el.fill), '--tb': paintCSS(el.stroke), fontFamily: fontStack(el.font), fontSize: el.size + 'px', color: paintCSS(el.color) } });
  el.cells.forEach((row, r) => row.forEach((c, ci) => g.append(h('div', { class: 'td' + (el.header && r === 0 ? ' th' : ''), 'data-r': r, 'data-c': ci }, c))));
  n.replaceChildren(g);
}
function drawCheckEl(el, n) {
  const list = h('div', { class: 'chk-list' }, el.items.map((it, i) => h('div', { class: 'chk' + (it.d ? ' done' : ''), 'data-chk': i }, h('span', { class: 'box', 'data-chk': i }, it.d ? '✓' : ''), h('span', { class: 'lbl' }, it.t))));
  const done = el.items.filter((i) => i.d).length;
  n.replaceChildren(shapeLayer(el, rr(el.w, el.h, el.rad)),
    h('div', { class: 'chk-body', style: { fontFamily: fontStack(el.font), fontSize: el.size + 'px', color: paintCSS(el.color) } },
      h('div', { class: 'chk-head' }, h('b', {}, el.title), h('span', { class: 'mono' }, `${done}/${el.items.length}`)), list));
}
function drawLinkEl(el, n) {
  let host = '';
  try { host = new URL(el.url).hostname.replace(/^www\./, ''); } catch {}
  n.replaceChildren(shapeLayer(el, rr(el.w, el.h, el.rad)),
    h('div', { class: 'lnk' }, h('div', { class: 'lnk-ic' }, icon('link', 18)), h('div', { class: 'lnk-tx' }, h('b', {}, el.title || host || 'Enlace'), h('span', {}, host || 'Sin dirección')),
      /^https?:/.test(el.url) && h('a', { class: 'lnk-go', href: el.url, target: '_blank', rel: 'noopener noreferrer', title: 'Abrir enlace', 'data-nodrag': 1 }, icon('external', 16))));
}

function drawEl(el) {
  if (el.type[0] === '_' || el.type === 'comment') return;
  const n = nodeFor(el);
  if (S.editing === el.id) { placeEl(el, n); return; }
  n.className = 'el ' + el.type + (S.sel.has(el.id) ? ' selected' : '');
  n.style.display = el.hidden ? 'none' : '';
  n.style.opacity = el.opa ?? 1;
  const fxs = [];
  if (el.shadow) fxs.push(`drop-shadow(0 ${el.shadow.y}px ${el.shadow.b}px ${rgba(el.shadow.c, el.shadow.a)})`);
  if (el.glow) fxs.push(`drop-shadow(0 0 ${el.glow.b}px ${rgba(el.glow.c, el.glow.a)})`);
  n.style.filter = fxs.join(' ');
  if (n._z !== el.z) { n._z = el.z; orderDirty = true; }
  switch (el.type) {
    case 'line': drawLineEl(el, n); return;
    case 'shape': {
      const sh = SHAPES[el.kind] || SHAPES.rect;
      n.replaceChildren(shapeLayer(el, sh.d(el.w, el.h, el.rad), sh.extra?.(el.w, el.h)), textBox(el, sh.inset));
      break;
    }
    case 'sticky': n.replaceChildren(shapeLayer(el, rr(el.w, el.h, el.rad)), textBox(el, undefined, 16)); break;
    case 'text': {
      const tw = textBox(el, undefined, 0);
      n.replaceChildren(...(el.fill && el.fill.t !== 'none' ? [shapeLayer({ ...el, sw: 0 }, rr(el.w, el.h, 6))] : []), tw);
      break;
    }
    case 'image': drawImageEl(el, n); break;
    case 'frame': n.replaceChildren(shapeLayer(el, rr(el.w, el.h, el.rad)), h('div', { class: 'fr-title', 'data-frame-title': 1 }, el.name || 'Marco')); break;
    case 'draw': drawStrokeEl(el, n); break;
    case 'mind': drawMindEl(el, n); break;
    case 'table': drawTableEl(el, n); break;
    case 'check': drawCheckEl(el, n); break;
    case 'link': drawLinkEl(el, n); break;
  }
  if (el.votes) {
    const total = Object.values(el.votes).reduce((a, b) => a + b, 0);
    if (total) n.append(h('div', { class: 'votes mono', title: `${total} votos` }, icon('vote', 12), String(total)));
  }
  placeEl(el, n);
}

/* ---------- Capa de selección ---------- */
const CONNECTABLE = new Set(['shape', 'sticky', 'image', 'table', 'check', 'link', 'text']);

function outlineDiv(b, color) {
  const z = S.cam.z;
  return h('div', { class: 'peer-sel', style: { left: b.x * z + S.cam.x + 'px', top: b.y * z + S.cam.y + 'px', width: b.w * z + 'px', height: b.h * z + 'px', borderColor: color } });
}

function renderOverlay() {
  overlayDirty = false;
  const { z, x: cx, y: cy } = S.cam;
  const sx = (v) => v * z + cx, sy = (v) => v * z + cy;
  const out = [];

  for (const p of S.peers.values()) {
    if (!p.sel?.length) continue;
    for (const id of p.sel.slice(0, 40)) { const e = S.els.get(id); if (e && e.type !== 'comment') out.push(outlineDiv(elBox(e), p.color)); }
  }

  const sel = selEls().filter((e) => e.type !== 'comment');
  const idle = !Drag && !S.editing && S.tool === 'select';

  if (S.hover && !S.sel.has(S.hover) && !Drag && S.tool === 'select') {
    const e = S.els.get(S.hover);
    if (e && e.type !== 'comment' && !e.hidden) {
      if (e.type !== 'line' && e.type !== 'draw') out.push(rotBox(e, 'hover-box'));
      if (CONNECTABLE.has(e.type) && !e.locked) out.push(...quickDots(e));
    }
  }

  if (sel.length === 1) {
    const e = sel[0];
    if (e.type === 'line') {
      const g = lineGeom(e);
      if (!e.locked) {
        out.push(h('div', { class: 'hd end', 'data-end': 'a', style: { left: sx(g.a.x) + 'px', top: sy(g.a.y) + 'px' } }));
        out.push(h('div', { class: 'hd end', 'data-end': 'b', style: { left: sx(g.b.x) + 'px', top: sy(g.b.y) + 'px' } }));
      }
    } else if (S.editing !== e.id || e.type !== 'text') {
      const box = rotBox(e, 'sbox' + (e.locked ? ' locked' : '') + (S.crop ? ' crop' : ''));
      if (!e.locked && S.editing !== e.id) addHandles(box, e);
      out.push(box);
      if (e.type === 'mind' && idle) out.push(...mindPlus(e));
      if (idle && CONNECTABLE.has(e.type) && !e.locked) out.push(...quickDots(e));
    }
  } else if (sel.length > 1) {
    if (sel.length <= 40) for (const e of sel) if (e.type !== 'line') out.push(rotBox(e, 'sub-box'));
    const b = unionBox(sel.map(elBox));
    const box = h('div', { class: 'sbox multi', style: { left: 0, top: 0, width: b.w * z + 'px', height: b.h * z + 'px', transform: `translate(${sx(b.x)}px,${sy(b.y)}px)` } });
    addHandles(box, { type: 'multi' });
    out.push(box);
  }

  for (const g of S.guides) out.push(h('div', { class: 'guide', style: g.v ? { left: sx(g.p) + 'px', top: sy(g.a) + 'px', height: (g.b - g.a) * z + 'px', width: '1px' } : { left: sx(g.a) + 'px', top: sy(g.p) + 'px', width: (g.b - g.a) * z + 'px', height: '1px' } }));
  if (S.marquee) { const m = S.marquee; out.push(h('div', { class: 'marquee', style: { left: sx(m.x) + 'px', top: sy(m.y) + 'px', width: m.w * z + 'px', height: m.h * z + 'px' } })); }
  if (S.preview) { const m = S.preview; out.push(h('div', { class: 'preview', style: { left: sx(m.x) + 'px', top: sy(m.y) + 'px', width: m.w * z + 'px', height: m.h * z + 'px' } })); }
  if (S.anchorHint) {
    const e = S.els.get(S.anchorHint.id);
    if (e && e.type !== 'line') {
      out.push(rotBox(e, 'hover-box strong'));
      for (const s of ['t', 'r', 'b', 'l']) { const a = anchor(e, s); out.push(h('div', { class: 'anch' + (S.anchorHint.side === s ? ' on' : ''), style: { left: sx(a.x) + 'px', top: sy(a.y) + 'px' } })); }
    }
  }
  renderPins(out, sx, sy);
  ov.replaceChildren(...out);
  placeQBar(sel);
}

function rotBox(e, cls) {
  const { z, x: cx, y: cy } = S.cam;
  const W = e.w * z, H = e.h * z;
  const px = (e.x + e.w / 2) * z + cx - W / 2, py = (e.y + e.h / 2) * z + cy - H / 2;
  return h('div', { class: cls, style: { left: 0, top: 0, width: W + 'px', height: H + 'px', transform: `translate(${px}px,${py}px) rotate(${e.r || 0}deg)` } });
}

function addHandles(box, e) {
  if (e.type === 'mind') return;
  const add = (hd, cls) => box.append(h('div', { class: 'hd ' + cls + ' ' + hd, 'data-h': hd }));
  ['n', 's', 'e', 'w'].forEach((d) => add(d, 'edge'));
  ['nw', 'ne', 'se', 'sw'].forEach((d) => add(d, 'corner'));
  if (!S.crop) add('rot', 'rotate');
}

function quickDots(e) {
  const { z, x: cx, y: cy } = S.cam;
  return ['t', 'r', 'b', 'l'].map((s) => {
    const a = anchor(e, s);
    return h('div', { class: 'qc', 'data-qc': s, 'data-qcid': e.id, title: 'Arrastra para conectar', style: { left: a.x * z + cx + a.nx * 20 + 'px', top: a.y * z + cy + a.ny * 20 + 'px' } });
  });
}
function mindPlus(e) {
  const { z, x: cx, y: cy } = S.cam;
  const out = [];
  const mk = (side, x, title) => h('button', { class: 'mm-add', type: 'button', 'data-mm': side, title, style: { left: x * z + cx + (side === 'r' ? 24 : -24) + 'px', top: (e.y + e.h / 2) * z + cy + 'px' } }, icon('plus', 13));
  if (!e.parent || e.side !== 'l') out.push(mk('r', e.x + e.w, 'Añadir idea (Tab)'));
  if (!e.parent || e.side === 'l') out.push(mk('l', e.x, 'Añadir idea'));
  return out;
}

function placeQBar(sel) {
  const q = $('#qbar');
  if (!q) return;
  if (!sel.length || Drag || S.editing || S.crop || S.tool !== 'select') { q.hidden = true; return; }
  const b = unionBox(sel.map(elBox)), { z, x: cx, y: cy } = S.cam;
  q.hidden = false;
  renderQBar(sel);
  const qw = q.offsetWidth, qh = q.offsetHeight;
  const a = viewArea();
  const px = clamp((b.x + b.w / 2) * z + cx - qw / 2, 12, innerWidth - qw - 12);
  let py = b.y * z + cy - qh - 44;
  if (py < a.y - 4) py = (b.y + b.h) * z + cy + 34;
  q.style.transform = `translate(${px}px,${clamp(py, 60, innerHeight - qh - 12)}px)`;
}

/* ---------- Personas conectadas ---------- */
function renderCursors() {
  const { z, x: cx, y: cy } = S.cam;
  const seen = new Set();
  for (const [sid, p] of S.peers) {
    if (p.x == null) continue;
    seen.add(sid);
    let n = p.node;
    if (!n || !n.isConnected) {
      n = p.node = h('div', { class: 'cursor', style: { '--c': p.color } },
        sv('svg', { width: 16, height: 16, viewBox: '0 0 16 16' }, sv('path', { d: 'M1.5 1.5l12 5.3-5 1.5-1.8 5.2z', fill: p.color, stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.8 })),
        h('span', {}, p.name));
      cursorsEl.append(n);
    }
    n.style.transform = `translate(${p.x * z + cx}px,${p.y * z + cy}px)`;
  }
  for (const c of [...cursorsEl.children]) {
    if (![...S.peers.values()].some((p) => p.node === c)) c.remove();
  }
}

function followTo(m) {
  const z = clamp(m.z, MINZ, MAXZ), a = viewArea();
  animateCam({ x: a.x + a.w / 2 - m.cx * z, y: a.y + a.h / 2 - m.cy * z, z }, 200);
}
function startFollow(sid) {
  const p = S.peers.get(sid);
  if (!p) return;
  S.follow = sid;
  if (p.view) followTo(p.view);
  renderPeers();
  toast(`Siguiendo la vista de ${p.name}. Mueve el lienzo para salir.`);
}
function stopFollow() { if (S.follow) { S.follow = null; renderPeers(); } }

/* ---------- Minimapa ---------- */
function drawMinimap() {
  minimapDirty = false;
  const c = $('#minimap');
  if (!c || c.closest('[hidden]')) return;
  const W = 200, H = 128, dpr = Math.min(2, devicePixelRatio || 1);
  if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const list = allEls().filter((e) => !e.hidden && e.type !== 'comment');
  const { z, x: cx, y: cy } = S.cam;
  const v = { x: -cx / z, y: -cy / z, w: innerWidth / z, h: innerHeight / z };
  const b = unionBox([...list.map(elBox), v]);
  const pad = 10, k = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
  const ox = pad + (W - pad * 2 - b.w * k) / 2 - b.x * k, oy = pad + (H - pad * 2 - b.h * k) / 2 - b.y * k;
  c._map = { k, ox, oy };
  for (const e of list) {
    const r = elBox(e);
    if (e.type === 'frame') { x.fillStyle = 'rgba(255,255,255,.05)'; x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 0.6; x.fillRect(r.x * k + ox, r.y * k + oy, r.w * k, r.h * k); x.strokeRect(r.x * k + ox, r.y * k + oy, r.w * k, r.h * k); continue; }
    if (e.type === 'line') continue;
    x.fillStyle = S.sel.has(e.id) ? '#d9bd94' : 'rgba(255,255,255,.28)';
    x.fillRect(r.x * k + ox, r.y * k + oy, Math.max(1.2, r.w * k), Math.max(1.2, r.h * k));
  }
  x.strokeStyle = 'rgba(217,189,148,.85)'; x.lineWidth = 1;
  x.strokeRect(v.x * k + ox, v.y * k + oy, v.w * k, v.h * k);
}
