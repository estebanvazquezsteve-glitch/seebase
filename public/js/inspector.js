'use strict';
/* Panel de propiedades y editor de gradientes */
const inspEl = $('#insp');
let _inspTimer = 0, _ctl = 0, _inspBusy = false;
const _secOpen = LS.get('insp.sections', {});

addEventListener('pointerup', () => { _inspBusy = false; }, true);
addEventListener('pointercancel', () => { _inspBusy = false; }, true);

function renderInspectorSoon() { clearTimeout(_inspTimer); _inspTimer = setTimeout(renderInspector, 30); }

function section(title, body, { open = true, key = title } = {}) {
  const isOpen = _secOpen[key] ?? open;
  const sec = h('section', { class: 'sec' + (isOpen ? ' open' : '') },
    h('button', { class: 'sec-h', type: 'button', 'aria-expanded': String(isOpen), onclick() {
      const o = !sec.classList.contains('open');
      sec.classList.toggle('open', o); this.setAttribute('aria-expanded', String(o));
      _secOpen[key] = o; LS.set('insp.sections', _secOpen);
    } }, h('span', {}, title), icon('chevD', 14)),
    h('div', { class: 'sec-b' }, body));
  return sec;
}

function slider({ label, value, min, max, step = 1, unit = '', onInput }) {
  const id = 'ctl-' + _ctl++;
  const pct = (v) => ((v - min) / (max - min)) * 100 + '%';
  const out = h('output', { class: 'mono', for: id }, round2(value) + unit);
  const inp = h('input', { type: 'range', id, min, max, step, value, style: { '--p': pct(value) },
    onpointerdown() { _inspBusy = true; },
    onpointerup() { _inspBusy = false; },
    oninput() { const v = +this.value; this.style.setProperty('--p', pct(v)); out.textContent = round2(v) + unit; onInput(v); } });
  return h('div', { class: 'row sl' }, h('label', { for: id }, label), inp, out);
}

function seg(options, value, onChange, cls = '') {
  const root = h('div', { class: 'seg ' + cls, role: 'group' });
  for (const o of options) {
    root.append(h('button', { type: 'button', class: o.v === value ? 'on' : '', title: o.t || o.l, 'aria-label': o.t || o.l, 'aria-pressed': String(o.v === value), onclick() {
      [...root.children].forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
      this.classList.add('on'); this.setAttribute('aria-pressed', 'true');
      onChange(o.v);
    } }, o.i ? icon(o.i, 16) : o.g || o.l));
  }
  return root;
}

function numField(label, value, onChange, { step = 1, min = -1e7, max = 1e7, unit } = {}) {
  const id = 'ctl-' + _ctl++;
  const input = h('input', { id, class: 'mono', type: 'number', step, min, max, value: round2(value), onchange() { const v = clamp(+this.value || 0, min, max); onChange(v); } });
  return h('div', { class: 'nf', title: unit || '' }, h('label', { for: id }, label), input);
}

function toggle(label, value, onChange) {
  const id = 'ctl-' + _ctl++;
  return h('label', { class: 'row tog', for: id }, h('span', {}, label), h('input', { id, type: 'checkbox', role: 'switch', checked: value || null, onchange() { onChange(this.checked); } }), h('i', {}));
}

function choose(label, options, value, onChange) {
  const id = 'ctl-' + _ctl++;
  return h('div', { class: 'row' }, h('label', { for: id }, label),
    h('select', { id, class: 'select', onchange() { onChange(this.value); } }, options.map(([v, l]) => h('option', { value: v, selected: v === value || null }, l))));
}

function textField(label, value, onChange, { placeholder = '', id } = {}) {
  const fid = id || 'ctl-' + _ctl++;
  return h('div', { class: 'row col' }, h('label', { for: fid }, label),
    h('input', { id: fid, class: 'input', value: value || '', placeholder, oninput() { onChange(this.value); } }));
}

function startInspectorFocus(id) { setTimeout(() => { const f = document.getElementById(id); f?.focus(); f?.select?.(); }, 40); }

/* ---------- Selector de color ---------- */
let _cpOpen = false;
function ColorPicker({ get, set, alpha = true }) {
  const c0 = get();
  let [H, Sa, V] = rgb2hsv(...hex2rgb(c0.c));
  let A = c0.a ?? 1;
  const emit = () => set({ c: rgb2hex(...hsv2rgb(H, Sa, V)), a: A });
  const dot = h('i', {});
  const area = h('div', { class: 'cp-area' }, dot);
  const paintArea = () => {
    area.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${H} 100% 50%))`;
    dot.style.left = Sa * 100 + '%'; dot.style.top = (1 - V) * 100 + '%';
    dot.style.background = rgb2hex(...hsv2rgb(H, Sa, V));
  };
  const hex = h('input', { class: 'input mono cp-hex', 'aria-label': 'Color hexadecimal', value: c0.c, onchange() {
    if (!/^#?[0-9a-f]{3,6}$/i.test(this.value)) return;
    [H, Sa, V] = rgb2hsv(...hex2rgb(this.value)); paintArea(); emit();
  } });
  const sync = () => { hex.value = rgb2hex(...hsv2rgb(H, Sa, V)); };
  const drag = (e) => {
    const r = area.getBoundingClientRect();
    Sa = clamp((e.clientX - r.left) / r.width, 0, 1);
    V = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
    paintArea(); sync(); emit();
  };
  area.addEventListener('pointerdown', (e) => {
    area.setPointerCapture(e.pointerId); _inspBusy = true; drag(e);
    area.onpointermove = drag;
    area.onpointerup = () => { area.onpointermove = null; _inspBusy = false; };
  });
  paintArea();
  const hue = h('input', { type: 'range', class: 'cp-hue', 'aria-label': 'Tono', min: 0, max: 360, value: H, oninput() { H = +this.value; paintArea(); sync(); emit(); } });
  const al = alpha && h('input', { type: 'range', class: 'cp-alpha', 'aria-label': 'Opacidad', min: 0, max: 100, value: Math.round(A * 100), oninput() { A = +this.value / 100; emit(); } });
  const sw = h('div', { class: 'swatches' }, SWATCHES.map((c) => h('button', { type: 'button', style: { background: c }, title: c, 'aria-label': 'Color ' + c, onclick() { [H, Sa, V] = rgb2hsv(...hex2rgb(c)); hue.value = H; paintArea(); sync(); emit(); } })));
  const fine = h('div', { class: 'cp-fine', hidden: !_cpOpen }, area, hue, al);
  const more = h('button', { type: 'button', class: 'more-link', 'aria-expanded': String(_cpOpen), onclick() { _cpOpen = !_cpOpen; fine.hidden = !_cpOpen; this.textContent = _cpOpen ? 'Ocultar selector' : 'Color personalizado'; this.setAttribute('aria-expanded', String(_cpOpen)); } }, _cpOpen ? 'Ocultar selector' : 'Color personalizado');
  return h('div', { class: 'cp' }, sw, h('div', { class: 'cp-row' }, hex, more), fine);
}

/* ---------- Editor de pinturas ---------- */
function PaintEditor({ get, set, types = ['solid', 'linear', 'radial', 'none'], presets = true }) {
  const root = h('div', { class: 'pe' });
  let active = 0, showAll = false;
  const NAMES = { solid: 'Sólido', linear: 'Lineal', radial: 'Radial', none: 'Nada' };

  function convert(to) {
    const p = get();
    if (to === 'none') return NONE;
    const stops = p.s || null;
    const base = p.c || stops?.[0]?.c || '#3a3c42';
    if (to === 'solid') return solid(base, p.a ?? stops?.[0]?.a);
    const [r, g, b] = hex2rgb(base);
    const st = stops || [{ o: 0, c: base }, { o: 1, c: rgb2hex(r * 0.32, g * 0.32, b * 0.34) }];
    return to === 'linear' ? { t: 'linear', a: p.a && p.t === 'linear' ? p.a : 145, s: st, g: p.g ?? 0.3 } : { t: 'radial', x: p.x ?? 0.3, y: p.y ?? 0.2, s: st, g: p.g ?? 0.3 };
  }

  function presetGrid() {
    const list = showAll ? GRADIENTS : GRADIENTS.slice(0, 12);
    const cur = JSON.stringify(get().s || null);
    return h('div', {}, h('div', { class: 'gt-grid' }, list.map((g) => h('button', {
      type: 'button', class: 'gt' + (cur === JSON.stringify(g.p.s) ? ' on' : ''), title: g.n, 'aria-label': 'Gradiente ' + g.n,
      style: { background: paintCSS(g.p) }, onclick() { set(clone(g.p)); active = 0; render(); },
    }))),
    h('button', { class: 'more-link', type: 'button', onclick() { showAll = !showAll; render(); } }, showAll ? 'Ver menos' : `Ver los ${GRADIENTS.length}`));
  }

  function stopBar(p) {
    const css = () => `linear-gradient(90deg,${p.s.slice().sort((a, b) => a.o - b.o).map((s) => `${stopColor(s)} ${s.o * 100}%`).join(',')})`;
    const bar = h('div', { class: 'stopbar', style: { background: css() } });
    bar.addEventListener('pointerdown', (e) => {
      if (e.target !== bar) return;
      const r = bar.getBoundingClientRect(), o = clamp((e.clientX - r.left) / r.width, 0, 1);
      const sorted = p.s.slice().sort((a, b) => a.o - b.o);
      const next = sorted.find((s) => s.o >= o) || sorted[sorted.length - 1];
      const prev = sorted.slice().reverse().find((s) => s.o <= o) || sorted[0];
      const t = next === prev ? 0 : (o - prev.o) / (next.o - prev.o);
      const ca = hex2rgb(prev.c), cb = hex2rgb(next.c);
      p.s.push({ o, c: rgb2hex(lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)) });
      active = p.s.length - 1;
      set(clone(p)); render();
    });
    p.s.forEach((s, i) => {
      const hd = h('button', { type: 'button', class: 'stop' + (i === active ? ' on' : ''), 'aria-label': `Parada ${i + 1}`, style: { left: s.o * 100 + '%', background: s.c } });
      hd.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const same = active === i;
        active = i;
        hd.setPointerCapture(e.pointerId);
        _inspBusy = true;
        $$('.stop', bar).forEach((b) => b.classList.remove('on'));
        hd.classList.add('on');
        hd.onpointermove = (ev) => {
          const r = bar.getBoundingClientRect();
          s.o = round2(clamp((ev.clientX - r.left) / r.width, 0, 1));
          hd.style.left = s.o * 100 + '%';
          bar.style.background = css();
          hd._removing = p.s.length > 2 && Math.abs(ev.clientY - r.top) > 46;
          hd.style.opacity = hd._removing ? 0.3 : 1;
          set(clone({ ...p, s: p.s.slice().sort((a, b) => a.o - b.o) }));
        };
        hd.onpointerup = () => {
          hd.onpointermove = null; _inspBusy = false;
          if (hd._removing) { p.s.splice(i, 1); active = 0; }
          const obj = p.s[active];
          p.s.sort((a, b) => a.o - b.o);
          active = Math.max(0, p.s.indexOf(obj));
          set(clone(p)); render();
          void same;
        };
      });
      bar.append(hd);
    });
    return bar;
  }

  function dial(p) {
    const needle = h('i', { style: { transform: `rotate(${p.a}deg)` } });
    const num = h('input', { class: 'mono', type: 'number', 'aria-label': 'Ángulo', min: 0, max: 360, value: Math.round(p.a), onchange() { p.a = clamp(+this.value || 0, 0, 360); needle.style.transform = `rotate(${p.a}deg)`; set(clone(p)); } });
    const d = h('div', { class: 'dial', role: 'slider', 'aria-label': 'Ángulo del gradiente', 'aria-valuenow': p.a }, needle);
    d.addEventListener('pointerdown', (e) => {
      d.setPointerCapture(e.pointerId); _inspBusy = true;
      const mv = (ev) => {
        const r = d.getBoundingClientRect();
        let a = (Math.atan2(ev.clientY - r.top - r.height / 2, ev.clientX - r.left - r.width / 2) * 180) / Math.PI + 90;
        if (a < 0) a += 360;
        a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
        p.a = a; needle.style.transform = `rotate(${a}deg)`; num.value = a; set(clone(p));
      };
      mv(e); d.onpointermove = mv;
      d.onpointerup = () => { d.onpointermove = null; _inspBusy = false; };
    });
    return h('div', { class: 'row' }, h('label', {}, 'Ángulo'), h('div', { class: 'dial-w' }, d, num));
  }

  function pad(p) {
    const dot = h('i', { style: { left: p.x * 100 + '%', top: p.y * 100 + '%' } });
    const box = h('div', { class: 'xy', style: { background: paintCSS(p) }, role: 'slider', 'aria-label': 'Centro de la luz' }, dot);
    box.addEventListener('pointerdown', (e) => {
      box.setPointerCapture(e.pointerId); _inspBusy = true;
      const mv = (ev) => {
        const r = box.getBoundingClientRect();
        p.x = round2(clamp((ev.clientX - r.left) / r.width, -0.2, 1.2));
        p.y = round2(clamp((ev.clientY - r.top) / r.height, -0.2, 1.2));
        dot.style.left = clamp(p.x, 0, 1) * 100 + '%'; dot.style.top = clamp(p.y, 0, 1) * 100 + '%';
        box.style.background = paintCSS(p); set(clone(p));
      };
      mv(e); box.onpointermove = mv;
      box.onpointerup = () => { box.onpointermove = null; _inspBusy = false; };
    });
    return h('div', { class: 'row col' }, h('label', {}, 'Centro de la luz'), box);
  }

  function render() {
    const p = get();
    const kids = [];
    if (types.length > 1) kids.push(seg(types.map((v) => ({ v, l: NAMES[v] })), p.t, (v) => { active = 0; set(convert(v)); render(); }));
    if (p.t !== 'none' && presets) kids.push(presetGrid());
    if (p.t === 'linear' || p.t === 'radial') {
      const q = clone(p);
      kids.push(stopBar(q));
      if (q.t === 'linear') kids.push(dial(q)); else {
        kids.push(pad(q));
        kids.push(slider({ label: 'Alcance', value: q.r || 1, min: 0.3, max: 2, step: 0.05, onInput(v) { q.r = v; set(clone(q)); } }));
      }
      kids.push(slider({ label: 'Grano', value: Math.round((q.g || 0) * 100), min: 0, max: 100, unit: '%', onInput(v) { q.g = v / 100; set(clone(q)); } }));
      active = clamp(active, 0, q.s.length - 1);
      kids.push(ColorPicker({
        get: () => q.s[active],
        set: ({ c, a }) => {
          q.s[active].c = c;
          if (a < 1) q.s[active].a = a; else delete q.s[active].a;
          const bar = root.querySelector('.stopbar');
          if (bar) {
            bar.style.background = `linear-gradient(90deg,${q.s.slice().sort((x, y) => x.o - y.o).map((s) => `${stopColor(s)} ${s.o * 100}%`).join(',')})`;
            const st = $$('.stop', bar)[active]; if (st) st.style.background = c;
          }
          set(clone(q));
        },
      }));
    } else if (p.t === 'solid') {
      kids.push(ColorPicker({ get: () => ({ c: p.c, a: p.a }), set: ({ c, a }) => set(a < 1 ? solid(c, a) : solid(c)) }));
    }
    root.replaceChildren(...kids);
  }
  render();
  return root;
}

/* ---------- Secciones del panel ---------- */
const TYPE_NAMES = { shape: 'Forma', sticky: 'Nota', text: 'Texto', image: 'Foto', frame: 'Marco', line: 'Conector', draw: 'Trazo', mind: 'Idea', table: 'Tabla', check: 'Lista de tareas', link: 'Enlace' };
const TYPE_ICONS = { shape: 'shapes', sticky: 'sticky', text: 'text', image: 'image', frame: 'frame', line: 'line', draw: 'pen', mind: 'mind', table: 'table', check: 'check', link: 'link' };
const LOOKS = [
  { id: 'natural', n: 'Natural', fx: {}, ov: null },
  { id: 'noir', n: 'Noir', fx: { g: 100, c: 125, b: 92, v: 45 }, ov: null },
  { id: 'teal', n: 'Teal y ámbar', fx: { c: 112, s: 86, v: 30 }, ov: { p: { t: 'linear', a: 125, s: [{ o: 0, c: '#14565f' }, { o: 1, c: '#c8824a' }] }, o: 0.42, m: 'soft-light' } },
  { id: 'fade', n: 'Deslavado', fx: { c: 82, b: 108, s: 72, v: 10 }, ov: null },
  { id: 'night', n: 'Noche', fx: { b: 70, c: 116, s: 70, w: -34, v: 56 }, ov: null },
  { id: 'tungsten', n: 'Tungsteno', fx: { b: 94, c: 108, s: 88, w: 40, v: 40 }, ov: null },
  { id: 'bleach', n: 'Bleach', fx: { s: 44, c: 136, b: 96, v: 26 }, ov: null },
  { id: 'fall', n: 'Caída a negro', fx: { c: 106, v: 24 }, ov: { p: { t: 'linear', a: 180, s: [{ o: 0.35, c: '#000000', a: 0 }, { o: 1, c: '#000000', a: 0.92 }] }, o: 1, m: 'normal' } },
];
const RATIOS = [['Libre', null], ['1:1', 1], ['4:5', 0.8], ['4:3', 4 / 3], ['16:9', 16 / 9], ['2.39:1', 2.39]];

function renderInspector() {
  if (!S.boardId || _inspBusy) return;
  if (isTyping() && inspEl.contains(document.activeElement)) return;
  const sel = selEls().filter((e) => e.type !== 'comment');
  _ctl = 0;
  let content;
  if (!sel.length) content = boardPanel();
  else if (sel.length === 1) content = singlePanel(sel[0]);
  else content = multiPanel(sel);
  inspEl.replaceChildren(h('div', { class: 'insp-scroll' }, content));
}

function insHead(ic, title, sub, actions) {
  return h('header', { class: 'ins-head' }, h('div', { class: 'ins-ic' }, icon(ic, 17)), h('div', { class: 'ins-t' }, h('b', {}, title), sub && h('span', {}, sub)), h('div', { class: 'ins-a' }, actions));
}

const _ids = () => selEls().map((e) => e.id);
const setAll = (fn, key) => mutate(_ids(), fn, { key });

function secFill(key = 'fill', title = 'Relleno', types, open = true) {
  const first = selEls().find((e) => e[key]);
  return section(title, PaintEditor({
    types,
    get: () => selEls().find((e) => e[key])?.[key] || first?.[key] || NONE,
    set: (p) => setAll((e) => { if (e.type !== 'image' || key !== 'fill') e[key] = clone(p); }, key),
  }), { key: 'sec-' + key + title, open });
}

function secBorder(open = false) {
  const e = selEls()[0];
  return section('Borde', [
    PaintEditor({ types: ['solid', 'linear', 'none'], presets: false, get: () => selEls()[0].stroke || NONE, set: (p) => setAll((x) => { x.stroke = clone(p); if (p.t !== 'none' && !x.sw) x.sw = 1; }, 'stroke') }),
    slider({ label: 'Grosor', value: e.sw ?? 0, min: 0, max: 24, step: 0.5, unit: ' px', onInput: (v) => setAll((x) => { x.sw = v; }, 'sw') }),
    h('div', { class: 'row' }, h('label', {}, 'Trazo'), seg([{ v: 'solid', l: 'Continuo' }, { v: 'dash', l: 'Rayas' }, { v: 'dot', l: 'Puntos' }], e.dash || 'solid', (v) => setAll((x) => { x.dash = v; }))),
  ], { key: 'sec-border', open });
}

function secEffects(open = false) {
  const e = selEls()[0];
  const rows = [slider({ label: 'Opacidad', value: Math.round((e.opa ?? 1) * 100), min: 5, max: 100, unit: '%', onInput: (v) => setAll((x) => { x.opa = v / 100; }, 'opa') })];
  rows.push(toggle('Sombra', !!e.shadow, (v) => { setAll((x) => { if (v) x.shadow = { b: 34, y: 18, c: '#000000', a: 0.55 }; else delete x.shadow; }); renderInspector(); }));
  if (e.shadow) {
    rows.push(slider({ label: 'Difusión', value: e.shadow.b, min: 0, max: 120, onInput: (v) => setAll((x) => { if (x.shadow) x.shadow.b = v; }, 'sh') }));
    rows.push(slider({ label: 'Altura', value: e.shadow.y, min: -40, max: 80, onInput: (v) => setAll((x) => { if (x.shadow) x.shadow.y = v; }, 'sh') }));
    rows.push(slider({ label: 'Fuerza', value: Math.round(e.shadow.a * 100), min: 0, max: 100, unit: '%', onInput: (v) => setAll((x) => { if (x.shadow) x.shadow.a = v / 100; }, 'sh') }));
  }
  rows.push(toggle('Resplandor', !!e.glow, (v) => { setAll((x) => { if (v) x.glow = { b: 36, c: '#d9bd94', a: 0.35 }; else delete x.glow; }); renderInspector(); }));
  if (e.glow) {
    rows.push(slider({ label: 'Alcance', value: e.glow.b, min: 2, max: 140, onInput: (v) => setAll((x) => { if (x.glow) x.glow.b = v; }, 'gl') }));
    rows.push(slider({ label: 'Fuerza', value: Math.round(e.glow.a * 100), min: 0, max: 100, unit: '%', onInput: (v) => setAll((x) => { if (x.glow) x.glow.a = v / 100; }, 'gl') }));
    rows.push(h('div', { class: 'swatches' }, SWATCHES.slice(0, 18).map((c) => h('button', { type: 'button', style: { background: c }, 'aria-label': 'Color ' + c, onclick: () => setAll((x) => { if (x.glow) x.glow.c = c; }) }))));
  }
  return section('Efectos', rows, { key: 'sec-fx', open });
}

function secGeom(e) {
  const f = (k, l, opt) => numField(l, e[k] || 0, (v) => mutate([e.id], (x) => { x[k] = v; }, { key: 'g' + k }), opt);
  const locked = e.type === 'mind';
  return section('Posición y tamaño', h('div', { class: 'nf-grid' }, f('x', 'X'), f('y', 'Y'), !locked && f('w', 'An', { min: 10 }), !locked && f('h', 'Al', { min: 10 }), !locked && f('r', '°', { min: -360, max: 360 })), { key: 'sec-geom' });
}

function secText(e, { color = true } = {}) {
  const rows = [
    choose('Fuente', FONTS.map((f) => [f[0], f[0]]), e.font, (v) => setAll((x) => { x.font = v; if (x.type === 'mind') layoutMind(mindRootOf(x).id); })),
  ];
  if (e.type === 'sticky') rows.push(toggle('Ajustar tamaño solo', e.autofit, (v) => { setAll((x) => { x.autofit = v; }); renderInspector(); }));
  if (!e.autofit) rows.push(slider({ label: 'Tamaño', value: e.size || 16, min: 8, max: 160, onInput: (v) => { setAll((x) => { x.size = v; if (x.type === 'mind') layoutMind(mindRootOf(x).id); if (x.type === 'text') fitTextBox(x); }, 'size'); } }));
  rows.push(h('div', { class: 'row' }, h('label', {}, 'Peso'), seg([{ v: 300, l: 'Fina' }, { v: 500, l: 'Media' }, { v: 700, l: 'Fuerte' }], e.weight, (v) => setAll((x) => { x.weight = v; if (x.type === 'text') fitTextBox(x); }))));
  rows.push(h('div', { class: 'row tools' },
    h('div', { class: 'seg' },
      h('button', { type: 'button', class: e.italic ? 'on' : '', title: 'Cursiva', 'aria-label': 'Cursiva', onclick() { this.classList.toggle('on'); setAll((x) => { x.italic = !x.italic; }); } }, icon('italic', 16)),
      h('button', { type: 'button', class: e.underline ? 'on' : '', title: 'Subrayado', 'aria-label': 'Subrayado', onclick() { this.classList.toggle('on'); setAll((x) => { x.underline = !x.underline; }); } }, icon('underline', 16))),
    e.type !== 'mind' && seg([{ v: 'left', i: 'tL', t: 'Izquierda' }, { v: 'center', i: 'tC', t: 'Centro' }, { v: 'right', i: 'tR', t: 'Derecha' }], e.align, (v) => setAll((x) => { x.align = v; })),
    e.type !== 'text' && e.type !== 'mind' && seg([{ v: 'top', i: 'vT', t: 'Arriba' }, { v: 'middle', i: 'vM', t: 'Medio' }, { v: 'bottom', i: 'vB', t: 'Abajo' }], e.valign, (v) => setAll((x) => { x.valign = v; }))));
  rows.push(slider({ label: 'Espaciado', value: Math.round((e.track || 0) * 100), min: -5, max: 40, unit: '', onInput: (v) => setAll((x) => { x.track = v / 100; }, 'track') }));
  if (color) rows.push(h('div', { class: 'sub' }, h('span', { class: 'sub-l' }, 'Color del texto'), PaintEditor({ types: ['solid', 'linear'], presets: e.type === 'text', get: () => selEls()[0].color || solid('#ece8e1'), set: (p) => setAll((x) => { x.color = clone(p); }, 'color') })));
  return section('Texto', rows, { key: 'sec-text', open: e.type === 'text' });
}
function fitTextBox(x) {
  if (x.auto) { const m = textMetrics(x, 4000); x.w = Math.ceil(m.w) + 8; x.h = Math.ceil(m.h) + 2; }
  else x.h = Math.ceil(textMetrics(x, x.w).h) + 2;
}

function maskGrid(e, list, key, onPick) {
  return h('div', { class: 'mask-grid' }, list.map((k) => h('button', { type: 'button', class: e[key] === k ? 'on' : '', title: SHAPES[k].n, 'aria-label': SHAPES[k].n, onclick(ev) {
    $$('button', ev.currentTarget.parentNode).forEach((b) => b.classList.remove('on'));
    ev.currentTarget.classList.add('on');
    onPick(k);
  } }, shapeThumb(k))));
}

function headActions(e) {
  return [
    btn('copy', 'Duplicar', duplicateSel),
    btn(e.locked ? 'unlock' : 'lock', e.locked ? 'Desbloquear' : 'Bloquear', toggleLock),
    btn('trash', 'Eliminar', deleteSel),
  ];
}

function singlePanel(e) {
  const kids = [insHead(TYPE_ICONS[e.type], TYPE_NAMES[e.type], e.locked ? 'Bloqueado' : e.group ? 'En un grupo' : null, headActions(e))];
  switch (e.type) {
    case 'shape':
      kids.push(section('Forma', [maskGrid(e, SHAPE_ORDER, 'kind', (k) => setAll((x) => { x.kind = k; })),
        slider({ label: 'Esquinas', value: e.rad || 0, min: 0, max: 80, onInput: (v) => setAll((x) => { x.rad = v; }, 'rad') })], { key: 'sec-kind' }));
      kids.push(secFill(), secText(e), secBorder(), secEffects(), secGeom(e));
      break;
    case 'sticky': kids.push(secFill(), secText(e), secBorder(), secEffects(), secGeom(e)); break;
    case 'text': kids.push(secText(e), secFill('fill', 'Fondo', undefined, false), secEffects(), secGeom(e)); break;
    case 'image': kids.push(...imageSections(e), secGeom(e)); break;
    case 'frame':
      kids.push(section('Marco', [
        textField('Nombre', e.name, (v) => setAll((x) => { x.name = v; }, 'name')),
        h('button', { class: 'btn wide', type: 'button', onclick: () => Present.start(Present.frames().findIndex((f) => f.id === e.id)) }, icon('play', 15), 'Presentar desde aquí'),
      ], { key: 'sec-frame' }));
      kids.push(secFill('fill', 'Fondo'), secBorder(), secGeom(e));
      break;
    case 'line': kids.push(...lineSections(e)); break;
    case 'draw':
      kids.push(section('Trazo', [PaintEditor({ types: ['solid', 'linear'], get: () => selEls()[0].stroke, set: (p) => setAll((x) => { x.stroke = clone(p); }, 'stroke') }),
        slider({ label: 'Grosor', value: e.sw, min: 1, max: 40, step: 0.5, unit: ' px', onInput: (v) => setAll((x) => { x.sw = v; }, 'sw') })], { key: 'sec-draw' }));
      kids.push(secEffects(), secGeom(e));
      break;
    case 'mind': kids.push(...mindSections(e), secGeom(e)); break;
    case 'table': kids.push(...tableSections(e), secGeom(e)); break;
    case 'check':
      kids.push(section('Lista', [textField('Título', e.title, (v) => setAll((x) => { x.title = v; }, 'title')), h('p', { class: 'hint' }, 'Doble clic para editar las tareas. Cada línea es una tarea.')], { key: 'sec-chk' }));
      kids.push(secFill(), secBorder(), secGeom(e));
      break;
    case 'link':
      kids.push(section('Enlace', [
        textField('Título', e.title, (v) => setAll((x) => { x.title = v; }, 'title')),
        textField('Dirección', e.url, (v) => setAll((x) => { x.url = v; }, 'url'), { placeholder: 'https://', id: 'link-url' }),
      ], { key: 'sec-lnk' }));
      kids.push(secFill(), secBorder(), secGeom(e));
      break;
  }
  return kids;
}

function imageSections(e) {
  const setFx = (patch, key) => setAll((x) => { x.fx = { ...(x.fx || {}), ...patch }; x.look = 'custom'; }, key);
  const fx = e.fx || {};
  const url = Assets.url(e);
  const lookTile = (l) => h('button', { type: 'button', class: 'look' + (e.look === l.id ? ' on' : ''), onclick() {
    setAll((x) => { x.fx = { ...l.fx }; x.ov = clone(l.ov); x.look = l.id; });
    renderInspector();
  } }, h('span', { class: 'look-im' }, url ? h('img', { src: url, alt: '', style: { filter: imgFilter(l.fx) } }) : null), h('span', {}, l.n));
  const ratioBtn = ([label, r]) => h('button', { type: 'button', class: 'chip', onclick() {
    if (r == null) return;
    setAll((x) => { const cx = x.x + x.w / 2, cy = x.y + x.h / 2, area = x.w * x.h; x.w = Math.sqrt(area * r); x.h = x.w / r; x.x = cx - x.w / 2; x.y = cy - x.h / 2; });
  } }, label);
  return [
    section('Forma de la foto', [
      maskGrid(e, MASK_ORDER, 'mask', (k) => setAll((x) => { x.mask = k; })),
      slider({ label: 'Esquinas', value: e.rad || 0, min: 0, max: 120, onInput: (v) => setAll((x) => { x.rad = v; }, 'rad') }),
    ], { key: 'sec-mask' }),
    section('Encuadre', [
      h('div', { class: 'chips' }, RATIOS.filter((r) => r[1]).map(ratioBtn)),
      h('div', { class: 'row' }, h('label', {}, 'Ajuste'), seg([{ v: 'cover', l: 'Rellenar' }, { v: 'stretch', l: 'Deformar' }], e.fit || 'cover', (v) => setAll((x) => { x.fit = v; }))),
      slider({ label: 'Zoom', value: Math.round((e.zoom || 1) * 100), min: 100, max: 400, unit: '%', onInput: (v) => setAll((x) => { x.zoom = v / 100; }, 'zoom') }),
      h('div', { class: 'row tools' },
        h('button', { class: 'btn', type: 'button', onclick: () => startCrop(e.id) }, icon('crop', 15), 'Recortar'),
        btn('flipH', 'Voltear horizontal', () => setAll((x) => { x.flipH = !x.flipH; })),
        btn('flipV', 'Voltear vertical', () => setAll((x) => { x.flipV = !x.flipV; })),
        h('label', { class: 'btn file', title: 'Cambiar foto' }, 'Cambiar', h('input', { type: 'file', accept: 'image/*', hidden: true, onchange() { if (this.files[0]) replaceImage(e, this.files[0]); } }))),
    ], { key: 'sec-crop' }),
    section('Etalonaje', [
      h('div', { class: 'looks' }, LOOKS.map(lookTile)),
      slider({ label: 'Luz', value: fx.b ?? 100, min: 40, max: 160, onInput: (v) => setFx({ b: v }, 'fxb') }),
      slider({ label: 'Contraste', value: fx.c ?? 100, min: 50, max: 180, onInput: (v) => setFx({ c: v }, 'fxc') }),
      slider({ label: 'Saturación', value: fx.s ?? 100, min: 0, max: 180, onInput: (v) => setFx({ s: v }, 'fxs') }),
      slider({ label: 'Temperatura', value: fx.w ?? 0, min: -80, max: 80, onInput: (v) => setFx({ w: v }, 'fxw') }),
      slider({ label: 'Viñeta', value: fx.v ?? 0, min: 0, max: 100, onInput: (v) => setFx({ v }, 'fxv') }),
      slider({ label: 'Desenfoque', value: fx.bl ?? 0, min: 0, max: 24, step: 0.5, onInput: (v) => setFx({ bl: v }, 'fxbl') }),
    ], { key: 'sec-look' }),
    section('Gradiente sobre la foto', overlayRows(e), { key: 'sec-ov', open: false }),
    secBorder(), secEffects(),
  ];
}
function overlayRows(e) {
  const on = !!e.ov;
  const rows = [toggle('Activar', on, (v) => { setAll((x) => { x.ov = v ? { p: { t: 'linear', a: 180, s: [{ o: 0.3, c: '#000000', a: 0 }, { o: 1, c: '#000000', a: 0.9 }] }, o: 1, m: 'normal' } : null; }); renderInspector(); })];
  if (on) {
    rows.push(PaintEditor({ types: ['linear', 'radial'], get: () => selEls()[0].ov?.p || grad('Ónix'), set: (p) => setAll((x) => { if (x.ov) x.ov.p = clone(p); }, 'ovp') }));
    rows.push(slider({ label: 'Fuerza', value: Math.round((e.ov.o ?? 1) * 100), min: 0, max: 100, unit: '%', onInput: (v) => setAll((x) => { if (x.ov) x.ov.o = v / 100; }, 'ovo') }));
    rows.push(choose('Mezcla', [['normal', 'Normal'], ['soft-light', 'Luz suave'], ['overlay', 'Superponer'], ['multiply', 'Multiplicar'], ['screen', 'Trama']], e.ov.m || 'normal', (v) => setAll((x) => { if (x.ov) x.ov.m = v; })));
  }
  return rows;
}

function capPicker(label, value, onChange) {
  const opts = [['none', 'Nada'], ['arrow', 'Flecha'], ['tri', 'Triángulo'], ['circle', 'Círculo'], ['diamond', 'Rombo'], ['bar', 'Barra']];
  return choose(label, opts, value, onChange);
}
function lineSections(e) {
  return [
    section('Conector', [
      h('div', { class: 'row' }, h('label', {}, 'Ruta'), seg([{ v: 'curve', i: 'routeC', t: 'Curva' }, { v: 'straight', i: 'routeS', t: 'Recta' }, { v: 'elbow', i: 'routeE', t: 'Ángulos' }], e.route, (v) => { S.lineRoute = v; setAll((x) => { x.route = v; }); })),
      capPicker('Inicio', e.capA, (v) => setAll((x) => { x.capA = v; })),
      capPicker('Final', e.capB, (v) => setAll((x) => { x.capB = v; })),
      slider({ label: 'Grosor', value: e.sw, min: 0.5, max: 16, step: 0.5, unit: ' px', onInput: (v) => setAll((x) => { x.sw = v; }, 'sw') }),
      h('div', { class: 'row' }, h('label', {}, 'Trazo'), seg([{ v: 'solid', l: 'Continuo' }, { v: 'dash', l: 'Rayas' }, { v: 'dot', l: 'Puntos' }], e.dash || 'solid', (v) => setAll((x) => { x.dash = v; }))),
      toggle('Flujo animado', e.flow, (v) => setAll((x) => { x.flow = v; })),
      textField('Etiqueta', e.label, (v) => setAll((x) => { x.label = v; }, 'label'), { placeholder: 'Escribe sobre la línea' }),
    ], { key: 'sec-line' }),
    section('Color', PaintEditor({ types: ['solid', 'linear'], get: () => selEls()[0].stroke, set: (p) => setAll((x) => { x.stroke = clone(p); }, 'stroke') }), { key: 'sec-line-c' }),
    secEffects(),
  ];
}
function mindSections(e) {
  const root = mindRootOf(e);
  return [
    section('Mapa mental', [
      h('div', { class: 'row tools' },
        h('button', { class: 'btn', type: 'button', onclick: () => mindAdd(e) }, icon('plus', 15), 'Idea hija'),
        h('button', { class: 'btn', type: 'button', onclick: () => mindSibling(e) }, icon('plus', 15), 'Idea hermana')),
      h('div', { class: 'row col' }, h('label', {}, 'Color de la rama'), h('div', { class: 'swatches' }, BRANCH_COLORS.concat(SWATCHES.slice(0, 4)).map((c) => h('button', { type: 'button', style: { background: c }, 'aria-label': 'Color ' + c, onclick() {
        mutate([e.id, ...mindDescendants(e.id)], (x) => { x.branch = c; });
      } })))),
      h('p', { class: 'hint' }, 'Tab crea una idea hija y Enter una hermana. Arrastra una idea sobre otra para moverla de rama.'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => flyTo(unionBox([root, ...mindDescendants(root.id).map((i) => S.els.get(i))].filter((x) => !x.hidden).map(elBox))) }, icon('fit', 15), 'Ver el mapa completo'),
    ], { key: 'sec-mind' }),
    secFill('fill', 'Relleno de la idea', undefined, !e.parent),
    secText(e),
    secEffects(),
  ];
}
function tableSections(e) {
  const addRow = () => mutate([e.id], (x) => { x.cells.push(x.cells[0].map(() => '')); x.h += x.h / (x.cells.length - 1); });
  const delRow = () => mutate([e.id], (x) => { if (x.cells.length > 1) { x.h -= x.h / x.cells.length; x.cells.pop(); } });
  const addCol = () => mutate([e.id], (x) => { x.w += x.w / x.cells[0].length; x.cells.forEach((r, i) => r.push(i === 0 && x.header ? 'Columna' : '')); });
  const delCol = () => mutate([e.id], (x) => { if (x.cells[0].length > 1) { x.w -= x.w / x.cells[0].length; x.cells.forEach((r) => r.pop()); } });
  const stepper = (label, n, minus, plus) => h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'stepper' }, btn('minus', 'Quitar', () => { minus(); renderInspector(); }), h('span', { class: 'mono' }, n), btn('plus', 'Añadir', () => { plus(); renderInspector(); })));
  return [
    section('Tabla', [stepper('Filas', e.cells.length, delRow, addRow), stepper('Columnas', e.cells[0].length, delCol, addCol),
      toggle('Fila de títulos', e.header, (v) => setAll((x) => { x.header = v; })),
      slider({ label: 'Tamaño', value: e.size, min: 9, max: 36, onInput: (v) => setAll((x) => { x.size = v; }, 'size') })], { key: 'sec-tbl' }),
    secFill(),
  ];
}

function multiPanel(sel) {
  const canFill = sel.some((e) => e.fill && e.type !== 'image');
  const grouped = sel.every((e) => e.group && e.group === sel[0].group);
  return [
    insHead('group', `${sel.length} elementos`, null, [
      btn(grouped ? 'ungroup' : 'group', grouped ? 'Desagrupar' : 'Agrupar', grouped ? ungroupSel : groupSel),
      btn('copy', 'Duplicar', duplicateSel),
      btn('trash', 'Eliminar', deleteSel),
    ]),
    section('Alinear', [
      h('div', { class: 'row tools' },
        h('div', { class: 'seg' }, [['l', 'alignL', 'Izquierda'], ['c', 'alignC', 'Centro'], ['r', 'alignR', 'Derecha']].map(([m, i, t]) => btnSeg(i, t, () => alignSel(m)))),
        h('div', { class: 'seg' }, [['t', 'alignT', 'Arriba'], ['m', 'alignM', 'Medio'], ['b', 'alignB', 'Abajo']].map(([m, i, t]) => btnSeg(i, t, () => alignSel(m))))),
      h('div', { class: 'row tools' },
        h('div', { class: 'seg' }, btnSeg('distH', 'Repartir en horizontal', () => distributeSel('h')), btnSeg('distV', 'Repartir en vertical', () => distributeSel('v'))),
        h('button', { class: 'btn', type: 'button', onclick: tidySel }, icon('grid', 15), 'Ordenar en cuadrícula')),
    ], { key: 'sec-align' }),
    canFill && secFill(),
    section('Efectos', slider({ label: 'Opacidad', value: Math.round((sel[0].opa ?? 1) * 100), min: 5, max: 100, unit: '%', onInput: (v) => setAll((x) => { x.opa = v / 100; }, 'opa') }), { key: 'sec-mfx' }),
  ];
}
const btnSeg = (i, t, fn) => h('button', { type: 'button', title: t, 'aria-label': t, onclick: fn }, icon(i, 16));

function boardPanel() {
  const m = getMeta();
  if (!m) return [];
  const setScene = (fn, key) => mutate(['_meta'], (x) => fn(x.scene), { key });
  const tiles = h('div', { class: 'scene-grid' }, SCENES.map((sc) => h('button', {
    type: 'button', class: 'scene-t' + (m.scene.id === sc.id ? ' on' : ''), style: { background: sceneCSS(sc) }, 'aria-label': 'Escena ' + sc.n,
    onclick(ev) { $$('.scene-t', tiles).forEach((b) => b.classList.remove('on')); ev.currentTarget.classList.add('on'); setScene((s) => { s.id = sc.id; }); },
  }, h('span', {}, sc.n))));
  const counts = allEls().filter((e) => e.type !== 'comment').length;
  return [
    insHead('logo', 'Tablero', `${counts} ${counts === 1 ? 'elemento' : 'elementos'}`, []),
    section('Luz de la escena', [
      tiles,
      slider({ label: 'Intensidad', value: Math.round(m.scene.i * 100), min: 0, max: 200, unit: '%', onInput: (v) => setScene((s) => { s.i = v / 100; }, 'sci') }),
      slider({ label: 'Grano', value: Math.round(m.scene.g * 100), min: 0, max: 100, unit: '%', onInput: (v) => setScene((s) => { s.g = v / 100; }, 'scg') }),
      slider({ label: 'Viñeta', value: Math.round(m.scene.v * 100), min: 0, max: 100, unit: '%', onInput: (v) => setScene((s) => { s.v = v / 100; }, 'scv') }),
      slider({ label: 'Movimiento', value: Math.round(m.scene.m * 100), min: 0, max: 100, unit: '%', onInput: (v) => setScene((s) => { s.m = v / 100; }, 'scm') }),
    ], { key: 'sec-scene' }),
    section('Cuadrícula', [
      h('div', { class: 'row' }, h('label', {}, 'Guía'), seg([{ v: 'dots', l: 'Puntos' }, { v: 'lines', l: 'Líneas' }, { v: 'none', l: 'Nada' }], m.grid.mode, (v) => mutate(['_meta'], (x) => { x.grid.mode = v; }))),
      toggle('Ajustar a la cuadrícula', m.grid.snap, (v) => mutate(['_meta'], (x) => { x.grid.snap = v; })),
    ], { key: 'sec-grid' }),
    section('Atajos', h('button', { class: 'btn wide', type: 'button', onclick: openHelp }, icon('help', 15), 'Ver atajos de teclado'), { key: 'sec-help', open: false }),
  ];
}
