'use strict';
/* Acciones de edición, fotos, portapapeles y exportación */
function serializeIds(ids) {
  const out = [];
  for (const id of ids) {
    const e = S.els.get(id);
    if (!e || e.type[0] === '_') continue;
    const c = clone(e);
    if (e.type === 'line') { const g = lineGeom(e); c._g = [g.a.x, g.a.y, g.b.x, g.b.y]; }
    out.push(c);
  }
  return out;
}

function pasteData(list, { offset = 28, at = null, select = true } = {}) {
  if (!list?.length) return null;
  const map = new Map(list.map((e) => [e.id, uid()]));
  const groups = new Map();
  let dx = offset, dy = offset;
  if (at) {
    const b = unionBox(list.filter((e) => e.type !== 'line').map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })));
    if (b) { dx = at.x - (b.x + b.w / 2); dy = at.y - (b.y + b.h / 2); }
  }
  let z = maxZ();
  const made = list.slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((e) => {
    const c = clone(e);
    c.id = map.get(e.id);
    delete c.v; delete c.by; delete c.votes;
    c.z = e.type === 'frame' ? e.z : ++z;
    if (c.group) { if (!groups.has(c.group)) groups.set(c.group, uid()); c.group = groups.get(c.group); }
    if (c.type === 'line') {
      const fix = (end, x, y) => {
        if (end.id && map.has(end.id)) return { ...end, id: map.get(end.id) };
        return { x: (end.id ? x : end.x) + dx, y: (end.id ? y : end.y) + dy };
      };
      c.a = fix(c.a, c._g[0], c._g[1]);
      c.b = fix(c.b, c._g[2], c._g[3]);
      delete c._g;
    } else { c.x += dx; c.y += dy; }
    if (c.type === 'mind') c.parent = c.parent && map.has(c.parent) ? map.get(c.parent) : null;
    return c;
  });
  addEls(made, { select });
  if (Api === Cloud) {
    for (const el of made) {
      if (el.type === 'image' && el.ab && el.ab !== S.boardId) {
        fetch(`/api/boards/${el.ab}/assets/${el.asset}`).then((r) => r.blob()).then((b) => Api.putAsset(S.boardId, b)).then((id) => {
          mutate([el.id], (e) => { e.asset = id; e.ab = S.boardId; }, { history: false });
        }).catch(() => {});
      }
    }
  }
  return made;
}
function duplicateSel() { if (S.sel.size) pasteData(serializeIds([...movingSetAll()]), { offset: 32 }); }

function onPaste(e) {
  _pasteSeen = true;
  if (isTyping() || !S.boardId || $('#editor').hidden || document.querySelector('.modal-wrap')) return;
  const cd = e.clipboardData;
  const files = [...(cd?.files || [])].filter((f) => f.type.startsWith('image/'));
  const a = viewArea();
  const center = screenToWorld(a.x + a.w / 2, a.y + a.h / 2);
  if (files.length) { e.preventDefault(); insertImages(files, center); return; }
  const tx = cd?.getData('text/plain') || '';
  if (!tx) return;
  e.preventDefault();
  if (tx.startsWith('seebase:')) {
    try { pasteData(JSON.parse(tx.slice(9)), { at: center }); } catch { toast('No se pudo pegar ese contenido'); }
    return;
  }
  if (/^https?:\/\/\S+$/i.test(tx.trim())) { addLink(tx.trim(), center); return; }
  const lines = tx.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.length <= 40) {
    const cols = Math.ceil(Math.sqrt(lines.length));
    const made = lines.map((text, i) => newEl('sticky', { text, x: center.x + (i % cols) * 210 - (cols * 210) / 2, y: center.y + Math.floor(i / cols) * 210 - 100 }));
    addEls(made);
  } else {
    const el = newEl('text', { text: tx.trim(), x: center.x - 140, y: center.y - 20 });
    const m = textMetrics(el, 520);
    el.w = Math.ceil(m.w) + 8; el.h = Math.ceil(m.h) + 2; el.auto = false;
    addEls([el]);
  }
}

function deleteSel() {
  const ids = selEls().filter((e) => !e.locked).map((e) => e.id);
  if (ids.length) removeEls(ids);
}
function toggleLock() {
  const els = selEls();
  if (!els.length) return;
  const to = !els.every((e) => e.locked);
  mutate(els.map((e) => e.id), (e) => { e.locked = to; });
  renderInspector();
}
function groupSel() {
  const els = selEls();
  if (els.length < 2) return;
  const g = uid();
  mutate(els.map((e) => e.id), (e) => { e.group = g; });
  toast('Elementos agrupados');
  renderInspector();
}
function ungroupSel() {
  const els = selEls().filter((e) => e.group);
  if (!els.length) return;
  mutate(els.map((e) => e.id), (e) => { delete e.group; });
  renderInspector();
}
function orderSel(mode) {
  const sel = selEls();
  if (!sel.length) return;
  const others = allEls().filter((e) => !S.sel.has(e.id) && e.type !== 'frame').sort((a, b) => (a.z || 0) - (b.z || 0));
  const ids = sel.map((e) => e.id);
  const sorted = sel.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
  if (mode === 'front') { let z = maxZ(); mutate(ids, () => {}, { history: false }); const snap = snapshot(ids); sorted.forEach((e) => { e.z = ++z; }); commitFrom(snap); }
  else if (mode === 'back') { let z = Math.min(0, ...allEls().map((e) => e.z || 0)) - sel.length - 1; const snap = snapshot(ids); sorted.forEach((e) => { e.z = z++; }); commitFrom(snap); }
  else {
    const topSel = sorted[sorted.length - 1], lowSel = sorted[0];
    const peer = mode === 'up' ? others.find((o) => (o.z || 0) > (topSel.z || 0)) : others.slice().reverse().find((o) => (o.z || 0) < (lowSel.z || 0));
    if (!peer) return;
    const peerZ = peer.z || 0;
    const delta = mode === 'up' ? peerZ - (topSel.z || 0) + 0.001 : peerZ - (lowSel.z || 0) - 0.001;
    mutate(ids, (e) => { e.z = (e.z || 0) + delta; });
  }
  orderDirty = true;
  schedule();
}

function alignSel(mode) {
  const els = selEls().filter((e) => e.type !== 'line' && !e.locked);
  if (els.length < 2) return;
  const B = unionBox(els.map(elBox));
  mutate(els.map((e) => e.id), (e) => {
    const b = elBox(e);
    if (mode === 'l') e.x += B.x - b.x;
    if (mode === 'r') e.x += B.x + B.w - (b.x + b.w);
    if (mode === 'c') e.x += B.x + B.w / 2 - (b.x + b.w / 2);
    if (mode === 't') e.y += B.y - b.y;
    if (mode === 'b') e.y += B.y + B.h - (b.y + b.h);
    if (mode === 'm') e.y += B.y + B.h / 2 - (b.y + b.h / 2);
  });
}
function distributeSel(axis) {
  const els = selEls().filter((e) => e.type !== 'line' && !e.locked);
  if (els.length < 3) return;
  const P2 = axis === 'h' ? 'x' : 'y', D = axis === 'h' ? 'w' : 'h';
  const items = els.map((e) => ({ e, b: elBox(e) })).sort((a, b) => a.b[P2] - b.b[P2]);
  const first = items[0].b, last = items[items.length - 1].b;
  const total = items.reduce((s, it) => s + it.b[D], 0);
  const gap = (last[P2] + last[D] - first[P2] - total) / (items.length - 1);
  let pos = first[P2];
  const snap = snapshot(els.map((e) => e.id));
  for (const it of items) { it.e[P2] += pos - it.b[P2]; pos += it.b[D] + gap; invalidate(it.e.id); }
  commitFrom(snap);
}
function tidySel() {
  const els = selEls().filter((e) => e.type !== 'line' && e.type !== 'mind' && !e.locked);
  if (els.length < 2) return;
  const B = unionBox(els.map(elBox));
  const cols = Math.ceil(Math.sqrt(els.length));
  const cw = Math.max(...els.map((e) => e.w)) + 22, ch = Math.max(...els.map((e) => e.h)) + 22;
  const sorted = els.slice().sort((a, b) => Math.round(a.y / 80) - Math.round(b.y / 80) || a.x - b.x);
  const snap = snapshot(els.map((e) => e.id));
  sorted.forEach((e, i) => { e.x = B.x + (i % cols) * cw; e.y = B.y + Math.floor(i / cols) * ch; e.r = 0; invalidate(e.id); });
  commitFrom(snap);
  flyTo(unionBox(els.map(elBox)), { maxZ: S.cam.z, dur: 340 });
}

/* ---------- Fotos ---------- */
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const nw = img.naturalWidth || 800, nh = img.naturalHeight || 600;
    if (file.type === 'image/gif' && file.size < 1.8e6) return { blob: file, nw, nh };
    const k = Math.min(1, 2400 / Math.max(nw, nh));
    if (k === 1 && file.size < 900000 && /image\/(png|jpeg|webp)/.test(file.type)) return { blob: file, nw, nh };
    const c = h('canvas', { width: Math.round(nw * k), height: Math.round(nh * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = 0.86, blob = await toBlob(c, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') {
      if (file.type === 'image/png' && file.size < 1.8e6 && k === 1) return { blob: file, nw, nh };
      blob = await toBlob(c, 'image/jpeg', q);
    }
    while (blob.size > 1.85e6 && q > 0.34) { q -= 0.12; blob = await toBlob(c, blob.type, q); }
    return { blob, nw: c.width, nh: c.height };
  } finally { URL.revokeObjectURL(url); }
}

async function insertImages(files, at) {
  const a = viewArea();
  const pos = at || S.pendingAt || screenToWorld(a.x + a.w / 2, a.y + a.h / 2);
  S.pendingAt = null;
  const made = [];
  const n = files.length, cols = Math.ceil(Math.sqrt(n));
  toast(n > 1 ? `Subiendo ${n} fotos` : 'Subiendo foto', { ms: 1600 });
  for (let i = 0; i < n; i++) {
    try {
      const { blob, nw, nh } = await prepareImage(files[i]);
      const asset = await Api.putAsset(S.boardId, blob);
      const W = Math.min(420, nw), H = (W * nh) / nw;
      made.push(newEl('image', { asset, ab: S.boardId, nw, nh, w: W, h: H, x: pos.x - W / 2 + (i % cols) * 440 - ((cols - 1) * 440) / 2, y: pos.y - H / 2 + Math.floor(i / cols) * 340 }));
    } catch { toast(`No se pudo subir ${files[i].name}. Prueba con otra imagen.`); }
  }
  if (made.length) addEls(made);
}

async function replaceImage(el, file) {
  try {
    const { blob, nw, nh } = await prepareImage(file);
    const asset = await Api.putAsset(S.boardId, blob);
    mutate([el.id], (e) => { e.asset = asset; e.ab = S.boardId; e.nw = nw; e.nh = nh; e.zoom = 1; e.fcx = 0.5; e.fcy = 0.5; });
    renderInspector();
  } catch { toast('No se pudo cambiar la foto'); }
}

/* Marcos para el ejemplo inicial */
async function genStill(kind) {
  const W = 1200, H = 800, c = h('canvas', { width: W, height: H }), x = c.getContext('2d');
  const P2 = {
    dusk: ['#0d1016', '#22303c', '#6d6a63', '#c29a6b'],
    teal: ['#060a0d', '#0f2529', '#27474a', '#7d8a80'],
    wine: ['#08060a', '#231419', '#55262c', '#a0654f'],
  }[kind];
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P2[0]); sky.addColorStop(0.52, P2[1]); sky.addColorStop(0.72, P2[2]); sky.addColorStop(0.8, P2[3]);
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const sx = W * (kind === 'dusk' ? 0.68 : kind === 'teal' ? 0.3 : 0.5), sy = H * 0.68;
  const glow = x.createRadialGradient(sx, sy, 0, sx, sy, 520);
  glow.addColorStop(0, rgba(P2[3], 0.75)); glow.addColorStop(0.28, rgba(P2[3], 0.2)); glow.addColorStop(1, rgba(P2[3], 0));
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.fillStyle = rgba('#f4e6cf', 0.9); x.beginPath(); x.arc(sx, sy, 22, 0, 7); x.fill();
  const seeds = kind === 'dusk' ? 11 : kind === 'teal' ? 23 : 37;
  for (let layer = 0; layer < 4; layer++) {
    const base = H * (0.7 + layer * 0.075), amp = 58 - layer * 8;
    x.fillStyle = `rgb(${14 - layer * 3},${15 - layer * 3},${18 - layer * 3})`;
    x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 12) {
      const s = seeds + layer * 7;
      x.lineTo(px, base + Math.sin(px * 0.0038 + s) * amp + Math.sin(px * 0.011 + s * 2) * amp * 0.32 + Math.sin(px * 0.031 + s) * amp * 0.08);
    }
    x.lineTo(W, H); x.closePath(); x.fill();
  }
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  const im = x.getImageData(0, 0, W, H);
  for (let i = 0; i < im.data.length; i += 4) { const g = (Math.random() - 0.5) * 12; im.data[i] += g; im.data[i + 1] += g; im.data[i + 2] += g; }
  x.putImageData(im, 0, 0);
  return { blob: await toBlob(c, 'image/jpeg', 0.8), nw: W, nh: H };
}

/* ---------- Render a canvas ---------- */
let _grainImg = null;
async function paintEl(x, e) {
  x.save();
  x.globalAlpha = e.opa ?? 1;
  if (e.type === 'line') { paintLine(x, e); x.restore(); return; }
  const c = centerOf(e);
  x.translate(c.x, c.y); x.rotate(((e.r || 0) * Math.PI) / 180); x.translate(-e.w / 2, -e.h / 2);
  if (e.shadow) { x.shadowColor = rgba(e.shadow.c, e.shadow.a); x.shadowBlur = e.shadow.b; x.shadowOffsetY = e.shadow.y; }
  if (e.glow) { x.shadowColor = rgba(e.glow.c, e.glow.a); x.shadowBlur = e.glow.b; x.shadowOffsetY = 0; }
  switch (e.type) {
    case 'shape': { const sh = SHAPES[e.kind] || SHAPES.rect; paintBody(x, e, sh.d(e.w, e.h, e.rad), sh.extra?.(e.w, e.h)); paintBoxText(x, e, sh.inset, 10); break; }
    case 'sticky': paintBody(x, e, rr(e.w, e.h, e.rad)); paintBoxText(x, e, undefined, 16); break;
    case 'text': if (e.fill && e.fill.t !== 'none') paintBody(x, { ...e, sw: 0 }, rr(e.w, e.h, 6)); paintBoxText(x, e, undefined, 0); break;
    case 'frame': paintBody(x, e, rr(e.w, e.h, e.rad)); x.shadowColor = 'transparent'; x.fillStyle = '#a7a39b'; x.font = '500 13px Geist, sans-serif'; x.textBaseline = 'bottom'; x.fillText(e.name || 'Marco', 2, -7); break;
    case 'image': await paintImage(x, e); break;
    case 'draw': {
      x.strokeStyle = paintCanvas(x, e.stroke, e.w, e.h); x.lineWidth = e.sw; x.lineCap = 'round'; x.lineJoin = 'round';
      x.stroke(new Path2D(strokePath(e.pts, e.w / (e.ow || 1), e.h / (e.oh || 1))));
      break;
    }
    case 'mind': {
      const p = e.parent ? S.els.get(e.parent) : null;
      if (p) {
        const dir = e.side === 'l' ? -1 : 1, sx = (dir > 0 ? p.x + p.w : p.x) - e.x, sy = p.y + p.h / 2 - e.y, ex = dir > 0 ? 0 : e.w, ey = e.h / 2, k = Math.abs(ex - sx) * 0.55;
        x.strokeStyle = rgba(e.branch, 0.85); x.lineWidth = p.parent ? 1.4 : 2; x.lineCap = 'round';
        x.beginPath(); x.moveTo(sx, sy); x.bezierCurveTo(sx + dir * k, sy, ex - dir * k, ey, ex, ey); x.stroke();
      }
      const body = !e.parent ? e : (!e.fill || e.fill.t === 'none') ? { ...e, stroke: solid(e.branch, 0.5) } : e;
      paintBody(x, body, rr(e.w, e.h, e.parent ? e.rad : Math.min(e.rad + 8, e.h / 2)));
      x.shadowColor = 'transparent';
      const px = e.parent ? 14 : 26;
      x.font = fontStr(e, e.size); x.textBaseline = 'alphabetic'; x.fillStyle = paintCanvas(x, e.color, e.w, e.h);
      const m = textMetrics(e, 300), startY = (e.h - m.lines.length * e.size * 1.3) / 2;
      x.font = fontStr(e, e.size);
      m.lines.forEach((l, i) => x.fillText(l, px, startY + i * e.size * 1.3 + e.size));
      break;
    }
    case 'table': {
      x.fillStyle = paintCanvas(x, e.fill, e.w, e.h); x.fill(new Path2D(rr(e.w, e.h, 8)));
      const rows = e.cells.length, cols = e.cells[0].length, cw = e.w / cols, ch = e.h / rows;
      x.strokeStyle = paintCSS(e.stroke); x.lineWidth = 1;
      for (let i = 1; i < rows; i++) { x.beginPath(); x.moveTo(0, i * ch); x.lineTo(e.w, i * ch); x.stroke(); }
      for (let i = 1; i < cols; i++) { x.beginPath(); x.moveTo(i * cw, 0); x.lineTo(i * cw, e.h); x.stroke(); }
      x.fillStyle = paintCSS(e.color); x.textBaseline = 'top';
      e.cells.forEach((row, r) => row.forEach((t, c2) => {
        const st = { ...e, weight: e.header && r === 0 ? 600 : e.weight };
        x.font = fontStr(st, e.size);
        wrapText(t, x.font, cw - 20).slice(0, 8).forEach((l, i) => { x.font = fontStr(st, e.size); x.fillText(l, c2 * cw + 10, r * ch + 9 + i * e.size * 1.3); });
      }));
      break;
    }
    case 'check': {
      paintBody(x, e, rr(e.w, e.h, e.rad));
      x.shadowColor = 'transparent'; x.fillStyle = paintCSS(e.color); x.textBaseline = 'top';
      x.font = fontStr({ ...e, weight: 600 }, e.size + 1); x.fillText(e.title, 16, 14);
      x.font = fontStr(e, e.size);
      e.items.forEach((it, i) => {
        const y = 46 + i * (e.size + 15);
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.strokeRect(16, y, 15, 15);
        if (it.d) x.fillText('✓', 18, y - 1);
        x.fillText(it.t, 42, y - 1);
      });
      break;
    }
    case 'link': {
      paintBody(x, e, rr(e.w, e.h, e.rad)); x.shadowColor = 'transparent';
      x.fillStyle = '#ece8e1'; x.textBaseline = 'top'; x.font = '600 15px Geist, sans-serif'; x.fillText(e.title || 'Enlace', 18, 26);
      x.fillStyle = '#a7a39b'; x.font = '400 13px Geist, sans-serif';
      let host = ''; try { host = new URL(e.url).hostname; } catch {}
      x.fillText(host, 18, 50);
      break;
    }
  }
  x.restore();
}
function paintBody(x, e, d, extra) {
  const p = new Path2D(d);
  const f = paintCanvas(x, e.fill, e.w, e.h);
  if (f) { x.fillStyle = f; x.fill(p); }
  x.shadowColor = 'transparent';
  if (f && e.fill.g > 0 && _grainImg) {
    x.save(); x.globalAlpha *= Math.min(1, e.fill.g); x.fillStyle = x.createPattern(_grainImg, 'repeat'); x.fill(p); x.restore();
  }
  if (e.sw > 0 && e.stroke && e.stroke.t !== 'none') {
    x.strokeStyle = paintCanvas(x, e.stroke, e.w, e.h); x.lineWidth = e.sw; x.lineJoin = 'round';
    const ds = strokeDash(e.dash, e.sw);
    x.setLineDash(ds ? ds.split(' ').map(Number) : []);
    x.lineCap = e.dash === 'dot' ? 'round' : 'butt';
    x.stroke(p);
    if (extra) x.stroke(new Path2D(extra));
    x.setLineDash([]);
  }
}
function paintBoxText(x, e, ins = [0, 0, 0, 0], pad = 10) {
  if (!e.text) return;
  x.shadowColor = 'transparent';
  const left = e.w * ins[3] + pad, top = e.h * ins[0] + pad, W = e.w - left - e.w * ins[1] - pad, H = e.h - top - e.h * ins[2] - pad;
  const size = e.autofit ? fitSize(e, e.w - pad * 2, e.h - pad * 2, 30) : e.size;
  const f = fontStr(e, size), lines = wrapText(e.text, f, W), lh = size * 1.3, th = lines.length * lh;
  const oy = e.valign === 'top' ? top : e.valign === 'bottom' ? top + H - th : top + (H - th) / 2;
  x.font = f; x.textBaseline = 'alphabetic'; x.textAlign = e.align || 'left';
  x.fillStyle = paintCanvas(x, e.color, e.w, e.h);
  const ax = e.align === 'center' ? left + W / 2 : e.align === 'right' ? left + W : left;
  lines.forEach((l, i) => x.fillText(l, ax, oy + i * lh + size * 1.02));
  x.textAlign = 'left';
}
async function paintImage(x, e) {
  const d = new Path2D(SHAPES[e.mask || 'rect'].d(e.w, e.h, e.rad || 0));
  const url = Assets.url(e);
  x.save(); x.clip(d); x.shadowColor = 'transparent';
  if (url) {
    try {
      const img = await loadImg(url);
      const L = imageLayout(e);
      x.save();
      const flt = imgFilter(e.fx);
      if (flt && 'filter' in x) x.filter = flt;
      if (e.flipH || e.flipV) { x.translate(L.left + L.dw / 2, L.top + L.dh / 2); x.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1); x.translate(-(L.left + L.dw / 2), -(L.top + L.dh / 2)); }
      x.drawImage(img, L.left, L.top, L.dw, L.dh);
      x.restore();
    } catch {}
  }
  const fx = e.fx || {};
  if (fx.w) { x.save(); x.globalCompositeOperation = 'soft-light'; x.globalAlpha *= Math.abs(fx.w) / 100; x.fillStyle = fx.w > 0 ? '#d69a55' : '#4f7d9a'; x.fillRect(0, 0, e.w, e.h); x.restore(); }
  if (e.ov?.p) { x.save(); x.globalCompositeOperation = e.ov.m === 'normal' || !e.ov.m ? 'source-over' : e.ov.m; x.globalAlpha *= e.ov.o ?? 1; x.fillStyle = paintCanvas(x, e.ov.p, e.w, e.h); x.fillRect(0, 0, e.w, e.h); x.restore(); }
  if (fx.v) {
    const R = Math.hypot(e.w, e.h) / 2, g = x.createRadialGradient(e.w / 2, e.h / 2, R * 0.42, e.w / 2, e.h / 2, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${fx.v / 100})`);
    x.fillStyle = g; x.fillRect(0, 0, e.w, e.h);
  }
  x.restore();
  if (e.sw > 0) { x.strokeStyle = paintCanvas(x, e.stroke, e.w, e.h); x.lineWidth = e.sw; x.stroke(d); }
}
function paintLine(x, e) {
  const g = lineGeom(e);
  let st = paintCSS(e.stroke);
  if (e.stroke.t !== 'solid') {
    st = x.createLinearGradient(g.a.x, g.a.y, g.b.x + 0.01, g.b.y + 0.01);
    for (const s of e.stroke.s) st.addColorStop(clamp(s.o, 0, 1), stopColor(s));
  }
  x.strokeStyle = st; x.lineWidth = e.sw; x.lineCap = 'round'; x.lineJoin = 'round';
  const ds = strokeDash(e.dash, e.sw);
  x.setLineDash(ds ? ds.split(' ').map(Number) : []);
  x.stroke(new Path2D(g.d));
  x.setLineDash([]);
  for (const [cap, tip, n, col] of [[e.capA, g.a, g.na, firstColor(e.stroke)], [e.capB, g.b, g.nb, lastColor(e.stroke)]]) {
    const node = capNode(cap, tip, n, e.sw, col);
    if (!node) continue;
    if (node.tagName === 'circle') { x.fillStyle = col; x.beginPath(); x.arc(+node.getAttribute('cx'), +node.getAttribute('cy'), +node.getAttribute('r'), 0, 7); x.fill(); continue; }
    const p = new Path2D(node.getAttribute('d'));
    if (node.getAttribute('fill') === 'none' || cap === 'bar') { x.strokeStyle = col; x.stroke(p); } else { x.fillStyle = col; x.fill(p); }
  }
}
async function renderCanvas(box, scale, withScene) {
  if (!_grainImg && GRAIN_URL) { try { _grainImg = await loadImg(GRAIN_URL); } catch {} }
  const W = Math.max(1, Math.round(box.w * scale)), H = Math.max(1, Math.round(box.h * scale));
  const c = h('canvas', { width: W, height: H }), x = c.getContext('2d');
  const list = allEls().filter((e) => !e.hidden && e.type !== 'comment').sort((a, b) => (a.type === 'frame') !== (b.type === 'frame') ? (a.type === 'frame' ? -1 : 1) : (a.z || 0) - (b.z || 0));
  if (withScene) Scene.capture(x, W, H);
  x.scale(scale, scale);
  x.translate(-box.x, -box.y);
  for (const e of list) {
    if (boxesOverlap(elBox(e), { x: box.x - 100, y: box.y - 100, w: box.w + 200, h: box.h + 200 })) await paintEl(x, e);
  }
  return c;
}

const Thumb = {
  dirty: false,
  mark: debounce(() => Thumb.run(), 6000),
  async run() {
    if (!S.boardId || !Thumb.dirty) return;
    Thumb.dirty = false;
    const id = S.boardId;
    try {
      const list = allEls().filter((e) => !e.hidden && e.type !== 'comment').map(elBox);
      let b = unionBox(list) || { x: 0, y: 0, w: 800, h: 500 };
      const pad = Math.max(b.w, b.h) * 0.08;
      b = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
      const ratio = 16 / 10;
      if (b.w / b.h < ratio) { const n = b.h * ratio; b.x -= (n - b.w) / 2; b.w = n; } else { const n = b.w / ratio; b.y -= (n - b.h) / 2; b.h = n; }
      const c = await renderCanvas(b, 560 / b.w, true);
      const thumb = c.toDataURL('image/jpeg', 0.72);
      if (S.boardId === id && thumb.length < 150000) await Api.updateBoard(id, { thumb });
    } catch (err) { console.warn('thumb', err); }
  },
};
_changeHooks.push(() => { Thumb.dirty = true; Thumb.mark(); });

function currentFrame() {
  const v = viewCenterOf(S.cam);
  return allEls().filter((e) => e.type === 'frame' && ptInBox(v, e))[0] || null;
}
async function doExport({ scope, scale, scene }) {
  let list;
  if (scope === 'sel') list = selEls();
  else if (scope === 'frame') list = [currentFrame()].filter(Boolean);
  else list = allEls().filter((e) => !e.hidden && e.type !== 'comment');
  if (!list.length) { toast('No hay nada que exportar con esa opción'); return; }
  let b = unionBox(list.map(elBox));
  const pad = scope === 'frame' ? 0 : 60;
  b = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  const safe = Math.min(scale, 8000 / Math.max(b.w, b.h));
  const c = await renderCanvas(b, safe, scene);
  const blob = await toBlob(c, 'image/png');
  saveFile(blob, `${(S.board?.name || 'tablero').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '')}.png`);
  toast('Imagen exportada');
}
function exportJSON() {
  const data = { app: 'seebase', version: 1, name: S.board?.name, elements: allEls().concat(getMeta() ? [getMeta()] : []) };
  saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${S.board?.name || 'tablero'}.seebase.json`);
  toast('Copia de seguridad descargada');
}
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'seebase' || !Array.isArray(data.elements)) throw 0;
    const list = data.elements.filter((e) => e.type[0] !== '_').map((e) => { if (e.type === 'line') { e._g = [e.a.x || 0, e.a.y || 0, e.b.x || 0, e.b.y || 0]; } return e; });
    const a = viewArea();
    pasteData(list, { at: screenToWorld(a.x + a.w / 2, a.y + a.h / 2) });
    toast(`${list.length} elementos importados`);
    fitAll();
  } catch { toast('Ese archivo no es una copia válida de SeeBase'); }
}
