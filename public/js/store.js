'use strict';
/* Estado, historial, persistencia local y sincronización */
const USER_COLORS = ['#d9bd94', '#8fb3a9', '#a3a6d6', '#d19a8a', '#9fbf8a', '#c7a3c9', '#86a9c9', '#d6c27a'];

const S = {
  boardId: null, board: null,
  els: new Map(), tombs: new Map(), sel: new Set(),
  cam: { x: 0, y: 0, z: 1 },
  tool: 'select', shapeKind: 'rect', lineRoute: 'curve',
  pen: { stroke: solid('#ece8e1'), sw: 3 }, marker: { stroke: solid('#d9bd94', 0.45), sw: 18 },
  hover: null, editing: null, crop: null, enterGroup: null,
  peers: new Map(), follow: null,
  hist: [], fut: [], clock: 0,
  guides: [], marquee: null, preview: null, anchorHint: null,
  me: null, backend: null, clipboard: null, styleClip: null,
};

function loadProfile() {
  const p = LS.get('profile', null) || {};
  S.me = { sid: uid(10), name: p.name || '', color: p.color || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)] };
}
function saveProfile() { LS.set('profile', { name: S.me.name, color: S.me.color }); }

function newEl(type, p = {}) {
  const ivory = solid('#ece8e1');
  const textBase = { text: '', font: 'Geist', weight: 500, color: ivory, align: 'center', valign: 'middle' };
  const D = {
    shape: { kind: 'rect', w: 190, h: 120, rad: 14, fill: grad('Grafito'), stroke: solid('#ffffff', 0.16), sw: 1, dash: 'solid', size: 16, ...textBase },
    sticky: { w: 190, h: 190, rad: 5, fill: grad('Tungsteno'), stroke: solid('#ffffff', 0.08), sw: 1, dash: 'solid', size: 20, autofit: true, ...textBase, align: 'left', valign: 'top' },
    text: { w: 260, h: 36, auto: true, size: 26, fill: NONE, ...textBase, align: 'left', valign: 'top' },
    image: { w: 360, h: 240, asset: null, ab: null, nw: 360, nh: 240, mask: 'rect', rad: 12, zoom: 1, fcx: 0.5, fcy: 0.5, fit: 'cover', flipH: false, flipV: false, fx: {}, ov: null, stroke: solid('#ffffff', 0.18), sw: 0, dash: 'solid' },
    frame: { w: 720, h: 420, name: 'Marco', rad: 12, fill: clone(FRAME_FILL), stroke: solid('#ffffff', 0.12), sw: 1, dash: 'solid' },
    line: { a: { x: 0, y: 0 }, b: { x: 160, y: 0 }, route: S.lineRoute, stroke: solid('#b9b5ac'), sw: 2, dash: 'solid', capA: 'none', capB: 'arrow', label: '', flow: false, w: 0, h: 0 },
    draw: { pts: [], ow: 1, oh: 1, stroke: solid('#ece8e1'), sw: 3, pen: 'pen' },
    mind: { w: 120, h: 40, parent: null, side: 'r', order: 0, collapsed: false, size: 16, branch: '#d9bd94', rad: 14, fill: NONE, stroke: solid('#ffffff', 0.14), sw: 1, ...textBase, align: 'left' },
    table: { w: 520, h: 220, header: true, cells: [['Columna', 'Columna', 'Columna'], ['', '', ''], ['', '', ''], ['', '', '']], fill: grad('Ónix'), stroke: solid('#ffffff', 0.12), size: 14, font: 'Geist', weight: 400, color: ivory },
    check: { w: 300, h: 220, title: 'Tareas', items: [{ t: 'Primera tarea', d: false }, { t: 'Segunda tarea', d: false }, { t: 'Tercera tarea', d: false }], fill: grad('Ónix'), stroke: solid('#ffffff', 0.12), sw: 1, rad: 12, size: 15, font: 'Geist', weight: 400, color: ivory },
    link: { w: 340, h: 92, url: '', title: 'Enlace', fill: grad('Grafito'), stroke: solid('#ffffff', 0.14), sw: 1, rad: 12 },
    comment: { w: 0, h: 0, thread: [], resolved: false },
  };
  return { id: uid(), type, x: 0, y: 0, r: 0, opa: 1, ...clone(D[type] || {}), ...p };
}

const maxZ = () => { let m = 0; for (const e of S.els.values()) m = Math.max(m, e.z || 0); return m; };
const getMeta = () => S.els.get('_meta');
const allEls = () => [...S.els.values()].filter((e) => e.type[0] !== '_');

function snapshot(ids) {
  const m = new Map();
  for (const id of ids) { const e = S.els.get(id); m.set(id, e ? clone(e) : null); }
  return m;
}
const _sig = (e) => (e ? JSON.stringify({ ...e, v: 0, by: '' }) : 'null');

function commitFrom(snap, { key = null, history = true } = {}) {
  const before = new Map(), after = new Map(), ops = [];
  for (const [id, old] of snap) {
    const cur = S.els.get(id) || null;
    if (_sig(old) === _sig(cur)) continue;
    if (cur) {
      cur.v = ++S.clock; cur.by = S.me.sid;
      ops.push({ id, v: cur.v, by: cur.by, data: clone(cur) });
      S.tombs.delete(id);
    } else {
      const v = ++S.clock;
      S.tombs.set(id, [v, S.me.sid]);
      ops.push({ id, v, by: S.me.sid, data: null });
    }
    before.set(id, old); after.set(id, cur ? clone(cur) : null);
    invalidate(id);
  }
  if (!ops.length) return false;
  pushOps(ops);
  if (history) pushHist(before, after, key);
  afterChange();
  return true;
}

function pushHist(before, after, key) {
  const now = Date.now(), last = S.hist[S.hist.length - 1];
  const same = key && last && last.key === key && now - last.t < 900 && last.after.size === after.size && [...after.keys()].every((k) => last.after.has(k));
  if (same) { last.after = after; last.t = now; }
  else { S.hist.push({ before, after, key, t: now }); if (S.hist.length > 240) S.hist.shift(); }
  S.fut.length = 0;
  updateUndoUI();
}

function applySnap(map) {
  const snap = snapshot(map.keys());
  for (const [id, val] of map) {
    if (val) S.els.set(id, clone(val));
    else { S.els.delete(id); S.sel.delete(id); }
    invalidate(id);
  }
  commitFrom(snap, { history: false });
}
function undo() {
  const it = S.hist.pop(); if (!it) return;
  S.fut.push(it); applySnap(it.before); selChanged(); updateUndoUI();
}
function redo() {
  const it = S.fut.pop(); if (!it) return;
  S.hist.push(it); applySnap(it.after); selChanged(); updateUndoUI();
}

function mutate(ids, fn, opts) {
  const list = [...ids];
  const snap = snapshot(list);
  for (const id of list) { const e = S.els.get(id); if (e) { fn(e); invalidate(id); } }
  commitFrom(snap, opts);
}

function addEls(list, { select = true } = {}) {
  const snap = new Map();
  let z = maxZ();
  for (const e of list) { snap.set(e.id, null); if (e.z == null) e.z = ++z; S.els.set(e.id, e); invalidate(e.id); }
  commitFrom(snap);
  if (select) setSel(list.map((e) => e.id));
}

function removeEls(ids) {
  const set = new Set(ids);
  for (const id of ids) {
    const e = S.els.get(id);
    if (e?.type === 'mind') mindDescendants(id).forEach((d) => set.add(d));
  }
  const roots = new Set();
  for (const id of set) { const e = S.els.get(id); if (e?.type === 'mind' && e.parent && !set.has(e.parent)) roots.add(mindRootOf(e).id); }
  const lines = allEls().filter((e) => e.type === 'line' && !set.has(e.id) && ((e.a.id && set.has(e.a.id)) || (e.b.id && set.has(e.b.id))));
  const tree = [...roots].flatMap((r) => [r, ...mindDescendants(r)]);
  const snap = snapshot([...set, ...lines.map((l) => l.id), ...tree]);
  for (const l of lines) {
    const g = lineGeom(l);
    if (l.a.id && set.has(l.a.id)) l.a = { x: g.a.x, y: g.a.y };
    if (l.b.id && set.has(l.b.id)) l.b = { x: g.b.x, y: g.b.y };
    invalidate(l.id);
  }
  for (const id of set) { S.els.delete(id); S.sel.delete(id); invalidate(id); }
  roots.forEach((r) => layoutMind(r));
  commitFrom(snap);
  selChanged();
}

function setSel(ids) {
  S.sel = new Set(ids);
  selChanged();
}
function selEls() { return [...S.sel].map((id) => S.els.get(id)).filter(Boolean); }

const _sendSel = throttle(() => Api.eph({ t: 'sel', ids: [...S.sel].slice(0, 60) }), 120);
function selChanged() {
  for (const [id, n] of NODES) n.classList.toggle('selected', S.sel.has(id));
  touchOverlay();
  renderInspector();
  _sendSel();
}

let _changeHooks = [];
function afterChange() { _changeHooks.forEach((f) => f()); }

/* ---------- Almacén local (IndexedDB con reserva en memoria) ---------- */
const DB = {
  db: null,
  mem: { boards: new Map(), els: new Map(), assets: new Map() },
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('seebase', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          d.createObjectStore('boards', { keyPath: 'id' });
          d.createObjectStore('els', { keyPath: ['b', 'id'] });
          d.createObjectStore('assets', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch { this.db = null; }
  },
  _key(store, v) { return store === 'els' ? v.b + '/' + v.id : v.id; },
  _tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), out = fn(t.objectStore(store));
      t.oncomplete = () => res(out?.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  get(store, key) {
    if (!this.db) return Promise.resolve(this.mem[store].get(key));
    return this._tx(store, 'readonly', (s) => s.get(key));
  },
  put(store, v) {
    if (!this.db) { this.mem[store].set(this._key(store, v), v); return Promise.resolve(); }
    return this._tx(store, 'readwrite', (s) => s.put(v));
  },
  del(store, key) {
    if (!this.db) { this.mem[store].delete(Array.isArray(key) ? key.join('/') : key); return Promise.resolve(); }
    return this._tx(store, 'readwrite', (s) => s.delete(key));
  },
  all(store) {
    if (!this.db) return Promise.resolve([...this.mem[store].values()]);
    return this._tx(store, 'readonly', (s) => s.getAll());
  },
  els(b) {
    if (!this.db) return Promise.resolve([...this.mem.els.values()].filter((r) => r.b === b));
    return this._tx('els', 'readonly', (s) => s.getAll(IDBKeyRange.bound([b, ''], [b, '￿'])));
  },
  writeEls(b, ops) {
    if (!this.db) {
      for (const o of ops) { if (o.data) this.mem.els.set(b + '/' + o.id, { b, id: o.id, data: o.data }); else this.mem.els.delete(b + '/' + o.id); }
      return Promise.resolve();
    }
    return this._tx('els', 'readwrite', (s) => { for (const o of ops) { if (o.data) s.put({ b, id: o.id, data: o.data }); else s.delete([b, o.id]); } });
  },
};

const Assets = {
  urls: new Map(), pending: new Set(),
  url(el) {
    if (!el.asset) return null;
    if (Api === Cloud) return `/api/boards/${el.ab}/assets/${el.asset}`;
    const u = this.urls.get(el.asset);
    if (u) return u;
    if (!this.pending.has(el.asset)) {
      const k = el.asset;
      this.pending.add(k);
      DB.get('assets', k).then((r) => {
        if (!r) return;
        this.urls.set(k, URL.createObjectURL(r.blob));
        allEls().filter((e) => e.asset === k).forEach((e) => invalidate(e.id));
      });
    }
    return null;
  },
};

const Local = {
  async listBoards() { return (await DB.all('boards')).sort((a, b) => b.updated - a.updated); },
  async createBoard(b) {
    const now = Date.now();
    const rec = { id: b.id || uid(14), name: b.name || 'Tablero sin título', thumb: null, owner: b.owner || '', created: now, updated: now };
    await DB.put('boards', rec);
    return rec;
  },
  async updateBoard(id, p) {
    const b = await DB.get('boards', id);
    if (!b) return null;
    Object.assign(b, p, { updated: Date.now() });
    await DB.put('boards', b);
    return b;
  },
  async deleteBoard(id) {
    const rows = await DB.els(id);
    await DB.writeEls(id, rows.map((r) => ({ id: r.id, data: null })));
    await DB.del('boards', id);
  },
  async loadBoard(id) {
    const board = await DB.get('boards', id);
    if (!board) throw new Error('not_found');
    const rows = await DB.els(id);
    const elements = rows.map((r) => r.data);
    return { board, elements, clock: elements.reduce((m, e) => Math.max(m, e.v || 0), 0) };
  },
  saveOps(b, ops) { DB.writeEls(b, ops); },
  async putAsset(_b, blob) {
    const id = uid(14);
    await DB.put('assets', { id, blob });
    Assets.urls.set(id, URL.createObjectURL(blob));
    return id;
  },
  connect() { setConn('local'); },
  disconnect() {},
  eph() {},
};

const Cloud = {
  ws: null, board: null, retry: 0, n: 0, pending: new Map(), ping: null, closing: false,
  async req(path, opt = {}) {
    const r = await fetch('/api' + path, { headers: { 'content-type': 'application/json' }, ...opt });
    if (!r.ok) { const e = new Error('http_' + r.status); e.status = r.status; throw e; }
    return r.json();
  },
  async listBoards() { return (await this.req('/boards')).boards; },
  createBoard(b) { return this.req('/boards', { method: 'POST', body: JSON.stringify(b) }); },
  updateBoard(id, p) { return this.req('/boards/' + id, { method: 'PATCH', body: JSON.stringify(p) }); },
  deleteBoard(id) { return this.req('/boards/' + id, { method: 'DELETE' }); },
  loadBoard(id) { return this.req('/boards/' + id); },
  async putAsset(b, blob) {
    const r = await fetch(`/api/boards/${b}/assets`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
    if (!r.ok) throw new Error('upload_' + r.status);
    return (await r.json()).id;
  },
  saveOps(_b, ops) {
    const n = ++this.n;
    this.pending.set(n, ops);
    this._send({ t: 'ops', n, ops });
  },
  _send(m) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; },
  eph(m) { this._send(m); },
  connect(board) {
    this.board = board; this.closing = false; this.pending.clear(); this.retry = 0;
    this._open(false);
  },
  disconnect() {
    this.closing = true; this.board = null;
    clearInterval(this.ping);
    try { this.ws?.close(1000); } catch {}
    this.ws = null;
  },
  _open(isRetry) {
    const q = new URLSearchParams({ sid: S.me.sid, name: S.me.name || 'Invitado', color: S.me.color });
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/boards/${this.board}/ws?${q}`);
    this.ws = ws;
    setConn(isRetry ? 'retry' : 'connecting');
    ws.onopen = async () => {
      this.retry = 0;
      setConn('online');
      clearInterval(this.ping);
      this.ping = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
      if (isRetry) await this._resync();
      for (const [n, ops] of this.pending) this._send({ t: 'ops', n, ops });
      Presence.announce();
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      this._on(m);
    };
    ws.onclose = (e) => {
      clearInterval(this.ping);
      S.peers.clear(); renderPeers(); touchOverlay();
      if (this.closing || !this.board) return;
      if (e.code === 4004) { toast('Este tablero ya no existe'); location.hash = ''; return; }
      setConn('retry');
      const wait = Math.min(12000, 600 * 2 ** this.retry++);
      setTimeout(() => { if (!this.closing && this.board) this._open(true); }, wait);
    };
  },
  async _resync() {
    try {
      const res = await this.loadBoard(this.board);
      const seen = new Set(res.elements.map((e) => e.id));
      const queued = new Set([...this.pending.values()].flat().map((o) => o.id));
      applyRemote(res.elements.map((e) => ({ id: e.id, v: e.v, by: e.by, data: e })));
      for (const e of [...S.els.values()]) {
        if (!seen.has(e.id) && !queued.has(e.id)) { S.els.delete(e.id); S.sel.delete(e.id); invalidate(e.id); }
      }
      selChanged();
    } catch {}
  },
  _on(m) {
    switch (m.t) {
      case 'hello': S.peers.clear(); m.peers.forEach((p) => S.peers.set(p.sid, { ...p })); renderPeers(); break;
      case 'join': if (m.peer.sid !== S.me.sid) { S.peers.set(m.peer.sid, { ...m.peer }); renderPeers(); Presence.announce(); } break;
      case 'leave': S.peers.delete(m.sid); if (S.follow === m.sid) S.follow = null; renderPeers(); renderCursors(); touchOverlay(); break;
      case 'ack': this.pending.delete(m.n); break;
      case 'ops': applyRemote(m.ops); break;
      default: Presence.on(m);
    }
  },
};

let Api = Local;

function setConn(state) {
  S.conn = state;
  const d = $('#conn');
  if (!d) return;
  const labels = { local: 'Guardado en este navegador', connecting: 'Conectando', online: 'En línea', retry: 'Reconectando' };
  d.className = 'conn ' + state;
  d.title = labels[state] || '';
  d.setAttribute('aria-label', d.title);
}

/* Cola de operaciones: agrupa cambios seguidos del mismo elemento */
const _opQ = new Map();
const _flushOps = debounce(() => {
  if (!S.boardId || !_opQ.size) return;
  const ops = [..._opQ.values()];
  _opQ.clear();
  Api.saveOps(S.boardId, ops);
}, 90);
function flushOpsNow() { _flushOps.cancel(); if (S.boardId && _opQ.size) { const ops = [..._opQ.values()]; _opQ.clear(); Api.saveOps(S.boardId, ops); } }
function pushOps(ops) { for (const o of ops) _opQ.set(o.id, o); _flushOps(); }

function _newer(a, b) { return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]); }
function applyRemote(ops) {
  let selTouched = false;
  for (const o of ops) {
    S.clock = Math.max(S.clock, o.v);
    const cur = S.els.get(o.id);
    const curV = cur ? [cur.v || 0, cur.by || ''] : S.tombs.get(o.id) || [-1, ''];
    if (!_newer([o.v, o.by], curV)) continue;
    if (o.data) { S.els.set(o.id, o.data); S.tombs.delete(o.id); if (S.sel.has(o.id)) selTouched = true; }
    else { S.els.delete(o.id); S.tombs.set(o.id, [o.v, o.by]); if (S.sel.delete(o.id)) selTouched = true; }
    invalidate(o.id);
  }
  afterChange();
  if (selTouched && !Drag && !S.editing) { touchOverlay(); renderInspectorSoon(); }
}

const Presence = {
  on(m) {
    const p = S.peers.get(m.from);
    if (m.t === 'live') {
      for (const [id, x, y, w, H, r] of m.e) {
        const e = S.els.get(id); if (!e || (Drag && S.sel.has(id))) continue;
        e.x = x; e.y = y; e.w = w; e.h = H; e.r = r;
        invalidate(id);
      }
      return;
    }
    if (!p) return;
    if (m.t === 'cur') { p.x = m.x; p.y = m.y; renderCursors(); }
    else if (m.t === 'sel') { p.sel = m.ids; touchOverlay(); }
    else if (m.t === 'view') {
      p.view = m;
      if (S.follow === m.from) followTo(m);
    } else if (m.t === 'present' && m.on) {
      toast(`${p.name} empezó a presentar`, { ms: 7000, action: { label: 'Seguir', fn: () => startFollow(m.from) } });
    }
  },
  announce() {
    Api.eph({ t: 'sel', ids: [...S.sel].slice(0, 60) });
    Presence.sendView();
  },
  sendCursor: throttle((x, y) => Api.eph({ t: 'cur', x: round2(x), y: round2(y) }), 70),
  sendLive: throttle((ids) => {
    const e = [];
    for (const id of ids) { const el = S.els.get(id); if (el && el.type !== 'line') e.push([id, round2(el.x), round2(el.y), round2(el.w), round2(el.h), round2(el.r || 0)]); if (e.length >= 160) break; }
    if (e.length) Api.eph({ t: 'live', e });
  }, 50),
  sendView: throttle(() => {
    if (!S.boardId) return;
    const a = viewArea(), z = S.cam.z;
    Api.eph({ t: 'view', cx: round2((a.x + a.w / 2 - S.cam.x) / z), cy: round2((a.y + a.h / 2 - S.cam.y) / z), z: round2(z) });
  }, 220),
};

/* ---------- Mapas mentales: estructura y disposición ---------- */
function mindKids() {
  const k = new Map();
  for (const e of S.els.values()) {
    if (e.type === 'mind' && e.parent) { if (!k.has(e.parent)) k.set(e.parent, []); k.get(e.parent).push(e); }
  }
  for (const a of k.values()) a.sort((x, y) => x.order - y.order);
  return k;
}
function mindDescendants(id) {
  const k = mindKids(), out = [];
  const go = (i) => (k.get(i) || []).forEach((c) => { out.push(c.id); go(c.id); });
  go(id);
  return out;
}
function mindRootOf(e) {
  let c = e, guard = 0;
  while (c.parent && guard++ < 500) { const p = S.els.get(c.parent); if (!p) break; c = p; }
  return c;
}
function mindMeasure(e) {
  const isRoot = !e.parent;
  const px = isRoot ? 26 : 14, py = isRoot ? 16 : 9;
  const m = textMetrics(e, 300);
  e.w = Math.ceil(m.w) + px * 2 + 5;
  e.h = Math.ceil(m.h) + py * 2;
}
function layoutMind(rootId) {
  const root = S.els.get(rootId);
  if (!root) return;
  const kids = mindKids(), H = new Map(), GX = 72, GY = 14;
  const cx = root.x + root.w / 2, cy = root.y + root.h / 2;
  const size = (e) => {
    mindMeasure(e);
    let sum = 0;
    const ks = e.collapsed ? [] : kids.get(e.id) || [];
    ks.forEach((k, i) => { size(k); sum += H.get(k.id) + (i ? GY : 0); });
    H.set(e.id, Math.max(e.h, sum));
    (kids.get(e.id) || []).forEach((k) => { if (e.collapsed) size(k); });
  };
  size(root);
  root.x = cx - root.w / 2; root.y = cy - root.h / 2;
  invalidate(root.id);
  const stack = (e, ks, dir) => {
    const total = ks.reduce((s, k, i) => s + H.get(k.id) + (i ? GY : 0), 0);
    let y = e.y + e.h / 2 - total / 2;
    for (const k of ks) {
      const kh = H.get(k.id);
      k.y = y + kh / 2 - k.h / 2;
      k.x = dir > 0 ? e.x + e.w + GX : e.x - GX - k.w;
      invalidate(k.id);
      if (!k.collapsed) stack(k, kids.get(k.id) || [], dir);
      y += kh + GY;
    }
  };
  if (!root.collapsed) {
    const all = kids.get(root.id) || [];
    stack(root, all.filter((k) => k.side !== 'l'), 1);
    stack(root, all.filter((k) => k.side === 'l'), -1);
  }
}
