'use strict';
/* Plantillas y tablero de ejemplo */
function insertList(list, { at = null, select = true, fly = true } = {}) {
  const snap = new Map();
  let z = maxZ(), fz = Math.min(0, ...allEls().map((e) => e.z || 0));
  for (const e of list) {
    snap.set(e.id, null);
    if (e.z == null) e.z = e.type === 'frame' ? --fz : ++z;
    S.els.set(e.id, e);
  }
  list.filter((e) => e.type === 'mind' && !e.parent).forEach((r) => layoutMind(r.id));
  const b = unionBox(list.filter((e) => e.type !== 'line').map(elBox));
  const a = viewArea();
  const c = at || screenToWorld(a.x + a.w / 2, a.y + a.h / 2);
  const dx = c.x - (b.x + b.w / 2), dy = c.y - (b.y + b.h / 2);
  for (const e of list) {
    if (e.type === 'line') {
      if (!e.a.id) e.a = { x: e.a.x + dx, y: e.a.y + dy };
      if (!e.b.id) e.b = { x: e.b.x + dx, y: e.b.y + dy };
    } else { e.x += dx; e.y += dy; }
    invalidate(e.id);
  }
  commitFrom(snap);
  if (select) setSel([]);
  if (fly) flyTo({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, { maxZ: 1 });
}

const _T = {
  sticky: (x, y, text, g = 'Tungsteno', w = 180, H = 180) => newEl('sticky', { x, y, w, h: H, text, fill: grad(g) }),
  text: (x, y, text, o = {}) => { const e = newEl('text', { x, y, text, auto: false, ...o }); const m = textMetrics(e, o.w || 900); e.w = o.w || Math.ceil(m.w) + 8; e.h = Math.ceil(m.h) + 2; return e; },
  frame: (x, y, w, H, name, o = {}) => newEl('frame', { x, y, w, h: H, name, ...o }),
  shape: (kind, x, y, w, H, text, o = {}) => newEl('shape', { kind, x, y, w, h: H, text, ...o }),
  line: (a, b, o = {}) => newEl('line', { route: 'curve', a: a.id ? { id: a.id, side: 'auto' } : a, b: b.id ? { id: b.id, side: 'auto' } : b, ...o }),
  mind(spec, x = 0, y = 0) {
    const root = newEl('mind', { x, y, text: spec.t, size: 24, weight: 600, fill: grad('Grafito'), stroke: solid('#ffffff', 0.2) });
    const out = [root];
    const walk = (node, parent, side, branch) => (node.k || []).forEach((c, i) => {
      const s = parent === root ? (i % 2 ? 'l' : 'r') : side;
      const col = parent === root ? BRANCH_COLORS[i % BRANCH_COLORS.length] : branch;
      const n = newEl('mind', { parent: parent.id, side: s, order: i, branch: col, text: c.t, size: parent === root ? 17 : 15, weight: parent === root ? 500 : 400, x: 0, y: 0 });
      out.push(n);
      walk(c, n, s, col);
    });
    walk(spec, root, 'r', '#d9bd94');
    return out;
  },
};

const TEMPLATES = [
  {
    id: 'mind', n: 'Mapa mental', d: 'Una idea central con ramas', g: 'Tungsteno',
    build: () => _T.mind({ t: 'Idea central', k: [
      { t: 'Objetivo', k: [{ t: 'Qué queremos lograr' }, { t: 'Cómo lo mediremos' }] },
      { t: 'Público', k: [{ t: 'A quién le importa' }, { t: 'Qué necesita' }] },
      { t: 'Recursos', k: [{ t: 'Equipo' }, { t: 'Presupuesto' }] },
      { t: 'Riesgos', k: [{ t: 'Qué puede fallar' }, { t: 'Plan B' }] },
    ] }),
  },
  {
    id: 'brain', n: 'Lluvia de ideas', d: 'Pregunta central y grupos', g: 'Ámbar tenue',
    build() {
      const f = _T.frame(0, 0, 1280, 800, 'Lluvia de ideas');
      const q = _T.shape('ellipse', 500, 310, 280, 180, '¿Qué problema queremos resolver?', { fill: grad('Foco'), size: 19 });
      const set = [['Tungsteno', 70, 60], ['Tungsteno', 270, 60], ['Tungsteno', 70, 260], ['Petróleo', 1020, 60], ['Petróleo', 820, 60], ['Petróleo', 1020, 260], ['Vino', 70, 560], ['Vino', 270, 560], ['Malva', 1020, 560], ['Malva', 820, 560]];
      return [f, q, ...set.map(([g, x, y]) => _T.sticky(x, y, 'Idea', g))];
    },
  },
  {
    id: 'kanban', n: 'Kanban', d: 'Por hacer, en curso y hecho', g: 'Petróleo',
    build() {
      const cols = [['Por hacer', 'Grafito'], ['En curso', 'Tungsteno'], ['En revisión', 'Malva'], ['Hecho', 'Musgo']];
      return cols.flatMap(([n, g], i) => {
        const x = i * 330;
        return [_T.frame(x, 0, 300, 720, n), _T.sticky(x + 30, 30, 'Tarea', g, 240, 140), _T.sticky(x + 30, 190, 'Tarea', g, 240, 140), _T.sticky(x + 30, 350, 'Tarea', g, 240, 140)];
      });
    },
  },
  {
    id: 'story', n: 'Storyboard', d: 'Seis planos con notas de rodaje', g: 'Horizonte',
    build() {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const x = (i % 3) * 560, y = Math.floor(i / 3) * 500, no = String(i + 1).padStart(2, '0');
        out.push(_T.frame(x, y, 520, 292, `Plano ${no}`));
        out.push(_T.shape('rect', x + 14, y + 14, 492, 264, '', { rad: 6, fill: grad(['Horizonte', 'Ocaso', 'Madrugada', 'Eclipse', 'Teal y ámbar', 'Humo'][i]), stroke: solid('#ffffff', 0.08) }));
        out.push(_T.text(x + 2, y + 306, 'Acción · Cámara · Sonido', { size: 15, weight: 400, color: solid('#a7a39b'), w: 510 }));
      }
      return out;
    },
  },
  {
    id: 'mood', n: 'Moodboard', d: 'Referencias, paleta y palabras', g: 'Ocaso',
    build() {
      const f = _T.frame(0, 0, 1120, 700, 'Moodboard');
      const c = [
        _T.shape('rect', 40, 40, 460, 300, 'Suelta aquí una foto', { rad: 10, fill: grad('Horizonte'), size: 15, color: solid('#a7a39b') }),
        _T.shape('rect', 520, 40, 280, 300, '', { rad: 10, fill: grad('Vino') }),
        _T.shape('ellipse', 820, 40, 260, 260, '', { fill: grad('Eclipse') }),
        _T.shape('rect', 40, 360, 280, 300, '', { rad: 10, fill: grad('Petróleo') }),
        _T.text(350, 390, 'Palabras clave', { font: 'Cormorant', size: 46, weight: 500, w: 420 }),
        _T.text(352, 460, 'Silencio, polvo, luz baja', { size: 18, weight: 400, color: solid('#a7a39b'), w: 400 }),
      ];
      const pal = ['#0e0f12', '#2b2a28', '#8a5f34', '#d9bd94', '#c9c5bc'].map((col, i) => _T.shape('ellipse', 350 + i * 86, 560, 70, 70, '', { fill: solid(col), stroke: solid('#ffffff', 0.18) }));
      return [f, ...c, ...pal];
    },
  },
  {
    id: 'swot', n: 'FODA', d: 'Fortalezas, oportunidades y más', g: 'Musgo',
    build() {
      return [['Fortalezas', 'Musgo', 0, 0], ['Oportunidades', 'Petróleo', 1, 0], ['Debilidades', 'Tungsteno', 0, 1], ['Amenazas', 'Vino', 1, 1]].flatMap(([n, g, c, r]) => {
        const x = c * 540, y = r * 420;
        return [_T.frame(x, y, 510, 390, n), _T.sticky(x + 26, y + 30, 'Escribe aquí', g), _T.sticky(x + 220, y + 30, 'Escribe aquí', g)];
      });
    },
  },
  {
    id: 'retro', n: 'Retrospectiva', d: 'Qué funcionó y qué cambiar', g: 'Vino',
    build() {
      return [['Funcionó', 'Musgo'], ['Faltó', 'Vino'], ['Aprendimos', 'Índigo'], ['Acciones', 'Tungsteno']].flatMap(([n, g], i) => {
        const x = i * 340;
        return [_T.frame(x, 0, 310, 620, n), _T.sticky(x + 34, 40, 'Nota', g, 240, 160), _T.sticky(x + 34, 220, 'Nota', g, 240, 160)];
      });
    },
  },
  {
    id: 'flow', n: 'Diagrama de flujo', d: 'Pasos, decisiones y resultado', g: 'Acero',
    build() {
      const a = _T.shape('squircle', 0, 90, 180, 90, 'Inicio', { fill: grad('Tungsteno') });
      const b = _T.shape('rect', 280, 90, 200, 90, 'Paso');
      const c = _T.shape('diamond', 580, 45, 220, 180, '¿Aprobado?', { fill: grad('Vino') });
      const d = _T.shape('rect', 900, 90, 200, 90, 'Publicar', { fill: grad('Musgo') });
      const e = _T.shape('rect', 590, 340, 200, 90, 'Corregir');
      const opts = { route: 'elbow', stroke: { t: 'linear', a: 90, s: [{ o: 0, c: '#6d6a65' }, { o: 1, c: '#d9bd94' }] } };
      return [a, b, c, d, e, _T.line(a, b, opts), _T.line(b, c, opts), _T.line(c, d, { ...opts, label: 'Sí' }), _T.line(c, e, { ...opts, label: 'No' }), _T.line(e, b, opts)];
    },
  },
  {
    id: 'time', n: 'Línea de tiempo', d: 'Hitos en orden', g: 'Madrugada',
    build() {
      const out = [_T.line({ x: 0, y: 140 }, { x: 1340, y: 140 }, { route: 'straight', sw: 2.5, stroke: { t: 'linear', a: 90, s: [{ o: 0, c: '#3a3c42' }, { o: 1, c: '#d9bd94' }] } })];
      ['Inicio', 'Desarrollo', 'Producción', 'Revisión', 'Entrega'].forEach((n, i) => {
        const x = 60 + i * 280;
        out.push(_T.shape('ellipse', x, 126, 28, 28, '', { fill: solid('#d9bd94'), stroke: NONE, sw: 0 }));
        out.push(_T.text(x - 20, 50, n, { size: 22, font: 'Cormorant', weight: 600, w: 230 }));
        out.push(_T.sticky(x - 20, 190, 'Detalle del hito', 'Grafito', 220, 150));
      });
      return out;
    },
  },
];

async function newBoardFromTemplate(tplId) {
  const name = tplId ? TEMPLATES.find((t) => t.id === tplId)?.n : 'Tablero sin título';
  const b = await Api.createBoard({ name, owner: S.me.name });
  if (tplId) S.pendingTemplate = tplId;
  location.hash = 'b-' + b.id;
}

async function seedDemo() {
  const b = await Api.createBoard({ id: uid(14), name: 'Última Luz (ejemplo)', owner: 'SeeBase' });
  const stills = await Promise.all(['dusk', 'teal', 'wine'].map(genStill));
  const refs = await Promise.all(stills.map(async (s) => ({ ...s, asset: await Api.putAsset(b.id, s.blob) })));
  const meta = { id: '_meta', type: '_meta', scene: { id: 'tungsteno', i: 1, g: 0.5, v: 0.8, m: 0.5 }, grid: { mode: 'dots', snap: false }, timer: null, v: 1, by: 'seed' };
  const img = (r, o) => newEl('image', { asset: r.asset, ab: b.id, nw: r.nw, nh: r.nh, ...o });

  const title = _T.text(0, -262, 'Última Luz', { font: 'Cormorant', size: 92, weight: 500, w: 620 });
  const tag = _T.text(4, -134, 'Tablero de ejemplo. Muévelo, edítalo o bórralo.', { size: 16, weight: 400, color: solid('#a7a39b'), w: 520 });

  const mood = _T.frame(0, -20, 1020, 520, 'Referencias');
  const a1 = img(refs[0], { x: 28, y: 8, w: 620, h: 259, mask: 'rect', rad: 8, look: 'tungsten', fx: { b: 94, c: 108, s: 88, w: 40, v: 40 } });
  const a2 = img(refs[1], { x: 676, y: 8, w: 316, h: 316, mask: 'ellipse', look: 'teal', fx: { c: 112, s: 86, v: 30 } });
  const a3 = img(refs[2], { x: 28, y: 290, w: 280, h: 186, mask: 'arch', rad: 0, look: 'natural', fx: {} });
  const a4 = img(refs[0], { x: 330, y: 290, w: 318, h: 186, mask: 'rect', rad: 8, look: 'noir', fx: { g: 100, c: 125, b: 92, v: 45 }, flipH: true });
  const quote = _T.text(690, 356, 'La luz entra una vez al día y solo por una ventana.', { font: 'Cormorant', size: 28, weight: 500, italic: true, w: 300, color: { t: 'linear', a: 100, s: [{ o: 0, c: '#efe4d2' }, { o: 1, c: '#a58a63' }] } });

  const tree = _T.mind({ t: 'Última Luz', k: [
    { t: 'Guion', k: [{ t: 'Tercer acto' }, { t: 'Diálogo final' }] },
    { t: 'Fotografía', k: [{ t: 'Luz natural' }, { t: 'Lente 35 mm' }] },
    { t: 'Arte', k: [{ t: 'Casa del faro' }, { t: 'Vestuario gastado' }] },
    { t: 'Sonido', k: [{ t: 'Viento continuo' }, { t: 'Sin música al final' }] },
  ] }, 1560, 200);

  const n1 = _T.sticky(0, 590, 'Buscar locación en la costa antes del viernes', 'Tungsteno', 200, 200);
  const n2 = _T.sticky(224, 590, '¿Rodamos el final de noche o al amanecer?', 'Petróleo', 200, 200);
  const n3 = _T.sticky(448, 590, 'Probar película 35 mm en el plano del faro', 'Vino', 200, 200);
  const s1 = _T.shape('rect', 760, 590, 190, 90, 'Guion cerrado', { fill: grad('Tungsteno') });
  const s2 = _T.shape('rect', 1050, 590, 190, 90, 'Plan de rodaje');
  const s3 = _T.shape('diamond', 1045, 730, 200, 150, '¿Presupuesto?', { fill: grad('Vino'), size: 15 });
  const s4 = _T.shape('rect', 1340, 760, 190, 90, 'Rodaje', { fill: grad('Musgo') });
  const gold = { t: 'linear', a: 90, s: [{ o: 0, c: '#6d6a65' }, { o: 1, c: '#d9bd94' }] };
  const lines = [_T.line(s1, s2, { stroke: gold, flow: true }), _T.line(s2, s3, { stroke: gold }), _T.line(s3, s4, { stroke: gold, label: 'Sí' })];

  const list = [title, tag, mood, a1, a2, a3, a4, quote, ...tree, n1, n2, n3, s1, s2, s3, s4, ...lines];
  [a1, a2, a3, a4, quote].forEach((e) => { e.x += mood.x; e.y += mood.y; });

  const prev = { els: S.els, clock: S.clock };
  S.els = new Map([['_meta', meta]]);
  let z = 0, clock = 1;
  for (const e of list) { e.z = e.type === 'frame' ? -1 : ++z; e.v = ++clock; e.by = 'seed'; S.els.set(e.id, e); }
  list.filter((e) => e.type === 'mind' && !e.parent).forEach((r) => layoutMind(r.id));
  Dirty.clear();
  const ops = [...S.els.values()].map((e) => ({ id: e.id, v: e.v, by: 'seed', data: clone(e) }));
  S.els = prev.els; S.clock = prev.clock;

  if (Api === Cloud) await Cloud.seed(b.id, ops);
  else Local.saveOps(b.id, ops);
  await new Promise((r) => setTimeout(r, 60));
  return b;
}
