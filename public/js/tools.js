'use strict';
/* Interacción con el lienzo */
let Drag = null, spaceDown = false, pinch = null;
const touches = new Map();
const TRBL = ['t', 'r', 'b', 'l'];
const OPP = { t: 'b', b: 't', l: 'r', r: 'l' };

const eventWorld = (e) => screenToWorld(e.clientX, e.clientY);
function hitId(e) { const n = e.target.closest?.('[data-id]'); return n ? n.dataset.id : null; }
function groupIds(id) {
  const e = S.els.get(id);
  if (e?.group && S.enterGroup !== e.group) return allEls().filter((x) => x.group === e.group).map((x) => x.id);
  return [id];
}
const normBox = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
function isTyping(t = document.activeElement) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }

function setTool(t) {
  if (S.crop) finishCrop();
  finishEdit();
  S.tool = t;
  stage.dataset.tool = t;
  if (t !== 'select') setSel([]);
  renderRail();
  touchOverlay();
}

function ptInRotated(p, e, m = 0) {
  const c = centerOf(e), [lx, ly] = rotV([p.x - c.x, p.y - c.y], -(e.r || 0));
  return Math.abs(lx) <= e.w / 2 + m && Math.abs(ly) <= e.h / 2 + m;
}
function elementAt(p, excl) {
  let best = null;
  for (const e of allEls()) {
    if (e.id === excl || e.hidden || ['line', 'draw', 'comment', 'frame'].includes(e.type)) continue;
    if (ptInRotated(p, e, 8 / S.cam.z) && (!best || (e.z || 0) > (best.z || 0))) best = e;
  }
  return best;
}
function nearestSide(e, p) {
  let s = 't', d = 1e12;
  for (const k of TRBL) { const a = anchor(e, k), q = Math.hypot(a.x - p.x, a.y - p.y); if (q < d) { d = q; s = k; } }
  return { s, near: d < Math.max(18 / S.cam.z, Math.min(e.w, e.h) * 0.2) };
}

function onDown(e) {
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { startPinch(); return; }
  }
  if (e.button === 2) return;
  closeMenus();
  const t = e.target;
  if (t.closest('[data-nodrag]')) return;
  if (S.editing) {
    if (t.closest('[contenteditable]')) return;
    finishEdit();
  }
  document.activeElement?.blur?.();
  const w = eventWorld(e);
  if (e.button === 1 || spaceDown || S.tool === 'hand') { startPan(e); return; }
  const fold = t.closest('[data-fold]');
  if (fold) { toggleFold(fold.dataset.fold); return; }
  const plus = t.closest('[data-mm]');
  if (plus) { mindAddFromPlus(plus.dataset.mm); return; }
  const pin = t.closest('[data-pin]');
  if (pin) { openThread(pin.dataset.pin); return; }
  closeThread();
  if (t.dataset.qc) { startQuickConnect(e, w, t.dataset.qcid, t.dataset.qc); return; }
  if (t.dataset.end) { startLineEnd(w, t.dataset.end); return; }
  if (t.dataset.h) {
    if (S.crop) startCropResize(t.dataset.h);
    else if (t.dataset.h === 'rot') startRotate(w);
    else startResize(w, t.dataset.h);
    return;
  }
  if (S.crop) {
    if (hitId(e) === S.crop.id) startCropPan(w);
    else finishCrop();
    return;
  }
  const chk = t.closest('[data-chk]');
  if (chk && S.tool === 'select') { toggleCheck(hitId(e), +chk.dataset.chk); return; }

  switch (S.tool) {
    case 'select': beginSelect(e, w); break;
    case 'sticky': placeSticky(w); break;
    case 'text': placeText(w); break;
    case 'shape': startCreate(w, 'shape'); break;
    case 'frame': startCreate(w, 'frame'); break;
    case 'table': startCreate(w, 'table'); break;
    case 'check': startCreate(w, 'check'); break;
    case 'link': placeLink(w); break;
    case 'line': startLineTool(w); break;
    case 'pen': case 'marker': startDraw(w); break;
    case 'eraser': startErase(e); break;
    case 'mind': placeMindRoot(w); break;
    case 'image': S.pendingAt = w; $('#filepick').click(); setTool('select'); break;
    case 'comment': newComment(w); break;
    case 'vote': castVote(hitId(e)); break;
    case 'stamp': placeStamp(w); break;
  }
}

function onMove(e) {
  if (!S.boardId) return;
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { doPinch(); return; }
  }
  const w = eventWorld(e);
  if (Drag) { if (e.cancelable) e.preventDefault(); Drag.move?.(e, w); }
  else updateHover(e, w);
  if (e.target?.closest?.('#stage')) Presence.sendCursor(w.x, w.y);
}

function onUp(e) {
  touches.delete(e.pointerId);
  if (pinch) { if (touches.size < 2) pinch = null; return; }
  if (!Drag) return;
  const d = Drag; Drag = null;
  d.up?.(e, eventWorld(e));
  S.guides = [];
  touchOverlay();
  if (d.refresh !== false) renderInspectorSoon();
}

function updateHover(e, w) {
  if (S.tool !== 'select') { if (S.hover) { S.hover = null; touchOverlay(); } return; }
  let id = hitId(e);
  if (!id && S.hover) {
    const h2 = S.els.get(S.hover);
    if (h2 && h2.type !== 'line' && h2.type !== 'draw' && ptInRotated(w, h2, 34 / S.cam.z) && !e.target.closest?.('.ui')) id = S.hover;
  }
  if (id !== S.hover) { S.hover = id; touchOverlay(); }
}

function startPan(e) {
  stopFollow(); stopCamAnim();
  let lx = e.clientX, ly = e.clientY;
  stage.classList.add('panning');
  Drag = {
    refresh: false,
    move(ev) { S.cam.x += ev.clientX - lx; S.cam.y += ev.clientY - ly; lx = ev.clientX; ly = ev.clientY; applyCam(); },
    up() { stage.classList.remove('panning'); },
  };
}

function startPinch() {
  Drag = null;
  const [a, b] = [...touches.values()];
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}
function doPinch() {
  const [a, b] = [...touches.values()];
  if (!a || !b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  S.cam.x += cx - pinch.cx; S.cam.y += cy - pinch.cy;
  zoomAt(cx, cy, d / pinch.d);
  pinch = { d, cx, cy };
}

function onWheel(e) {
  if (e.target.closest?.('.ui')) return;
  e.preventDefault();
  stopFollow();
  const isMouse = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 80 && Number.isInteger(e.deltaY) && e.deltaX === 0);
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-clamp(e.deltaY, -60, 60) * 0.012));
  else if (isMouse) zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  else { S.cam.x -= e.deltaX; S.cam.y -= e.deltaY; stopCamAnim(); applyCam(); }
}

function beginSelect(e, w) {
  const id = hitId(e);
  if (!id) {
    if (!e.shiftKey) { S.enterGroup = null; setSel([]); }
    startMarquee(e, w);
    return;
  }
  const el = S.els.get(id);
  if (!el) return;
  const isBody = el.type === 'frame' && !e.target.closest('.fr-title') && !S.sel.has(id);
  if (isBody && !e.shiftKey) { setSel([]); startMarquee(e, w, id); return; }
  const g = groupIds(id);
  if (e.shiftKey) {
    const has = S.sel.has(id);
    const next = new Set(S.sel);
    g.forEach((i) => (has ? next.delete(i) : next.add(i)));
    setSel([...next]);
    return;
  }
  if (!S.sel.has(id)) setSel(g);
  startMove(e, w, id);
}

function startMarquee(e, w, clickSelect) {
  const base = e.shiftKey ? new Set(S.sel) : new Set();
  let moved = false;
  Drag = {
    move(ev, p) {
      if (!moved && Math.hypot(p.x - w.x, p.y - w.y) * S.cam.z < 3) return;
      moved = true;
      const m = (S.marquee = normBox(w, p));
      const ids = new Set(base);
      for (const el of allEls()) {
        if (el.locked || el.hidden || el.type === 'comment') continue;
        const b = elBox(el);
        if (el.type === 'frame' ? boxInside(b, m) : boxesOverlap(b, m)) groupIds(el.id).forEach((i) => ids.add(i));
      }
      S.sel = ids;
      touchOverlay();
    },
    up() {
      S.marquee = null;
      if (!moved && clickSelect) setSel(groupIds(clickSelect));
      else selChanged();
    },
  };
}

function movingSet() {
  const ids = new Set();
  for (const id of S.sel) {
    const e = S.els.get(id);
    if (!e || e.locked) continue;
    ids.add(id);
    if (e.type === 'frame') {
      const fb = elBox(e);
      for (const c of allEls()) {
        if (c.id === id || c.locked || c.type === 'frame') continue;
        if (c.type === 'line') { const g = lineGeom(c); if (ptInBox(g.a, fb) && ptInBox(g.b, fb)) ids.add(c.id); continue; }
        const b = c.type === 'comment' ? { x: c.x, y: c.y, w: 0, h: 0 } : elBox(c);
        if (ptInBox({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, fb)) ids.add(c.id);
      }
    }
    if (e.type === 'mind') mindDescendants(id).forEach((d) => ids.add(d));
  }
  return ids;
}

function guideTargets(moving) {
  const a = viewArea(), { z, x: cx, y: cy } = S.cam;
  const v = { x: (0 - cx) / z, y: (0 - cy) / z, w: innerWidth / z, h: innerHeight / z };
  const out = [];
  for (const e of allEls()) {
    if (moving.has(e.id) || e.hidden || ['line', 'draw', 'comment'].includes(e.type)) continue;
    const b = elBox(e);
    if (boxesOverlap(b, v)) out.push(b);
    if (out.length > 300) break;
  }
  return out;
}

function snapMove(B, targets, grid) {
  const T = 6 / S.cam.z;
  let dx = 0, dy = 0, bx = T, by = T;
  const xs = [B.x, B.x + B.w / 2, B.x + B.w], ys = [B.y, B.y + B.h / 2, B.y + B.h];
  for (const t of targets) {
    for (const a of xs) for (const b of [t.x, t.x + t.w / 2, t.x + t.w]) { const d = b - a; if (Math.abs(d) < bx) { bx = Math.abs(d); dx = d; } }
    for (const a of ys) for (const b of [t.y, t.y + t.h / 2, t.y + t.h]) { const d = b - a; if (Math.abs(d) < by) { by = Math.abs(d); dy = d; } }
  }
  if (grid) {
    const gx = Math.round(B.x / 24) * 24 - B.x, gy = Math.round(B.y / 24) * 24 - B.y;
    if (bx === T) dx = gx;
    if (by === T) dy = gy;
  }
  const guides = [];
  const R = { x: B.x + dx, y: B.y + dy, w: B.w, h: B.h };
  const rxs = [R.x, R.x + R.w / 2, R.x + R.w], rys = [R.y, R.y + R.h / 2, R.y + R.h];
  for (const t of targets) {
    for (const a of rxs) for (const b of [t.x, t.x + t.w / 2, t.x + t.w]) if (Math.abs(a - b) < 0.5) guides.push({ v: 1, p: b, a: Math.min(R.y, t.y), b: Math.max(R.y + R.h, t.y + t.h) });
    for (const a of rys) for (const b of [t.y, t.y + t.h / 2, t.y + t.h]) if (Math.abs(a - b) < 0.5) guides.push({ v: 0, p: b, a: Math.min(R.x, t.x), b: Math.max(R.x + R.w, t.x + t.w) });
  }
  return { dx, dy, guides: guides.slice(0, 14) };
}

function startMove(e, w, clickId) {
  let ids = [...movingSet()];
  if (!ids.length) return;
  let snap = snapshot(ids), moved = false, origin, deps, targets, box0;
  const prep = () => {
    origin = new Map(ids.map((id) => [id, clone(S.els.get(id))]));
    const set = new Set(ids);
    deps = allEls().filter((l) => l.type === 'line' && !set.has(l.id) && ((l.a.id && set.has(l.a.id)) || (l.b.id && set.has(l.b.id)))).map((l) => l.id);
    targets = guideTargets(set);
    box0 = unionBox(ids.map((id) => S.els.get(id)).filter((x) => x.type !== 'line' && x.type !== 'comment').map(elBox));
  };
  prep();
  Drag = {
    move(ev, p) {
      let dx = p.x - w.x, dy = p.y - w.y;
      if (!moved) {
        if (Math.hypot(dx, dy) * S.cam.z < 3) return;
        moved = true;
        if (ev.altKey) {
          const copies = pasteData(serializeIds(ids), { offset: 0, select: true });
          ids = [...new Set([...S.sel])];
          snap = snapshot(ids);
          copies && prep();
        }
        $('#qbar').hidden = true;
      }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      S.guides = [];
      if (box0 && !ev.metaKey && !ev.ctrlKey) {
        const g = getMeta()?.grid;
        const sn = snapMove({ x: box0.x + dx, y: box0.y + dy, w: box0.w, h: box0.h }, targets, g?.snap);
        dx += sn.dx; dy += sn.dy; S.guides = sn.guides;
      }
      for (const id of ids) {
        const el = S.els.get(id), o = origin.get(id);
        if (!el) continue;
        if (el.type === 'line') {
          if (!el.a.id) el.a = { x: o.a.x + dx, y: o.a.y + dy };
          if (!el.b.id) el.b = { x: o.b.x + dx, y: o.b.y + dy };
          drawEl(el);
        } else {
          el.x = o.x + dx; el.y = o.y + dy;
          if (el.type === 'mind') drawEl(el); else placeEl(el);
        }
      }
      deps.forEach((id) => { const l = S.els.get(id); if (l) drawEl(l); });
      touchOverlay(); minimapDirty = true;
      Presence.sendLive(ids);
    },
    up(ev, p) {
      if (!moved) {
        if (clickId && S.sel.size > 1 && !ev.shiftKey) setSel(groupIds(clickId));
        return;
      }
      const sel = selEls();
      if (sel.length === 1 && sel[0].type === 'mind' && sel[0].parent) finishMindDrag(sel[0], p, snap);
      else commitFrom(snap);
    },
  };
}

function finishMindDrag(node, p, snap) {
  const sub = new Set([node.id, ...mindDescendants(node.id)]);
  const oldRoot = mindRootOf(node);
  const trees = () => [oldRoot.id, ...mindDescendants(oldRoot.id)];
  let target = null;
  for (const e of allEls()) if (e.type === 'mind' && !sub.has(e.id) && !e.hidden && ptInBox(p, e, 6)) target = e;
  const treeIds = new Set(trees());
  if (target) { const r = mindRootOf(target); [r.id, ...mindDescendants(r.id)].forEach((i) => treeIds.add(i)); }
  const s2 = snapshot(treeIds);
  for (const [k, v] of snap) s2.set(k, v);
  const setSide = (side) => { node.side = side; mindDescendants(node.id).forEach((d) => { S.els.get(d).side = side; }); };
  if (target && target.id !== node.parent) {
    const sibs = mindKids().get(target.id) || [];
    node.parent = target.id;
    node.order = sibs.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    setSide(target.parent ? target.side : (p.x < target.x + target.w / 2 ? 'l' : 'r'));
    if (target.parent) { node.branch = target.branch; mindDescendants(node.id).forEach((d) => { S.els.get(d).branch = target.branch; }); }
  } else {
    const par = S.els.get(node.parent);
    if (par && !par.parent) setSide(p.x < par.x + par.w / 2 ? 'l' : 'r');
    const sibs = (mindKids().get(node.parent) || []).filter((s) => s.side === node.side).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
    sibs.forEach((s, i) => { s.order = i; });
  }
  const r = mindRootOf(node);
  layoutMind(r.id);
  if (r.id !== oldRoot.id) layoutMind(oldRoot.id);
  commitFrom(s2);
}

function startResize(w, hd) {
  const els = selEls().filter((e) => !e.locked);
  if (!els.length) return;
  if (els.length > 1) { startGroupResize(els, hd); return; }
  const el = els[0], snap = snapshot([el.id]);
  const o = { x: el.x, y: el.y, w: el.w, h: el.h, r: el.r || 0, size: el.size };
  const hx = hd.includes('e') ? 1 : hd.includes('w') ? -1 : 0, hy = hd.includes('s') ? 1 : hd.includes('n') ? -1 : 0;
  const c0 = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
  const isCorner = hx && hy;
  Drag = {
    move(ev, p) {
      const [lx, ly] = rotV([p.x - c0.x, p.y - c0.y], -o.r);
      const ax = (-hx * o.w) / 2, ay = (-hy * o.h) / 2;
      let nw = hx ? Math.max(14, (lx - ax) * hx) : o.w, nh = hy ? Math.max(14, (ly - ay) * hy) : o.h;
      const defKeep = (el.type === 'image' && el.fit !== 'stretch') || el.type === 'sticky' || el.type === 'text';
      const keep = isCorner && (defKeep ? !ev.shiftKey : ev.shiftKey);
      if (keep) { const s = Math.max(nw / o.w, nh / o.h); nw = o.w * s; nh = o.h * s; }
      if (el.type === 'text') {
        if (isCorner) { el.size = Math.max(6, round2(o.size * (nw / o.w))); el.auto = false; }
        else el.auto = false;
        el.w = nw;
        nh = Math.max(textMetrics(el, nw).h + 2, 10);
      }
      const lcx = hx ? ax + (hx * nw) / 2 : 0;
      const lcy = hy ? ay + (hy * nh) / 2 : el.type === 'text' ? (nh - o.h) / 2 : 0;
      const [wx, wy] = rotV([lcx, lcy], o.r);
      el.w = nw; el.h = nh; el.x = c0.x + wx - nw / 2; el.y = c0.y + wy - nh / 2;
      drawEl(el);
      invalidateDeps(el.id);
      touchOverlay();
      Presence.sendLive([el.id]);
    },
    up() { commitFrom(snap); },
  };
}
function invalidateDeps(id) {
  for (const l of S.els.values()) if (l.type === 'line' && (l.a.id === id || l.b.id === id)) drawEl(l);
}

function startGroupResize(els, hd) {
  const ids = els.map((e) => e.id), snap = snapshot(ids), b = unionBox(els.map(elBox));
  const origin = new Map(ids.map((id) => [id, clone(S.els.get(id))]));
  const hx = hd.includes('e') ? 1 : hd.includes('w') ? -1 : 0, hy = hd.includes('s') ? 1 : hd.includes('n') ? -1 : 0;
  const ax = hx < 0 ? b.x + b.w : b.x, ay = hy < 0 ? b.y + b.h : b.y;
  Drag = {
    move(ev, p) {
      let sx = hx ? Math.max(0.04, ((p.x - ax) * hx) / b.w) : 1, sy = hy ? Math.max(0.04, ((p.y - ay) * hy) / b.h) : 1;
      if (hx && hy && !ev.shiftKey) sx = sy = Math.max(sx, sy);
      for (const id of ids) {
        const e = S.els.get(id), o = origin.get(id);
        if (e.type === 'line') {
          if (!e.a.id) e.a = { x: ax + (o.a.x - ax) * sx, y: ay + (o.a.y - ay) * sy };
          if (!e.b.id) e.b = { x: ax + (o.b.x - ax) * sx, y: ay + (o.b.y - ay) * sy };
        } else if (e.type !== 'mind') {
          e.x = ax + (o.x - ax) * sx; e.y = ay + (o.y - ay) * sy;
          e.w = o.w * sx; e.h = o.h * sy;
          if (e.type === 'text' && sx === sy) e.size = round2(o.size * sx);
        }
        drawEl(e);
      }
      ids.forEach(invalidateDeps);
      touchOverlay();
    },
    up() { commitFrom(snap); },
  };
}

function startRotate(w) {
  const els = selEls().filter((e) => !e.locked && e.type !== 'line' && e.type !== 'mind');
  if (!els.length) return;
  const ids = els.map((e) => e.id), snap = snapshot(ids);
  const b = els.length === 1 ? { x: els[0].x, y: els[0].y, w: els[0].w, h: els[0].h } : unionBox(els.map(elBox));
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const a0 = (Math.atan2(w.y - c.y, w.x - c.x) * 180) / Math.PI;
  const origin = new Map(ids.map((id) => [id, clone(S.els.get(id))]));
  Drag = {
    move(ev, p) {
      let d = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI - a0;
      if (ev.shiftKey) d = Math.round(d / 15) * 15;
      else if (els.length === 1) {
        const r = origin.get(ids[0]).r + d, n = Math.round(r / 90) * 90;
        if (Math.abs(r - n) < 2) d = n - origin.get(ids[0]).r;
      }
      for (const id of ids) {
        const e = S.els.get(id), o = origin.get(id);
        const oc = centerOf(o), [rx, ry] = rotV([oc.x - c.x, oc.y - c.y], d);
        e.x = c.x + rx - e.w / 2; e.y = c.y + ry - e.h / 2;
        e.r = round2((((o.r || 0) + d) % 360 + 360) % 360);
        placeEl(e);
        invalidateDeps(id);
      }
      touchOverlay();
      Presence.sendLive(ids);
    },
    up() { commitFrom(snap); },
  };
}

function dragLineEnd(el, which, p, ev) {
  const target = ev.metaKey || ev.ctrlKey ? null : elementAt(p, el.id);
  const other = which === 'a' ? el.b : el.a;
  if (target && other.id !== target.id) {
    const near = nearestSide(target, p);
    el[which] = { id: target.id, side: near.near ? near.s : 'auto' };
    S.anchorHint = { id: target.id, side: near.near ? near.s : null };
  } else {
    el[which] = { x: p.x, y: p.y };
    S.anchorHint = null;
  }
  drawEl(el);
  touchOverlay();
}
function startLineEnd(w, which) {
  const el = selEls()[0];
  if (!el) return;
  const snap = snapshot([el.id]);
  Drag = {
    move(ev, p) { dragLineEnd(el, which, p, ev); },
    up() { S.anchorHint = null; commitFrom(snap); },
  };
}
function startLineTool(w) {
  const tgt = elementAt(w, null);
  const el = newEl('line', { route: S.lineRoute, a: tgt ? { id: tgt.id, side: 'auto' } : { x: w.x, y: w.y }, b: { x: w.x, y: w.y }, z: maxZ() + 1 });
  S.els.set(el.id, el);
  drawEl(el);
  Drag = {
    move(ev, p) { dragLineEnd(el, 'b', p, ev); },
    up() {
      S.anchorHint = null;
      const g = lineGeom(el);
      if (Math.hypot(g.a.x - g.b.x, g.a.y - g.b.y) < 10) { S.els.delete(el.id); invalidate(el.id); return; }
      commitFrom(new Map([[el.id, null]]));
      S.tool = 'select'; stage.dataset.tool = 'select'; renderRail();
      setSel([el.id]);
    },
  };
}

function startQuickConnect(e, w, id, side) {
  const src = S.els.get(id);
  if (!src) return;
  const a0 = anchor(src, side);
  const el = newEl('line', { route: S.lineRoute === 'straight' ? 'curve' : S.lineRoute, a: { id, side }, b: { x: a0.x, y: a0.y }, z: maxZ() + 1 });
  S.els.set(el.id, el);
  let moved = false;
  Drag = {
    move(ev, p) {
      if (!moved && Math.hypot(p.x - w.x, p.y - w.y) * S.cam.z < 5) return;
      moved = true;
      dragLineEnd(el, 'b', p, ev);
    },
    up(ev, p) {
      S.anchorHint = null;
      if (el.b.id) { commitFrom(new Map([[el.id, null]])); setSel([el.id]); return; }
      const n = connectedClone(src, side, moved ? p : null);
      n.z = maxZ() + 1;
      S.els.set(n.id, n);
      el.b = { id: n.id, side: moved ? nearestApproach(n, src) : OPP[side] };
      commitFrom(new Map([[el.id, null], [n.id, null]]));
      setSel([n.id]);
      startEdit(n.id);
    },
  };
}
function nearestApproach(n, src) { return autoSide(n, centerOf(src)); }
function connectedClone(src, side, pt) {
  const useClone = src.type === 'shape' || src.type === 'sticky';
  const c = useClone ? clone(src) : newEl('shape', { w: 190, h: 110 });
  c.id = uid();
  delete c.z; delete c.group; delete c.votes; delete c.v; delete c.by;
  c.text = ''; c.locked = false; c.r = 0;
  if (pt) { c.x = pt.x - c.w / 2; c.y = pt.y - c.h / 2; return c; }
  const [nx, ny] = SIDE[side], gap = 110;
  c.x = src.x + src.w / 2 - c.w / 2 + nx * (src.w / 2 + c.w / 2 + gap);
  c.y = src.y + src.h / 2 - c.h / 2 + ny * (src.h / 2 + c.h / 2 + gap);
  let guard = 0;
  while (guard++ < 30 && allEls().some((o) => o.type !== 'line' && o.type !== 'frame' && boxesOverlap(elBox(o), { x: c.x, y: c.y, w: c.w, h: c.h }))) {
    if (nx) c.y += c.h + 24; else c.x += c.w + 24;
  }
  return c;
}

function startDraw(w) {
  const cfg = S.tool === 'marker' ? S.marker : S.pen;
  const pen = S.tool, pts = [round2(w.x), round2(w.y)];
  const stroke = paintCSS(cfg.stroke.t === 'solid' ? cfg.stroke : solid(cfg.stroke.s[0].c));
  const path = sv('path', { fill: 'none', stroke, 'stroke-width': cfg.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const node = sv('svg', { width: 1, height: 1, style: 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none' }, path);
  wEls.append(node);
  let lx = w.x, ly = w.y;
  Drag = {
    refresh: false,
    move(ev) {
      for (const c of ev.getCoalescedEvents?.() || [ev]) {
        const q = screenToWorld(c.clientX, c.clientY);
        if (Math.hypot(q.x - lx, q.y - ly) * S.cam.z < 1.6) continue;
        pts.push(round2(q.x), round2(q.y)); lx = q.x; ly = q.y;
      }
      path.setAttribute('d', strokePath(pts, 1, 1));
    },
    up() {
      node.remove();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
      const local = pts.map((v, i) => round2(v - (i % 2 ? y0 : x0)));
      const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
      addEls([newEl('draw', { x: x0, y: y0, w: W, h: H, ow: W, oh: H, pts: local, stroke: clone(cfg.stroke), sw: cfg.sw, pen })], { select: false });
    },
  };
}

function startErase(e) {
  const hit = new Set();
  const test = (ev) => {
    const n = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.el.draw');
    if (n && !hit.has(n.dataset.id)) { hit.add(n.dataset.id); n.style.opacity = 0.15; }
  };
  test(e);
  Drag = { refresh: false, move: test, up() { if (hit.size) removeEls([...hit]); } };
}

function startCreate(w, type) {
  let last = null;
  Drag = {
    move(ev, p) {
      if (Math.hypot(p.x - w.x, p.y - w.y) * S.cam.z < 6) { S.preview = last = null; touchOverlay(); return; }
      let b = normBox(w, p);
      if (ev.shiftKey) { const m = Math.max(b.w, b.h); b = { x: p.x < w.x ? w.x - m : w.x, y: p.y < w.y ? w.y - m : w.y, w: m, h: m }; }
      S.preview = last = b;
      touchOverlay();
    },
    up() {
      S.preview = null;
      const el = newEl(type, type === 'shape' ? { kind: S.shapeKind } : {});
      if (last && last.w > 12 && last.h > 12) Object.assign(el, last);
      else { el.x = w.x - el.w / 2; el.y = w.y - el.h / 2; }
      if (type === 'frame') { el.z = -(allEls().filter((x) => x.type === 'frame').length + 1); el.name = `Marco ${allEls().filter((x) => x.type === 'frame').length + 1}`; }
      addEls([el], { select: false });
      S.tool = 'select'; stage.dataset.tool = 'select'; renderRail();
      setSel([el.id]);
      if (type === 'shape') startEdit(el.id);
    },
  };
}

function placeSticky(w) {
  const el = newEl('sticky', { fill: grad(S.stickyFill || 'Tungsteno') });
  el.x = w.x - el.w / 2; el.y = w.y - el.h / 2;
  addEls([el], { select: false });
  setTool('select'); setSel([el.id]); startEdit(el.id);
}
function placeText(w) {
  const el = newEl('text', { x: w.x, y: w.y - 16 });
  addEls([el], { select: false });
  setTool('select'); setSel([el.id]); startEdit(el.id);
}
async function placeLink(w) {
  setTool('select');
  const url = await askText({ title: 'Añadir enlace', placeholder: 'https://', ok: 'Añadir', id: 'link-url' });
  if (!url) return;
  addLink(url, w);
}
function addLink(url, w) {
  const u = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  let title = u;
  try { title = new URL(u).hostname.replace(/^www\./, ''); } catch {}
  const el = newEl('link', { url: u, title });
  el.x = w.x - el.w / 2; el.y = w.y - el.h / 2;
  addEls([el]);
}
function placeStamp(w) {
  const g = S.stampGlyph || '✓';
  const el = newEl('shape', { kind: 'ellipse', w: 56, h: 56, text: g, size: 22, fill: grad('Tungsteno'), stroke: solid('#d9bd94', 0.55), font: 'Geist' });
  el.x = w.x - 28; el.y = w.y - 28;
  addEls([el], { select: false });
}
function placeMindRoot(w) {
  const el = newEl('mind', { x: w.x - 80, y: w.y - 30, text: 'Idea central', size: 22, weight: 600, fill: grad('Grafito'), stroke: solid('#ffffff', 0.2), branch: '#d9bd94' });
  mindMeasure(el);
  el.x = w.x - el.w / 2; el.y = w.y - el.h / 2;
  addEls([el], { select: false });
  setTool('select'); setSel([el.id]); startEdit(el.id);
}

function mindAdd(parent, side) {
  const kids = mindKids().get(parent.id) || [];
  let s = side || parent.side || 'r';
  if (!parent.parent && !side) s = kids.filter((k) => k.side === 'r').length <= kids.filter((k) => k.side === 'l').length ? 'r' : 'l';
  const branch = parent.parent ? parent.branch : BRANCH_COLORS[kids.length % BRANCH_COLORS.length];
  const root = mindRootOf(parent);
  const tree = [root.id, ...mindDescendants(root.id)];
  const n = newEl('mind', { parent: parent.id, side: s, order: kids.reduce((m, k) => Math.max(m, k.order), -1) + 1, branch, text: '', x: parent.x + parent.w + 40, y: parent.y, z: maxZ() + 1 });
  const snap = snapshot(tree);
  snap.set(n.id, null);
  if (parent.collapsed) { parent.collapsed = false; mindDescendants(parent.id).forEach((d) => { S.els.get(d).hidden = false; }); }
  S.els.set(n.id, n);
  layoutMind(root.id);
  commitFrom(snap);
  setSel([n.id]);
  startEdit(n.id);
  return n;
}
function mindAddFromPlus(side) { const e = selEls()[0]; if (e?.type === 'mind') mindAdd(e, e.parent ? undefined : side); }
function mindSibling(e) {
  if (!e.parent) { mindAdd(e); return; }
  const p = S.els.get(e.parent);
  mindAdd(p, e.side);
}
function toggleFold(id) {
  const e = S.els.get(id);
  if (!e) return;
  const root = mindRootOf(e), tree = [root.id, ...mindDescendants(root.id)];
  const snap = snapshot(tree);
  e.collapsed = !e.collapsed;
  const kids = mindKids();
  const walk = (n, hide) => (kids.get(n.id) || []).forEach((k) => { k.hidden = hide; walk(k, hide || k.collapsed); });
  walk(e, e.collapsed);
  layoutMind(root.id);
  commitFrom(snap);
}

function toggleCheck(id, i) {
  mutate([id], (e) => { if (e.items[i]) e.items[i].d = !e.items[i].d; });
}
function castVote(id) {
  if (!id) return;
  const e = S.els.get(id);
  if (!e || e.type === 'line' || e.type === 'frame') return;
  mutate([id], (el) => {
    el.votes = { ...(el.votes || {}) };
    const me = S.me.name || S.me.sid;
    if (el.votes[me]) delete el.votes[me]; else el.votes[me] = 1;
  });
}

/* ---------- Edición de texto en el sitio ---------- */
const _plainOK = (() => { const d = document.createElement('div'); d.setAttribute('contenteditable', 'plaintext-only'); return d.contentEditable === 'plaintext-only'; })();

function startEdit(id, opt = {}) {
  const el = S.els.get(id);
  if (!el || el.locked) return;
  finishEdit();
  let n = NODES.get(id);
  if (!n) { drawEl(el); n = NODES.get(id); }
  if (!n) return;
  let t, snapIds = [id];
  S.editing = id;
  if (el.type === 'frame') t = n.querySelector('.fr-title');
  else if (el.type === 'line') { drawLineEl(el, n); t = n.querySelector('.ln-label .t'); }
  else if (el.type === 'table') { t = opt.cell || n.querySelector('.td'); }
  else if (el.type === 'check') {
    const list = n.querySelector('.chk-list');
    t = h('div', { class: 't chk-edit' }, el.items.map((i) => i.t).join('\n'));
    list.replaceWith(t);
  } else if (el.type === 'mind') {
    const root = mindRootOf(el); snapIds = [root.id, ...mindDescendants(root.id)];
    t = n.querySelector('.t');
  } else t = n.querySelector('.t');
  if (!t) { S.editing = null; return; }
  const snap = snapshot(snapIds);
  t.setAttribute('contenteditable', _plainOK ? 'plaintext-only' : 'true');
  t.setAttribute('spellcheck', 'false');
  n.classList.add('editing');
  t.focus();
  const r = document.createRange();
  r.selectNodeContents(t);
  if (opt.caretEnd) r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const sendLive = debounce(() => {
    if (S.editing !== id) return;
    pushOps([{ id, v: (el.v = ++S.clock), by: (el.by = S.me.sid), data: clone(el) }]);
  }, 320);
  const onInput = () => { writeBack(el, t); adjustEditing(el, n, t); sendLive(); };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); finishEdit(); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finishEdit(); return; }
    if (el.type === 'mind') {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(); const c = S.els.get(id); if (c) mindSibling(c); return; }
      if (e.key === 'Tab') { e.preventDefault(); finishEdit(); const c = S.els.get(id); if (c) mindAdd(c); return; }
    }
    if ((el.type === 'frame' || el.type === 'line') && e.key === 'Enter') { e.preventDefault(); finishEdit(); return; }
    if (el.type === 'table' && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
      e.preventDefault();
      const rr2 = +t.dataset.r, cc = +t.dataset.c, cols = el.cells[0].length, rows = el.cells.length;
      let nr = rr2, nc = cc;
      if (e.key === 'Tab') { nc += e.shiftKey ? -1 : 1; if (nc >= cols) { nc = 0; nr++; } if (nc < 0) { nc = cols - 1; nr--; } } else nr++;
      finishEdit();
      if (nr >= 0 && nr < rows) { invalidate(id); requestAnimationFrame(() => requestAnimationFrame(() => startEdit(id, { cell: NODES.get(id)?.querySelector(`.td[data-r="${nr}"][data-c="${nc}"]`) }))); }
    }
  };
  t.addEventListener('input', onInput);
  t.addEventListener('keydown', onKey);
  if (!_plainOK) t.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  S.editCtx = { id, t, n, snap, onInput, onKey, sendLive };
  touchOverlay();
}

function writeBack(el, t) {
  const v = t.innerText.replace(/\n$/, '');
  if (el.type === 'frame') el.name = v;
  else if (el.type === 'line') el.label = v;
  else if (el.type === 'table') el.cells[+t.dataset.r][+t.dataset.c] = v;
  else if (el.type === 'check') {
    const old = el.items;
    el.items = v.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => ({ t: x, d: !!old.find((o) => o.t === x)?.d }));
  } else el.text = v;
}

function adjustEditing(el, n, t) {
  if (el.type === 'text') {
    if (el.auto) { const m = textMetrics(el, 4000); el.w = Math.ceil(m.w) + 8; el.h = Math.ceil(m.h) + 2; }
    else el.h = Math.ceil(textMetrics(el, el.w).h) + 2;
    placeEl(el, n);
  } else if (el.type === 'sticky' && el.autofit) {
    t.style.fontSize = fitSize(el, el.w - 32, el.h - 32, 30) + 'px';
  } else if (el.type === 'mind') {
    layoutMind(mindRootOf(el).id);
    placeEl(el, n);
    n.querySelector('svg.sv')?.replaceWith(shapeLayer(el.parent ? { ...el, stroke: solid(el.branch, 0.5) } : el, rr(el.w, el.h, el.parent ? el.rad : Math.min(el.rad + 8, el.h / 2))));
  }
  touchOverlay();
}

function finishEdit() {
  const c = S.editCtx;
  if (!c) return;
  S.editCtx = null;
  c.sendLive.cancel();
  c.t.removeEventListener('input', c.onInput);
  c.t.removeEventListener('keydown', c.onKey);
  const el = S.els.get(c.id);
  if (el) writeBack(el, c.t);
  c.t.removeAttribute('contenteditable');
  c.n?.classList.remove('editing');
  getSelection()?.removeAllRanges();
  S.editing = null;
  if (el) {
    if (el.type === 'text' && !el.text.trim()) { S.els.delete(el.id); S.sel.delete(el.id); }
    else if (el.type === 'mind') layoutMind(mindRootOf(el).id);
    commitFrom(c.snap);
    invalidate(c.id);
  }
  orderDirty = true;
  selChanged();
}

/* ---------- Recorte de fotos ---------- */
function startCrop(id) {
  const e = S.els.get(id);
  if (!e || e.type !== 'image' || e.locked) return;
  if (e.fit === 'stretch') { toast('El recorte funciona con el modo Rellenar'); return; }
  const snap = snapshot([id]);
  S.crop = { id, snap, r: e.r || 0 };
  e.r = 0;
  setSel([id]);
  drawEl(e);
  touchOverlay();
  toast('Arrastra la foto para encuadrar. Enter para terminar.');
}
function finishCrop() {
  const c = S.crop;
  if (!c) return;
  S.crop = null;
  const e = S.els.get(c.id);
  if (e) { e.r = c.r; drawEl(e); }
  commitFrom(c.snap);
  touchOverlay();
  renderInspectorSoon();
}
function startCropPan(w) {
  const el = S.els.get(S.crop.id), L = imageLayout(el);
  const fx0 = (el.w / 2 - L.left) / L.dw, fy0 = (el.h / 2 - L.top) / L.dh;
  Drag = {
    move(ev, p) {
      el.fcx = clamp(fx0 - (p.x - w.x) / L.dw, el.w / 2 / L.dw, 1 - el.w / 2 / L.dw);
      el.fcy = clamp(fy0 - (p.y - w.y) / L.dh, el.h / 2 / L.dh, 1 - el.h / 2 / L.dh);
      drawEl(el);
    },
  };
}
function startCropResize(hd) {
  const el = S.els.get(S.crop.id), L = imageLayout(el);
  const img = { x: el.x + L.left, y: el.y + L.top, w: L.dw, h: L.dh };
  const o = { x0: el.x, y0: el.y, x1: el.x + el.w, y1: el.y + el.h };
  Drag = {
    move(ev, p) {
      let { x0, y0, x1, y1 } = o;
      if (hd.includes('w')) x0 = clamp(p.x, img.x, x1 - 24);
      if (hd.includes('e')) x1 = clamp(p.x, x0 + 24, img.x + img.w);
      if (hd.includes('n')) y0 = clamp(p.y, img.y, y1 - 24);
      if (hd.includes('s')) y1 = clamp(p.y, y0 + 24, img.y + img.h);
      el.x = x0; el.y = y0; el.w = x1 - x0; el.h = y1 - y0;
      el.zoom = img.w / (el.nw * Math.max(el.w / el.nw, el.h / el.nh));
      el.fcx = (el.x + el.w / 2 - img.x) / img.w;
      el.fcy = (el.y + el.h / 2 - img.y) / img.h;
      drawEl(el);
      touchOverlay();
    },
  };
}

function onDbl(e) {
  if (S.tool !== 'select' || S.crop) return;
  const id = hitId(e);
  if (!id) { const w = eventWorld(e); if (e.target.closest('#stage') && !e.target.closest('.hd')) placeText(w); return; }
  const el = S.els.get(id);
  if (!el) return;
  if (el.group && S.enterGroup !== el.group) { S.enterGroup = el.group; setSel([id]); return; }
  if (el.type === 'image') { startCrop(id); return; }
  if (el.type === 'draw') return;
  if (el.type === 'link') { startInspectorFocus('link-url'); return; }
  const cell = e.target.closest('.td');
  startEdit(id, { cell, caretEnd: !!el.text });
}

function nudge(dx, dy) {
  const ids = [...movingSet()];
  if (!ids.length) return;
  mutate(ids, (e) => {
    if (e.type === 'line') { if (!e.a.id) e.a = { x: e.a.x + dx, y: e.a.y + dy }; if (!e.b.id) e.b = { x: e.b.x + dx, y: e.b.y + dy }; }
    else { e.x += dx; e.y += dy; }
  }, { key: 'nudge' });
}

const TOOL_KEYS = { v: 'select', h: 'hand', n: 'sticky', t: 'text', s: 'shape', r: 'shape', l: 'line', p: 'pen', e: 'eraser', f: 'frame', m: 'mind', i: 'image', c: 'comment', b: 'marker' };

function onKeyDown(e) {
  if (!S.boardId || !$('#editor') || $('#editor').hidden) return;
  if (document.querySelector('.modal-wrap')) return;
  if (Present.on) { Present.key(e); return; }
  if (isTyping(e.target)) return;
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; stage.classList.add('space'); } e.preventDefault(); return; }
  if (mod) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (k === 'y') { e.preventDefault(); redo(); return; }
    if (k === 'a') { e.preventDefault(); setSel(allEls().filter((x) => !x.locked && !x.hidden && x.type !== 'comment').map((x) => x.id)); return; }
    if (k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
    if (k === 'l') { e.preventDefault(); toggleLock(); return; }
    if (k === 'k') { e.preventDefault(); openPalette(); return; }
    if (k === 'c' && S.sel.size) { copyInternal(); return; }
    if (k === 'x' && S.sel.size) { copyInternal(); setTimeout(() => { if (S.sel.size) deleteSel(); }, 30); return; }
    if (k === 'v') { _pasteSeen = false; setTimeout(() => { if (!_pasteSeen && S.clipboard) pasteData(S.clipboard, { offset: 32 }); }, 60); return; }
    if (k === ']') { e.preventDefault(); orderSel(e.shiftKey ? 'front' : 'up'); return; }
    if (k === '[') { e.preventDefault(); orderSel(e.shiftKey ? 'back' : 'down'); return; }
    if (k === '=' || k === '+') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1.2); return; }
    if (k === '-') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); return; }
    if (k === '0') { e.preventDefault(); animateCam({ ...S.cam, z: 1, x: innerWidth / 2 - viewCenterOf(S.cam).x, y: innerHeight / 2 - viewCenterOf(S.cam).y }, 300); return; }
    return;
  }
  if (S.crop) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finishCrop(); } return; }
  if (e.key === 'Escape') {
    closeMenus(); closeThread();
    if (S.tool !== 'select') setTool('select'); else { S.enterGroup = null; setSel([]); }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  const sel = selEls();
  if (e.key === 'Tab' && sel.length === 1 && sel[0].type === 'mind') { e.preventDefault(); mindAdd(sel[0]); return; }
  if (e.key === 'Enter' && sel.length === 1) {
    e.preventDefault();
    if (sel[0].type === 'mind' && !e.shiftKey) { mindSibling(sel[0]); return; }
    if (sel[0].type === 'image') { startCrop(sel[0].id); return; }
    startEdit(sel[0].id, { caretEnd: true });
    return;
  }
  if (e.key.startsWith('Arrow') && sel.length) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
    return;
  }
  if (e.shiftKey && e.code === 'Digit1') { fitAll(); return; }
  if (e.shiftKey && e.code === 'Digit2') { if (sel.length) flyTo(unionBox(sel.map(elBox))); return; }
  if (e.key === '?') { openHelp(); return; }
  if (e.key === '+' || e.key === '=') { zoomAt(innerWidth / 2, innerHeight / 2, 1.2); return; }
  if (e.key === '-') { zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); return; }
  if (e.shiftKey || e.altKey) return;
  const t = TOOL_KEYS[k];
  if (t) { if (t === 'shape' && k === 'r') S.shapeKind = 'rect'; setTool(t); }
}
let _pasteSeen = false;
function copyInternal() {
  S.clipboard = serializeIds([...movingSetAll()]);
  copyText('seebase:' + JSON.stringify(S.clipboard));
}
function onKeyUp(e) { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('space'); } }

function initTools() {
  stage.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dblclick', onDbl);
  stage.addEventListener('contextmenu', onContext);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  let gz = 1;
  stage.addEventListener('gesturestart', (e) => { e.preventDefault(); gz = 1; });
  stage.addEventListener('gesturechange', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.scale / gz); gz = e.scale; });
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault(); stage.classList.remove('dropping');
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) insertImages(files, eventWorld(e));
  });
  document.addEventListener('copy', (e) => {
    if (isTyping() || !S.boardId || !S.sel.size || $('#editor').hidden) return;
    e.clipboardData.setData('text/plain', 'seebase:' + JSON.stringify(serializeIds([...movingSetAll()])));
    e.preventDefault();
  });
  document.addEventListener('cut', (e) => {
    if (isTyping() || !S.boardId || !S.sel.size || $('#editor').hidden) return;
    e.clipboardData.setData('text/plain', 'seebase:' + JSON.stringify(serializeIds([...movingSetAll()])));
    e.preventDefault();
  });
  document.addEventListener('paste', onPaste);
}
function movingSetAll() {
  const lockedAware = new Set(S.sel);
  for (const id of movingSet()) lockedAware.add(id);
  return lockedAware;
}
