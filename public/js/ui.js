'use strict';
/* Barras, paneles, comentarios, presentación y portada */
const RAIL = [
  { t: 'select', i: 'select', n: 'Seleccionar', k: 'V' },
  { t: 'hand', i: 'hand', n: 'Mover lienzo', k: 'H' },
  '|',
  { t: 'sticky', i: 'sticky', n: 'Nota', k: 'N', fly: 'sticky' },
  { t: 'text', i: 'text', n: 'Texto', k: 'T' },
  { t: 'shape', i: 'shapes', n: 'Formas', k: 'S', fly: 'shape' },
  { t: 'line', i: 'line', n: 'Conector', k: 'L', fly: 'line' },
  { t: 'pen', i: 'pen', n: 'Dibujar', k: 'P', fly: 'pen', group: ['pen', 'marker', 'eraser'] },
  { t: 'mind', i: 'mind', n: 'Mapa mental', k: 'M' },
  { t: 'frame', i: 'frame', n: 'Marco', k: 'F' },
  { t: 'image', i: 'image', n: 'Foto', k: 'I' },
  { t: 'comment', i: 'comment', n: 'Comentario', k: 'C' },
  { fly: 'more', i: 'more', n: 'Más herramientas', group: ['table', 'check', 'link', 'vote', 'stamp'] },
  '|',
  { a: 'templates', i: 'layout', n: 'Plantillas' },
];

function renderRail() {
  const r = $('#rail');
  if (!r) return;
  r.replaceChildren(...RAIL.map((it) => {
    if (it === '|') return h('div', { class: 'sep' });
    const on = it.t === S.tool || it.group?.includes(S.tool);
    return h('button', {
      class: 'rb' + (on ? ' on' : ''), type: 'button', title: `${it.n}${it.k ? ` (${it.k})` : ''}`, 'aria-label': it.n, 'aria-pressed': String(!!on),
      onclick(ev) {
        ev.stopPropagation();
        const rect = this.getBoundingClientRect();
        if (it.a === 'templates') { openSide('templates'); return; }
        if (it.t && !it.fly) { closeMenus(); setTool(it.t); return; }
        const wasOpen = $('#flyout').dataset.kind === it.fly && !$('#flyout').hidden;
        if (it.t) setTool(it.group?.includes(S.tool) ? S.tool : it.t);
        if (wasOpen) closeMenus(); else openFlyout(it.fly, rect);
      },
    }, icon(it.i, 20), it.fly && h('i', { class: 'caret' }));
  }));
}

function closeMenus() {
  const f = $('#flyout');
  if (f) { f.hidden = true; f.dataset.kind = ''; }
  document.querySelector('.ctx')?.remove();
}

function openFlyout(kind, rect) {
  const f = $('#flyout');
  f.dataset.kind = kind;
  let body;
  if (kind === 'shape') {
    body = [h('h4', {}, 'Formas'), h('div', { class: 'mask-grid wide' }, SHAPE_ORDER.map((k) => h('button', { type: 'button', class: S.shapeKind === k ? 'on' : '', title: SHAPES[k].n, 'aria-label': SHAPES[k].n, onclick() { S.shapeKind = k; closeMenus(); setTool('shape'); } }, shapeThumb(k, 24))))];
  } else if (kind === 'line') {
    const opt = (v, ic, l) => h('button', { type: 'button', class: 'fly-row' + (S.lineRoute === v ? ' on' : ''), onclick() { S.lineRoute = v; closeMenus(); setTool('line'); } }, icon(ic, 18), l);
    body = [h('h4', {}, 'Conector'), opt('curve', 'routeC', 'Curva'), opt('straight', 'routeS', 'Recta'), opt('elbow', 'routeE', 'En ángulos'), h('p', { class: 'hint' }, 'También puedes arrastrar desde los puntos que aparecen alrededor de cualquier forma.')];
  } else if (kind === 'pen') {
    const cfg = S.tool === 'marker' ? S.marker : S.pen;
    body = [
      h('h4', {}, 'Dibujar'),
      seg([{ v: 'pen', i: 'pen', t: 'Pluma' }, { v: 'marker', i: 'marker', t: 'Marcador' }, { v: 'eraser', i: 'eraser', t: 'Borrador' }], S.tool, (v) => { setTool(v); const r = rect; openFlyout('pen', r); }),
      S.tool !== 'eraser' && h('div', { class: 'swatches' }, SWATCHES.map((c) => h('button', { type: 'button', style: { background: c }, 'aria-label': 'Color ' + c, onclick() { cfg.stroke = S.tool === 'marker' ? solid(c, 0.45) : solid(c); } }))),
      S.tool !== 'eraser' && slider({ label: 'Grosor', value: cfg.sw, min: 1, max: 40, step: 0.5, onInput(v) { cfg.sw = v; } }),
    ];
  } else if (kind === 'sticky') {
    body = [h('h4', {}, 'Color de la nota'), h('div', { class: 'gt-grid' }, GRADIENTS.slice(0, 20).map((g) => h('button', { type: 'button', class: 'gt' + ((S.stickyFill || 'Tungsteno') === g.n ? ' on' : ''), title: g.n, 'aria-label': g.n, style: { background: paintCSS(g.p) }, onclick() { S.stickyFill = g.n; closeMenus(); setTool('sticky'); } })))];
  } else if (kind === 'more') {
    const row = (ic, l, fn) => h('button', { type: 'button', class: 'fly-row', onclick() { closeMenus(); fn(); } }, icon(ic, 18), l);
    body = [
      h('h4', {}, 'Más herramientas'),
      row('table', 'Tabla', () => setTool('table')),
      row('check', 'Lista de tareas', () => setTool('check')),
      row('link', 'Enlace', () => setTool('link')),
      row('vote', 'Votar ideas', () => { setTool('vote'); toast('Haz clic en las ideas que quieras votar. Esc para terminar.'); }),
      row('timer', 'Temporizador', openTimerMenu),
      h('h4', {}, 'Sellos'),
      h('div', { class: 'stamps' }, ['✓', '✕', '★', '!', '?', '♥', '+1', '→'].map((g) => h('button', { type: 'button', onclick() { S.stampGlyph = g; closeMenus(); setTool('stamp'); toast('Haz clic para colocar el sello. Esc para terminar.'); } }, g))),
    ];
  }
  f.replaceChildren(...body.filter(Boolean));
  f.hidden = false;
  f.style.left = rect.right + 10 + 'px';
  f.style.top = '0px';
  const fh = f.offsetHeight;
  f.style.top = clamp(rect.top - 12, 12, innerHeight - fh - 12) + 'px';
}

/* ---------- Barra superior e inferior ---------- */
function renderChrome() {
  $('#topL').replaceChildren(
    btn('home', 'Volver a los tableros', () => { location.hash = ''; }),
    h('input', { id: 'boardName', class: 'bname', value: S.board.name, 'aria-label': 'Nombre del tablero', onchange() { renameBoard(this.value.trim() || 'Tablero sin título'); }, onkeydown(e) { if (e.key === 'Enter' || e.key === 'Escape') this.blur(); } }),
    h('div', { class: 'vsep' }),
    btn('sidebar', 'Capas, marcos y comentarios', toggleSide),
    btn('search', `Buscar y comandos (${MOD}K)`, openPalette),
  );
  $('#topR').replaceChildren(
    h('span', { id: 'conn', class: 'conn' }),
    h('div', { id: 'peers', class: 'peers' }),
    h('div', { class: 'vsep' }),
    h('button', { class: 'btn primary sm', type: 'button', onclick: () => Present.start() }, icon('play', 14), h('span', { class: 'lbl' }, 'Presentar')),
    btn('share', 'Compartir', openShare),
    btn('download', 'Exportar', openExport),
    btn('panel', 'Panel de propiedades', () => { $('#insp').classList.toggle('closed'); touchOverlay(); }),
  );
  $('#zoombar').replaceChildren(
    btn('undo', `Deshacer (${MOD}Z)`, undo, 'js-undo'),
    btn('redo', `Rehacer (${MOD}⇧Z)`, redo, 'js-redo'),
    h('div', { class: 'vsep' }),
    btn('minus', 'Alejar', () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.25)),
    h('button', { id: 'zoomLabel', class: 'zoom-l mono', type: 'button', title: 'Volver al 100%', onclick() { const c = viewCenterOf(S.cam); animateCam({ z: 1, x: innerWidth / 2 - c.x, y: innerHeight / 2 - c.y }, 300); } }, '100%'),
    btn('plus', 'Acercar', () => zoomAt(innerWidth / 2, innerHeight / 2, 1.25)),
    btn('fit', 'Ver todo (⇧1)', () => fitAll()),
    btn('map', 'Minimapa', () => { const w = $('#mapwrap'); w.hidden = !w.hidden; LS.set('minimap', !w.hidden); minimapDirty = true; schedule(); }),
    btn('help', 'Atajos (?)', openHelp),
  );
  $('#mapwrap').hidden = !LS.get('minimap', true);
  renderRail();
  renderPeers();
  setConn(S.conn || 'local');
  updateUndoUI();
}

function updateUndoUI() {
  const u = $('.js-undo'), r = $('.js-redo');
  if (u) u.disabled = !S.hist.length;
  if (r) r.disabled = !S.fut.length;
}

function renameBoard(name) {
  S.board.name = name;
  Api.updateBoard(S.boardId, { name }).catch(() => {});
  mutate(['_meta'], (m) => { m.name = name; }, { history: false });
  document.title = `${name} · SeeBase`;
}

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function renderPeers() {
  const box = $('#peers');
  if (!box) return;
  const list = [...S.peers.entries()];
  setKids(box,
    ...list.slice(0, 6).map(([sid, p]) => h('button', { class: 'av' + (S.follow === sid ? ' follow' : ''), type: 'button', title: `Seguir a ${p.name}`, 'aria-label': `Seguir a ${p.name}`, style: { '--c': p.color }, onclick() { if (S.follow === sid) stopFollow(); else startFollow(sid); } }, initials(p.name))),
    list.length > 6 && h('span', { class: 'av more' }, '+' + (list.length - 6)),
    h('span', { class: 'av me', title: S.me.name ? `${S.me.name} (tú)` : 'Tú', style: { '--c': S.me.color } }, initials(S.me.name || 'Yo')),
  );
}

let _qKey = '';
function renderQBar(sel) {
  const key = sel.map((e) => e.type + (e.locked ? 'L' : '')).sort().slice(0, 8).join() + sel.length;
  if (key === _qKey && $('#qbar').childElementCount) return;
  _qKey = key;
  const one = sel.length === 1 ? sel[0] : null;
  const locked = sel.every((e) => e.locked);
  setKids($('#qbar'),
    one?.type === 'image' && btn('crop', 'Recortar', () => startCrop(one.id)),
    one?.type === 'mind' && btn('plus', 'Añadir idea (Tab)', () => mindAdd(S.els.get(one.id))),
    btn('copy', `Duplicar (${MOD}D)`, duplicateSel),
    btn('front', 'Traer al frente', () => orderSel('front')),
    btn('back', 'Enviar atrás', () => orderSel('back')),
    sel.length > 1 && btn('group', `Agrupar (${MOD}G)`, groupSel),
    btn(locked ? 'unlock' : 'lock', locked ? 'Desbloquear' : 'Bloquear', toggleLock),
    btn('trash', 'Eliminar', deleteSel),
  );
}

/* ---------- Menú contextual ---------- */
const STYLE_KEYS = ['fill', 'stroke', 'sw', 'dash', 'rad', 'opa', 'shadow', 'glow', 'color', 'font', 'size', 'weight', 'align', 'valign'];
function onContext(e) {
  e.preventDefault();
  closeMenus();
  if (S.editing) return;
  const id = hitId(e), w = eventWorld(e);
  if (id && !S.sel.has(id)) setSel(groupIds(id));
  const has = S.sel.size > 0;
  const items = has ? [
    ['Duplicar', `${MOD}D`, duplicateSel],
    ['Traer al frente', '', () => orderSel('front')],
    ['Enviar atrás', '', () => orderSel('back')],
    S.sel.size > 1 && ['Agrupar', `${MOD}G`, groupSel],
    selEls().some((x) => x.group) && ['Desagrupar', `⇧${MOD}G`, ungroupSel],
    ['Bloquear o desbloquear', `${MOD}L`, toggleLock],
    '-',
    ['Copiar estilo', '', () => { const s = selEls()[0]; S.styleClip = Object.fromEntries(STYLE_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, clone(s[k])])); toast('Estilo copiado'); }],
    S.styleClip && ['Pegar estilo', '', () => mutate([...S.sel], (x) => { for (const k in S.styleClip) if (x[k] !== undefined || k === 'shadow' || k === 'glow') x[k] = clone(S.styleClip[k]); })],
    '-',
    ['Eliminar', '⌫', deleteSel, 'danger'],
  ] : [
    ['Nota aquí', 'N', () => placeSticky(w)],
    ['Texto aquí', 'T', () => placeText(w)],
    ['Mapa mental aquí', 'M', () => placeMindRoot(w)],
    '-',
    ['Seleccionar todo', `${MOD}A`, () => setSel(allEls().filter((x) => !x.locked && !x.hidden && x.type !== 'comment').map((x) => x.id))],
    ['Ver todo', '⇧1', () => fitAll()],
  ];
  const m = h('div', { class: 'ctx glass ui', role: 'menu' }, items.filter(Boolean).map((it) => (it === '-' ? h('hr', {}) : h('button', { type: 'button', role: 'menuitem', class: it[3] || '', onclick() { closeMenus(); it[2](); } }, h('span', {}, it[0]), h('kbd', {}, it[1])))));
  $('#editor').append(m);
  m.style.left = clamp(e.clientX, 8, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = clamp(e.clientY, 8, innerHeight - m.offsetHeight - 8) + 'px';
}

/* ---------- Panel lateral ---------- */
let sideTab = LS.get('side.tab', 'layers');
function toggleSide() { const s = $('#side'); s.hidden = !s.hidden; if (!s.hidden) renderSide(); touchOverlay(); }
function openSide(tab) { sideTab = tab; LS.set('side.tab', tab); $('#side').hidden = false; renderSide(); touchOverlay(); }
const renderSideSoon = debounce(() => renderSide(), 140);
_changeHooks.push(renderSideSoon);

function elLabel(e) {
  if (e.type === 'frame') return e.name || 'Marco';
  if (e.type === 'line') return e.label || 'Conector';
  if (e.type === 'check') return e.title;
  if (e.type === 'link') return e.title || e.url;
  if (e.type === 'table') return e.cells[0][0] || 'Tabla';
  return e.text?.split('\n')[0] || TYPE_NAMES[e.type] || e.type;
}

function renderSide() {
  const s = $('#side');
  if (!s || s.hidden || !S.boardId) return;
  const prevScroll = s.querySelector('.side-b')?.scrollTop || 0;
  const tabs = [['layers', 'Capas'], ['frames', 'Marcos'], ['comments', 'Notas'], ['templates', 'Plantillas']];
  const head = h('header', { class: 'side-tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(sideTab === k), class: sideTab === k ? 'on' : '', onclick() { sideTab = k; LS.set('side.tab', k); renderSide(); } }, l)), btn('x', 'Cerrar panel', toggleSide));
  let body;
  if (sideTab === 'layers') body = layersTab();
  else if (sideTab === 'frames') body = framesTab();
  else if (sideTab === 'comments') body = commentsTab();
  else body = templatesTab();
  const b = h('div', { class: 'side-b' }, body);
  s.replaceChildren(head, b);
  b.scrollTop = prevScroll;
}

function layersTab() {
  const list = allEls().filter((e) => e.type !== 'comment' && !(e.type === 'mind' && e.parent)).sort((a, b) => ((b.type === 'frame') - (a.type === 'frame')) * -1 || (b.z || 0) - (a.z || 0));
  if (!list.length) return h('p', { class: 'empty' }, 'Aún no hay elementos. Elige una herramienta a la izquierda y haz clic en el lienzo.');
  const box = h('div', { class: 'layers' });
  list.forEach((e, idx) => {
    const row = h('div', { class: 'layer' + (S.sel.has(e.id) ? ' on' : '') + (e.hidden ? ' off' : ''), 'data-idx': idx, onclick(ev) { if (ev.target.closest('button') || ev.target.closest('.grip')) return; setSel(groupIds(e.id)); }, ondblclick() { flyTo(elBox(e)); } },
      h('span', { class: 'grip', title: 'Arrastra para reordenar' }, icon('grip', 14)),
      icon(TYPE_ICONS[e.type] || 'shapes', 15),
      h('span', { class: 'layer-n' }, elLabel(e)),
      btn(e.hidden ? 'eyeoff' : 'eye', e.hidden ? 'Mostrar' : 'Ocultar', () => { mutate([e.id], (x) => { x.hidden = !x.hidden; }); if (e.hidden) { S.sel.delete(e.id); selChanged(); } }, e.hidden ? 'show' : ''),
      btn(e.locked ? 'lock' : 'unlock', e.locked ? 'Desbloquear' : 'Bloquear', () => mutate([e.id], (x) => { x.locked = !x.locked; }), e.locked ? 'show' : ''));
    row.querySelector('.grip').addEventListener('pointerdown', (pe) => startLayerDrag(pe, row, box, list, idx));
    box.append(row);
  });
  return box;
}
function startLayerDrag(pe, row, box, list, idx) {
  pe.preventDefault();
  const rows = [...box.children], H = row.offsetHeight;
  let target = idx;
  row.classList.add('dragging');
  row.setPointerCapture(pe.pointerId);
  row.onpointermove = (ev) => {
    const r = box.getBoundingClientRect();
    target = clamp(Math.round((ev.clientY - r.top - H / 2) / H), 0, rows.length - 1);
    rows.forEach((c, i) => c.classList.toggle('drop-line', i === target && i !== idx));
  };
  row.onpointerup = () => {
    row.onpointermove = null;
    rows.forEach((c) => c.classList.remove('drop-line', 'dragging'));
    if (target === idx) return;
    const moved = list.slice();
    const [e] = moved.splice(idx, 1);
    moved.splice(target, 0, e);
    const items = moved.filter((x) => x.type !== 'frame');
    const ids = items.map((x) => x.id);
    let z = items.length;
    const order = new Map(items.map((x) => [x.id, z--]));
    mutate(ids, (x) => { x.z = order.get(x.id); });
    orderDirty = true; schedule();
  };
}

function framesTab() {
  const list = Present.frames();
  if (!list.length) return h('p', { class: 'empty' }, 'Los marcos son las secciones de tu tablero y las diapositivas de la presentación. Pulsa F y dibuja uno.');
  const reorder = (i, d) => {
    const ids = list.map((f) => f.id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    mutate(ids, (x) => { x.order = ids.indexOf(x.id); });
    renderSide();
  };
  return [
    h('div', { class: 'frames' }, list.map((f, i) => h('div', { class: 'layer' + (S.sel.has(f.id) ? ' on' : ''), onclick(ev) { if (ev.target.closest('button')) return; setSel([f.id]); flyTo(elBox(f), { maxZ: 2 }); } },
      h('span', { class: 'mono num' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'layer-n' }, f.name || 'Marco'),
      btn('chevU', 'Subir', () => reorder(i, -1), 'show'),
      btn('chevD', 'Bajar', () => reorder(i, 1), 'show'),
      btn('play', 'Presentar desde aquí', () => Present.start(i), 'show')))),
    h('button', { class: 'btn wide', type: 'button', onclick: () => Present.start() }, icon('play', 15), 'Presentar todo'),
  ];
}

function commentsTab() {
  const list = allEls().filter((e) => e.type === 'comment').sort((a, b) => (a.resolved - b.resolved) || (b.thread[0]?.t || 0) - (a.thread[0]?.t || 0));
  if (!list.length) return h('p', { class: 'empty' }, 'Pulsa C y haz clic donde quieras dejar una nota para el equipo.');
  return h('div', { class: 'notes' }, list.map((c) => h('button', { class: 'note-row' + (c.resolved ? ' done' : ''), type: 'button', onclick() { flyTo({ x: c.x - 120, y: c.y - 80, w: 240, h: 160 }, { maxZ: 1.4 }); setTimeout(() => openThread(c.id), 420); } },
    h('span', { class: 'av', style: { '--c': c.thread[0]?.color || '#888' } }, initials(c.thread[0]?.name)),
    h('span', { class: 'note-tx' }, h('b', {}, c.thread[0]?.name || ''), h('span', {}, c.thread[0]?.text || ''), h('small', {}, `${c.thread.length} ${c.thread.length === 1 ? 'mensaje' : 'mensajes'}${c.resolved ? ' · resuelto' : ''}`)))));
}

function templatesTab() {
  return h('div', { class: 'tpl-list' }, TEMPLATES.map((t) => h('button', { class: 'tpl', type: 'button', style: { background: paintCSS(grad(t.g)) }, onclick() { insertTemplate(t.id); } }, h('b', {}, t.n), h('span', {}, t.d))));
}
function insertTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (t) insertList(t.build());
}

/* ---------- Comentarios ---------- */
function renderPins(out, sx, sy) {
  for (const c of S.els.values()) {
    if (c.type !== 'comment' || (c.resolved && S.thread !== c.id)) continue;
    const f = c.thread[0];
    out.push(h('button', { class: 'pin' + (S.thread === c.id ? ' on' : ''), type: 'button', 'data-pin': c.id, 'aria-label': `Comentario de ${f?.name || ''}`, style: { left: sx(c.x) + 'px', top: sy(c.y) + 'px', '--c': f?.color || '#d9bd94' } }, initials(f?.name), c.thread.length > 1 && h('small', {}, c.thread.length)));
  }
  placeThread();
}
function newComment(w) { setTool('select'); S.thread = 'new'; S.threadAt = w; renderThread(); }
function openThread(id) { S.thread = id; renderThread(); touchOverlay(); }
function closeThread() { if (!S.thread) return; S.thread = null; const t = $('#thread'); if (t) t.hidden = true; touchOverlay(); }
function placeThread() {
  const t = $('#thread');
  if (!t || !S.thread) return;
  const c = S.thread === 'new' ? S.threadAt : S.els.get(S.thread);
  if (!c) { closeThread(); return; }
  const { z, x: cx, y: cy } = S.cam;
  t.style.left = clamp(c.x * z + cx + 24, 10, innerWidth - 310) + 'px';
  t.style.top = clamp(c.y * z + cy - 16, 66, innerHeight - t.offsetHeight - 12) + 'px';
}
function renderThread() {
  const box = $('#thread');
  const isNew = S.thread === 'new';
  const c = isNew ? null : S.els.get(S.thread);
  const send = (input) => {
    const text = input.value.trim();
    if (!text) return;
    const msg = { name: S.me.name || 'Yo', color: S.me.color, text, t: Date.now() };
    if (isNew) {
      const el = newEl('comment', { x: S.threadAt.x, y: S.threadAt.y, thread: [msg] });
      addEls([el], { select: false });
      S.thread = el.id;
    } else mutate([c.id], (x) => { x.thread.push(msg); });
    renderThread(); touchOverlay();
  };
  const input = h('input', { class: 'input', id: 'thread-input', placeholder: isNew ? 'Escribe un comentario' : 'Responder', 'aria-label': 'Comentario', onkeydown(e) { e.stopPropagation(); if (e.key === 'Enter') send(this); if (e.key === 'Escape') closeThread(); } });
  setKids(box,
    c && h('header', { class: 'th-h' }, h('button', { class: 'link', type: 'button', onclick() { mutate([c.id], (x) => { x.resolved = !x.resolved; }); closeThread(); } }, c.resolved ? 'Reabrir' : 'Marcar resuelto'), btn('trash', 'Eliminar comentario', () => { removeEls([c.id]); closeThread(); })),
    c && h('div', { class: 'th-list' }, c.thread.map((m) => h('div', { class: 'th-m' }, h('span', { class: 'av', style: { '--c': m.color } }, initials(m.name)), h('div', {}, h('b', {}, m.name), h('small', {}, timeAgo(m.t)), h('p', {}, m.text))))),
    h('div', { class: 'th-in' }, input, btn('chevR', 'Enviar', () => send(input))),
  );
  box.hidden = false;
  placeThread();
  setTimeout(() => input.focus(), 30);
}

/* ---------- Temporizador ---------- */
let _timerLoop = 0, _timerEnd = 0, _audio = null;
function renderTimer() {
  const t = getMeta()?.timer, bar = $('#timerbar');
  if (!bar) return;
  clearInterval(_timerLoop);
  if (!t) { bar.hidden = true; return; }
  const label = h('span', { class: 'mono' }), fill = h('i', {});
  bar.replaceChildren(icon('timer', 15), label, h('div', { class: 'tm-track' }, fill), btn('x', 'Quitar temporizador', () => mutate(['_meta'], (m) => { m.timer = null; }, { history: false })));
  bar.hidden = false;
  const tick = () => {
    const left = Math.max(0, t.end - Date.now());
    label.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.ceil((left % 60000) / 1000) % 60).padStart(2, '0')}`;
    fill.style.width = (left / (t.dur * 60000)) * 100 + '%';
    bar.classList.toggle('done', left <= 0);
    if (left <= 0 && _timerEnd !== t.end) { _timerEnd = t.end; chime(); toast('Se acabó el tiempo'); clearInterval(_timerLoop); }
  };
  tick();
  _timerLoop = setInterval(tick, 250);
}
function chime() {
  try {
    _audio = _audio || new AudioContext();
    [0, 0.22].forEach((d, i) => {
      const o = _audio.createOscillator(), g = _audio.createGain(), t0 = _audio.currentTime + d;
      o.frequency.value = i ? 660 : 523; o.type = 'sine';
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1);
      o.connect(g).connect(_audio.destination); o.start(t0); o.stop(t0 + 1.05);
    });
  } catch {}
}
function startTimer(min) { mutate(['_meta'], (m) => { m.timer = { end: Date.now() + min * 60000, dur: min }; }, { history: false }); }
function openTimerMenu() {
  const m = modal([h('h3', {}, 'Temporizador para el equipo'), h('p', { class: 'muted' }, 'Todas las personas del tablero verán la misma cuenta atrás.'),
    h('div', { class: 'chips big' }, [1, 3, 5, 10, 15, 25].map((n) => h('button', { type: 'button', class: 'chip', onclick() { startTimer(n); m.close(); } }, `${n} min`)))]);
}

/* ---------- Presentación ---------- */
const Present = {
  on: false, list: [], i: 0,
  frames() {
    return allEls().filter((e) => e.type === 'frame' && !e.hidden).sort((a, b) => (a.order ?? 1e6) - (b.order ?? 1e6) || Math.round(a.y / 120) - Math.round(b.y / 120) || a.x - b.x);
  },
  start(i = 0) {
    const list = this.frames();
    if (!list.length) { toast('Crea al menos un marco para presentar. Pulsa F.'); return; }
    closeMenus(); closeThread(); finishEdit(); setSel([]); setTool('select');
    this.list = list; this.i = clamp(i, 0, list.length - 1); this.on = true; this.saved = { ...S.cam };
    document.body.classList.add('presenting');
    document.documentElement.requestFullscreen?.().catch(() => {});
    Api.eph({ t: 'present', on: true });
    setTimeout(() => this.show(), 60);
  },
  area() { const bar = innerHeight * 0.1; return { x: 0, y: bar, w: innerWidth, h: innerHeight - bar * 2 }; },
  show() {
    const f = this.list[this.i];
    flyTo(elBox(f), { area: this.area(), pad: 24, maxZ: 4, dur: 1150 });
    $('#pr-title').textContent = f.name || 'Marco';
    $('#pr-count').textContent = `${String(this.i + 1).padStart(2, '0')} / ${String(this.list.length).padStart(2, '0')}`;
  },
  go(d) { const n = this.i + d; if (n < 0 || n >= this.list.length) return; this.i = n; this.show(); },
  stop() {
    this.on = false;
    document.body.classList.remove('presenting');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    Api.eph({ t: 'present', on: false });
    animateCam(this.saved, 700);
  },
  key(e) {
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); this.go(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.go(-1); }
    else if (e.key === 'Escape') this.stop();
  },
};

/* ---------- Diálogos ---------- */
function openShare() {
  const url = location.href;
  const body = S.backend
    ? [h('p', { class: 'muted' }, 'Quien abra este enlace verá y editará el tablero contigo en tiempo real.'), h('div', { class: 'share-row' }, h('input', { class: 'input mono', id: 'share-url', readonly: true, value: url }), h('button', { class: 'btn primary', type: 'button', onclick() { copyText(url).then((ok) => { if (ok) toast('Enlace copiado'); else { const i = $('#share-url'); i.select(); toast('Selecciona y copia el enlace'); } }); } }, 'Copiar enlace'))]
    : [h('p', { class: 'muted' }, 'Ahora mismo este tablero solo se guarda en este navegador. Cuando la app esté publicada, este botón te dará un enlace para trabajar con tu equipo en tiempo real.')];
  modal([h('h3', {}, 'Compartir tablero'), ...body]);
}

const canDownload = () => S.backend || window.top === window.self;
function openExport() {
  let scope = S.sel.size ? 'sel' : 'all', scale = 2, scene = true;
  const unavailable = !canDownload();
  const m = modal([
    h('h3', {}, 'Exportar'),
    unavailable && h('p', { class: 'muted' }, 'Las descargas se activan cuando la app está publicada. Esta vista previa no puede guardar archivos.'),
    h('div', { class: 'row' }, h('label', {}, 'Qué'), seg([{ v: 'all', l: 'Todo' }, { v: 'sel', l: 'Selección' }, { v: 'frame', l: 'Marco visible' }], scope, (v) => { scope = v; })),
    h('div', { class: 'row' }, h('label', {}, 'Calidad'), seg([{ v: 1, l: '1×' }, { v: 2, l: '2×' }, { v: 4, l: '4×' }], scale, (v) => { scale = v; })),
    toggle('Incluir la luz de fondo', scene, (v) => { scene = v; }),
    h('div', { class: 'modal-actions spread' },
      h('div', { class: 'row-g' },
        h('button', { class: 'btn', type: 'button', disabled: unavailable || null, onclick() { exportJSON(); } }, 'Copia de seguridad'),
        h('button', { class: 'btn', type: 'button', onclick() { $('#jsonpick').click(); m.close(); } }, 'Importar copia')),
      h('button', { class: 'btn primary', type: 'button', disabled: unavailable || null, async onclick() { this.disabled = true; this.textContent = 'Preparando'; await doExport({ scope, scale, scene }); m.close(); } }, 'Exportar PNG')),
  ], { cls: 'w480' });
}

function openHelp() {
  const rows = [
    ['V', 'Seleccionar'], ['H o espacio', 'Mover el lienzo'], ['N', 'Nota'], ['T', 'Texto'], ['S / R', 'Forma / rectángulo'], ['L', 'Conector'], ['P / B / E', 'Pluma, marcador, borrador'], ['M', 'Mapa mental'], ['F', 'Marco'], ['I', 'Foto'], ['C', 'Comentario'],
    ['Tab / Enter', 'Idea hija / hermana'], ['Doble clic', 'Editar o recortar foto'], ['Alt + arrastrar', 'Duplicar'], ['Mayús + arrastrar', 'Mover recto o proporción libre'],
    [`${MOD} D`, 'Duplicar'], [`${MOD} G`, 'Agrupar'], [`${MOD} L`, 'Bloquear'], [`${MOD} ] / [`, 'Subir o bajar capa'], [`${MOD} K`, 'Buscar y comandos'], ['⇧1 / ⇧2', 'Ver todo / selección'],
  ];
  modal([h('h3', {}, 'Atajos de teclado'), h('dl', { class: 'keys' }, rows.flatMap(([k, d]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, d)]))], { cls: 'w560' });
}

function openPalette() {
  const cmds = [
    ['Ver todo el tablero', () => fitAll()],
    ['Presentar', () => Present.start()],
    ['Compartir tablero', openShare],
    ['Exportar', openExport],
    ['Volver a los tableros', () => { location.hash = ''; }],
    ['Temporizador de 5 minutos', () => startTimer(5)],
    ['Abrir capas', () => openSide('layers')],
    ['Abrir plantillas', () => openSide('templates')],
    ...TEMPLATES.map((t) => [`Insertar plantilla: ${t.n}`, () => insertTemplate(t.id)]),
    ...SCENES.map((s) => [`Luz de la escena: ${s.n}`, () => mutate(['_meta'], (m) => { m.scene.id = s.id; })]),
  ];
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  let active = 0, shown = [];
  const run = (it) => { m.close(); it[1](); };
  const draw = (q) => {
    const s = q.trim().toLowerCase();
    const found = !s ? [] : allEls().filter((e) => elLabel(e).toLowerCase().includes(s) && e.type !== 'comment').slice(0, 8).map((e) => [`Ir a: ${elLabel(e)}`, () => { setSel(groupIds(e.id)); flyTo(elBox(e), { maxZ: 1.4 }); }]);
    shown = [...found, ...cmds.filter((c) => c[0].toLowerCase().includes(s))].slice(0, 14);
    active = 0;
    paint();
  };
  const paint = () => list.replaceChildren(...shown.map((it, i) => h('button', { type: 'button', role: 'option', class: i === active ? 'on' : '', onclick: () => run(it) }, it[0])));
  const input = h('input', { class: 'pal-in', id: 'palette-input', placeholder: 'Busca en el tablero o escribe un comando', 'aria-label': 'Buscar', oninput() { draw(this.value); }, onkeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); run(shown[active]); }
  } });
  const m = modal([input, list], { cls: 'palette' });
  draw('');
  setTimeout(() => input.focus(), 30);
}

/* ---------- Portada ---------- */
const HOME_SCENE = { id: 'tungsteno', i: 0.95, g: 0.5, v: 0.85, m: 0.5 };

async function renderHome() {
  const root = $('#home');
  let boards = [];
  try { boards = await Api.listBoards(); } catch { toast('No se pudo cargar la lista de tableros. Revisa tu conexión.'); }
  const grid = h('div', { class: 'b-grid' });
  const drawGrid = (q = '') => {
    const s = q.trim().toLowerCase();
    const list = boards.filter((b) => b.name.toLowerCase().includes(s));
    grid.replaceChildren(...(list.length ? list.map(boardCard) : [h('p', { class: 'empty wide' }, s ? 'Ningún tablero coincide con esa búsqueda.' : 'Todavía no hay tableros. Crea el primero o empieza desde una plantilla.')]));
  };
  function boardCard(b) {
    const fallback = paintCSS(GRADIENTS[Array.from(b.id).reduce((a, c) => a + c.charCodeAt(0), 0) % 22].p);
    return h('article', { class: 'b-card' },
      h('a', { class: 'b-thumb', href: '#b-' + b.id, style: { background: fallback }, 'aria-label': 'Abrir ' + b.name }, b.thumb && h('img', { src: b.thumb, alt: '' })),
      h('div', { class: 'b-meta' }, h('div', { class: 'b-tx' }, h('b', {}, b.name), h('span', {}, `Editado ${timeAgo(b.updated)}`)),
        btn('more', 'Opciones del tablero', (ev) => { ev.stopPropagation(); boardMenu(ev.currentTarget, b, reload); })));
  }
  const reload = async () => { boards = await Api.listBoards(); drawGrid(); };
  root.replaceChildren(h('div', { class: 'home-in' },
    h('header', { class: 'home-top' },
      h('div', { class: 'wordmark' }, icon('logo', 22), h('span', {}, 'SeeBase')),
      h('div', { class: 'home-tools' },
        h('label', { class: 'h-search' }, icon('search', 16), h('input', { id: 'home-search', placeholder: 'Buscar tableros', 'aria-label': 'Buscar tableros', oninput() { drawGrid(this.value); } })),
        h('button', { class: 'av me', type: 'button', title: 'Cambiar tu nombre', style: { '--c': S.me.color }, onclick: async () => { const n = await askText({ title: 'Tu nombre en los tableros', value: S.me.name, placeholder: 'Nombre', id: 'profile-name' }); if (n) { S.me.name = n; saveProfile(); renderHome(); } } }, initials(S.me.name || 'Yo')))),
    h('section', { class: 'hero' },
      h('h1', {}, 'Ideas a media luz'),
      h('button', { class: 'btn primary lg', type: 'button', onclick: () => newBoardFromTemplate(null) }, icon('plus', 17), 'Nuevo tablero')),
    h('section', {}, h('h2', {}, 'Empezar desde una plantilla'), h('div', { class: 'tpl-row' }, TEMPLATES.map((t) => h('button', { class: 'tpl', type: 'button', style: { background: paintCSS(grad(t.g)) }, onclick: () => newBoardFromTemplate(t.id) }, h('b', {}, t.n), h('span', {}, t.d))))),
    h('section', {}, h('h2', {}, 'Tableros'), grid)));
  drawGrid();
}
function boardMenu(anchor, b, reload) {
  document.querySelector('.ctx')?.remove();
  const close = () => m.remove();
  const item = (l, fn, cls) => h('button', { type: 'button', role: 'menuitem', class: cls || '', onclick() { close(); fn(); } }, h('span', {}, l));
  const m = h('div', { class: 'ctx glass', role: 'menu' },
    item('Cambiar nombre', async () => { const n = await askText({ title: 'Nombre del tablero', value: b.name, id: 'rename-board' }); if (n) { await Api.updateBoard(b.id, { name: n }); reload(); } }),
    item('Duplicar', async () => {
      const src = await Api.loadBoard(b.id);
      const nb = await Api.createBoard({ name: b.name + ' (copia)', owner: S.me.name });
      const ops = src.elements.map((e) => ({ id: e.id, v: e.v || 1, by: e.by || 'copy', data: e }));
      if (Api === Cloud) await Cloud.seed(nb.id, ops); else Local.saveOps(nb.id, ops);
      setTimeout(reload, 80);
    }),
    h('hr', {}),
    item('Eliminar', async () => { if (await ask({ title: `¿Eliminar «${b.name}»?`, text: 'Se borrará para todo el equipo y no se puede recuperar.', ok: 'Eliminar', danger: true })) { await Api.deleteBoard(b.id); reload(); } }, 'danger'));
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = clamp(r.right - m.offsetWidth, 8, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = clamp(r.bottom + 6, 8, innerHeight - m.offsetHeight - 8) + 'px';
  setTimeout(() => addEventListener('pointerdown', function once(e) { if (!m.contains(e.target)) { close(); removeEventListener('pointerdown', once); } }), 0);
}

function showGate() {
  return new Promise((res) => {
    const root = $('#gate');
    root.hidden = false;
    const err = h('p', { class: 'gate-err', role: 'alert' });
    const input = h('input', { class: 'input', id: 'team-code', type: 'password', placeholder: 'Clave del equipo', autocomplete: 'current-password' });
    const form = h('form', { class: 'gate-card glass', async onsubmit(e) {
      e.preventDefault();
      err.textContent = '';
      const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: input.value }) });
      if (r.ok) { root.hidden = true; res(); } else err.textContent = 'Esa clave no es correcta. Pídesela a quien administra el espacio.';
    } }, h('div', { class: 'wordmark' }, icon('logo', 22), h('span', {}, 'SeeBase')), h('p', { class: 'muted' }, 'Escribe la clave de tu equipo para entrar.'), input, err, h('button', { class: 'btn primary wide', type: 'submit' }, 'Entrar'));
    root.replaceChildren(form);
    setTimeout(() => input.focus(), 50);
  });
}

function askName() {
  return new Promise((res) => {
    const input = h('input', { class: 'input', id: 'first-name', placeholder: 'Tu nombre', maxlength: 40 });
    const go = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } S.me.name = v; saveProfile(); m.close(); res(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const m = modal([h('h3', {}, '¿Cómo te llamas?'), h('p', { class: 'muted' }, 'Tu equipo verá este nombre junto a tu cursor.'), input, h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: go }, 'Continuar'))]);
    setTimeout(() => input.focus(), 40);
  });
}
