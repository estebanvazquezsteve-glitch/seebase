'use strict';
/* Arranque y navegación */
Cloud.seed = function (id, ops) { return this.req(`/boards/${id}/ops`, { method: 'POST', body: JSON.stringify({ ops }) }); };

let _routing = Promise.resolve();

async function leaveBoard() {
  if (!S.boardId) return;
  finishEdit();
  finishCrop();
  closeThread();
  closeMenus();
  flushOpsNow();
  Thumb.mark.cancel();
  await Thumb.run();
  Api.disconnect();
  S.boardId = null; S.board = null; S.follow = null;
  S.els = new Map(); S.sel = new Set(); S.peers.clear();
  clearWorld();
  ov.replaceChildren(); cursorsEl.replaceChildren();
  clearInterval(_timerLoop);
}

async function showHome() {
  await leaveBoard();
  $('#editor').hidden = true;
  $('#home').hidden = false;
  document.title = 'SeeBase';
  Scene.set(HOME_SCENE);
  Scene.cam(0, 0);
  await renderHome();
}

async function openBoard(id) {
  if (S.boardId === id) return;
  await leaveBoard();
  let res;
  try { res = await Api.loadBoard(id); }
  catch { toast('No encontramos ese tablero. Puede que lo hayan eliminado.'); location.hash = ''; return; }
  if (S.backend && !S.me.name) await askName();
  S.boardId = id; S.board = res.board; S.clock = res.clock || 0;
  S.els = new Map(res.elements.map((e) => [e.id, e]));
  S.tombs = new Map(); S.sel = new Set(); S.hist = []; S.fut = []; S.peers.clear();
  S.tool = 'select'; S.hover = null; S.thread = null; S.enterGroup = null;
  document.title = `${S.board.name} · SeeBase`;
  $('#home').hidden = true;
  $('#editor').hidden = false;
  animateNew = false;
  clearWorld();
  renderChrome();
  Api.connect(id);
  if (!getMeta()) {
    S.els.set('_meta', { id: '_meta', type: '_meta', scene: { id: 'noir', i: 1.1, g: 0.5, v: 0.75, m: 0.5 }, grid: { mode: 'dots', snap: false }, timer: null, name: S.board.name });
    commitFrom(new Map([['_meta', null]]), { history: false });
  }
  relayoutMinds();
  drawAll();
  const saved = LS.get('cam.' + id, null);
  if (saved) S.cam = saved;
  else {
    const list = allEls().filter((e) => !e.hidden).map(elBox);
    S.cam = list.length ? camForBox(unionBox(list), { maxZ: 1 }) : { x: innerWidth / 2, y: innerHeight / 2, z: 1 };
  }
  applyCam();
  stage.dataset.tool = 'select';
  renderRail();
  renderInspector();
  renderSide();
  if (S.pendingTemplate) {
    const t = S.pendingTemplate;
    S.pendingTemplate = null;
    insertTemplate(t);
  }
  setTimeout(() => { animateNew = true; }, 400);
  if (!S.board.thumb) setTimeout(() => { Thumb.dirty = true; Thumb.run(); }, 1800);
}

function relayoutMinds() {
  const roots = allEls().filter((e) => e.type === 'mind' && !e.parent);
  if (!roots.length) return;
  const ids = allEls().filter((e) => e.type === 'mind').map((e) => e.id);
  const snap = snapshot(ids);
  roots.forEach((r) => layoutMind(r.id));
  commitFrom(snap, { history: false });
}

function route() {
  const m = location.hash.match(/^#b-([a-z0-9]+)$/);
  _routing = _routing.then(() => (m ? openBoard(m[1]) : showHome())).catch((e) => console.error(e));
}

(async function boot() {
  initGrain();
  loadProfile();
  await Promise.race([Promise.all(['400 16px Geist', '500 16px Geist', '600 16px Geist', '500 24px Cormorant'].map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, 1200))]);
  await DB.open();
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const j = await r.json();
      if (j.app === 'seebase') S.backend = j;
    }
  } catch {}
  if (S.backend) {
    Api = Cloud;
    if (S.backend.protected && !S.backend.authed) {
      $('#intro').classList.add('gone');
      await showGate();
    }
  }
  initTools();
  if (innerWidth < 760) $('#insp').classList.add('closed');
  $('#filepick').addEventListener('change', function () {
    const files = [...this.files];
    this.value = '';
    if (files.length) insertImages(files);
  });
  $('#jsonpick').addEventListener('change', function () {
    const f = this.files[0];
    this.value = '';
    if (f) importJSON(f);
  });
  const mm = $('#minimap');
  const jump = (e) => {
    const m = mm._map; if (!m) return;
    const r = mm.getBoundingClientRect();
    const wx = (e.clientX - r.left - m.ox) / m.k, wy = (e.clientY - r.top - m.oy) / m.k;
    const a = viewArea();
    S.cam.x = a.x + a.w / 2 - wx * S.cam.z;
    S.cam.y = a.y + a.h / 2 - wy * S.cam.z;
    stopCamAnim(); applyCam();
  };
  mm.addEventListener('pointerdown', (e) => { mm.setPointerCapture(e.pointerId); jump(e); mm.onpointermove = jump; mm.onpointerup = () => { mm.onpointermove = null; }; });
  $('#pr-prev').addEventListener('click', () => Present.go(-1));
  $('#pr-next').addEventListener('click', () => Present.go(1));
  $('#pr-exit').addEventListener('click', () => Present.stop());
  addEventListener('resize', () => { if (S.boardId) { touchOverlay(); minimapDirty = true; schedule(); } });
  addEventListener('beforeunload', () => flushOpsNow());
  document.fonts?.ready.then(() => { if (S.boardId) { relayoutMinds(); for (const e of S.els.values()) if (['sticky', 'text'].includes(e.type)) invalidate(e.id); } });

  let boards = [];
  try { boards = await Api.listBoards(); } catch {}
  if (!boards.length && !location.hash.startsWith('#b-') && !LS.get('seeded', false)) {
    try {
      LS.set('seeded', true);
      const b = await seedDemo();
      location.hash = 'b-' + b.id;
    } catch (e) { console.error(e); }
  }
  route();
  addEventListener('hashchange', route);
  $('#intro').classList.add('gone');
})();
