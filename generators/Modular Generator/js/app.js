/* app.js — state, UI wiring, render + export.
   Stroke-only SVG, grouped into one <g> layer per pen colour. */
(function () {
  const { makeRNG, rngHelpers, PALETTE, geom, Modes } = MOD;

  // ---- canvas sizes (mm) ----------------------------------------------------
  const SIZES = {
    a2p: { w: 420, h: 594, label: 'A2 portrait' },
    a2l: { w: 594, h: 420, label: 'A2 landscape' },
    a3p: { w: 297, h: 420, label: 'A3 portrait' },
    a3l: { w: 420, h: 297, label: 'A3 landscape' },
    a4p: { w: 210, h: 297, label: 'A4 portrait' },
    a4l: { w: 297, h: 210, label: 'A4 landscape' },
    sq: { w: 420, h: 420, label: 'Square (420)' },
  };

  // The fixed pen names, used to populate the per-element colour selectors.
  const PEN_NAMES = PALETTE.colors.map((c) => c.name);
  const FIELD_COLOR_OPTS = ['random', ...PEN_NAMES];
  const BAR_COLOR_OPTS = ['darkest', 'random', ...PEN_NAMES];
  const GRID_COLOR_OPTS = ['lightest', 'random', ...PEN_NAMES];

  // ---- per-mode parameter schemas ------------------------------------------
  const SCHEMA = {
    grid: [
      { key: 'cell', label: 'Grid (mm)', min: 4, max: 16, step: 0.5, value: 7 },
      { key: 'gridLineColor', label: 'Grid line colour', type: 'select', value: 'lightest', options: GRID_COLOR_OPTS },
      { key: 'fields', label: 'Checker fields', min: 0, max: 24, step: 1, value: 8 },
      { key: 'fieldSize', label: 'Field size', min: 3, max: 40, step: 1, value: 10 },
      { key: 'fieldOverlap', label: 'Field overlap (0 = none)', min: 0, max: 1, step: 0.05, value: 0.3 },
      { key: 'fieldColor', label: 'Field colour', type: 'select', value: 'random', options: FIELD_COLOR_OPTS },
      { key: 'fillSpacing', label: 'Cell fill spacing (mm)', min: 0.5, max: 4, step: 0.1, value: 1.2 },
      { key: 'bars', label: 'Bold bars', min: 0, max: 24, step: 1, value: 7 },
      { key: 'barThick', label: 'Bar thickness', min: 1, max: 6, step: 1, value: 1 },
      { key: 'barClearance', label: 'Bar–field gap (cells, 0 = overlap)', min: 0, max: 6, step: 1, value: 0 },
      { key: 'barColor', label: 'Bar colour', type: 'select', value: 'darkest', options: BAR_COLOR_OPTS },
      { key: 'accentLines', label: 'Accent lines', min: 0, max: 40, step: 1, value: 12 },
      { key: 'accentColor', label: 'Accent colour', type: 'select', value: 'random', options: FIELD_COLOR_OPTS },
    ],
    motif: [
      { key: 'cell', label: 'Cell (mm)', min: 8, max: 44, step: 1, value: 17 },
      { key: 'accent', label: 'Accent chance', min: 0, max: 0.45, step: 0.01, value: 0.1 },
      { key: 'blank', label: 'Bare chance', min: 0, max: 0.7, step: 0.01, value: 0.12 },
      { key: 'motif', label: 'Motif', type: 'select', value: 'plus',
        options: ['plus', 'ring', 'diamond', 'x', 'dot', 'square'] },
    ],
  };

  const MODE_LABELS = {
    grid: 'Grid Composition',
    motif: 'Motif Grid',
  };

  // ---- state ----------------------------------------------------------------
  const state = {
    mode: 'grid',
    sizeId: 'a2p',
    margin: 16,
    strokeW: 0.4,
    detail: 4.5,
    seed: 137042,
    paper: '#ECE4D6',
    baseIndex: 2,
    colors: [],
    params: {},
    hidden: new Set(),
    lastStrokes: [],
  };

  // initialise params from schema defaults
  for (const m in SCHEMA) {
    state.params[m] = {};
    for (const c of SCHEMA[m]) state.params[m][c.key] = c.value;
  }

  function loadPalette() {
    state.paper = PALETTE.paper;
    state.baseIndex = PALETTE.baseIndex;
    state.colors = PALETTE.colors.map((c) => ({ name: c.name, hex: c.hex, active: true }));
  }
  loadPalette();

  function activeColors() {
    const a = state.colors.filter((c) => c.active).map((c) => c.hex);
    return a.length ? a : ['#1B1B19'];
  }
  function basePen() {
    const c = state.colors[state.baseIndex];
    if (c && c.active) return c.hex;
    return activeColors()[0];
  }
  function lightestActive() {
    return activeColors().slice().sort((a, b) => geom.lum(b) - geom.lum(a))[0];
  }
  function darkestActive() {
    return activeColors().slice().sort((a, b) => geom.lum(a) - geom.lum(b))[0];
  }

  // ---- rendering ------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  let renderTimer = null;

  function buildContext() {
    const rh = rngHelpers(makeRNG(state.seed));
    const colors = activeColors();
    const ctx = {
      rh,
      colors,
      base: basePen(),
      gridColor: lightestActive(),
      barColor: darkestActive(),
      strokeW: state.strokeW,
      unit: state.detail,
      solidSpacing: Math.max(0.7, state.strokeW * 1.8),
      params: state.params[state.mode],
    };
    // resolve a colour-selector value to a hex:
    //   'random' → a random active pen · 'darkest'/'lightest' → by luminance ·
    //   a pen name → that exact pen (used even if toggled off, so the choice is honoured)
    ctx.resolvePen = (sel) => {
      if (!sel || sel === 'random') return rh.pick(colors);
      if (sel === 'darkest') return ctx.barColor;
      if (sel === 'lightest') return ctx.gridColor;
      const found = PALETTE.colors.find((c) => c.name === sel);
      return found ? found.hex : rh.pick(colors);
    };
    return ctx;
  }

  function generate() {
    const size = SIZES[state.sizeId];
    const m = state.margin;
    const area = { x: m, y: m, w: size.w - 2 * m, h: size.h - 2 * m };
    const ctx = buildContext();
    state.lastStrokes = Modes[state.mode](area, ctx) || [];
    renderPreview();
    renderLegend();
  }

  function groupByColor(strokes) {
    const order = state.colors.map((c) => c.hex);
    const map = new Map();
    for (const s of strokes) {
      if (!map.has(s.color)) map.set(s.color, []);
      map.get(s.color).push(s.d);
    }
    // emit in palette order, then any extras
    const keys = [...map.keys()].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map((color) => ({ color, ds: map.get(color) }));
  }

  function layersMarkup(groups, forExport) {
    return groups.map((g, i) => {
      const hide = !forExport && state.hidden.has(g.color) ? ' style="display:none"' : '';
      const name = (state.colors.find((c) => c.hex === g.color) || {}).name || `c${i}`;
      const paths = g.ds.map((d) => `<path d="${d}"/>`).join('');
      return `<g id="layer-${i}-${name}" data-color="${g.color}" stroke="${g.color}" fill="none" ` +
        `stroke-width="${state.strokeW}" stroke-linecap="round" stroke-linejoin="round"${hide}>${paths}</g>`;
    }).join('\n');
  }

  function renderPreview() {
    const size = SIZES[state.sizeId];
    const svg = $('artboard');
    svg.setAttribute('width', size.w + 'mm');
    svg.setAttribute('height', size.h + 'mm');
    svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    svg.innerHTML = layersMarkup(groupByColor(state.lastStrokes), false);
    $('paper').style.background = state.paper;
  }

  function buildSVG() {
    const size = SIZES[state.sizeId];
    const groups = groupByColor(state.lastStrokes);
    const desc = `Modular Generator — mode=${state.mode} size=${state.sizeId} seed=${state.seed} ` +
      `palette=fixed10 stroke=${state.strokeW}mm pens=${groups.length}`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}mm" height="${size.h}mm" ` +
      `viewBox="0 0 ${size.w} ${size.h}">\n<desc>${desc}</desc>\n` +
      layersMarkup(groups, true) + `\n</svg>\n`;
  }

  function exportSVG() {
    const name = ($('filename').value || 'modular').replace(/[^\w\-]+/g, '_');
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_${state.mode}_seed${state.seed}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- UI construction ------------------------------------------------------
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (kids) kids.forEach((c) => e.appendChild(c));
    return e;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(generate, 160);
  }

  function buildModeTabs() {
    const wrap = $('mode-tabs');
    wrap.innerHTML = '';
    for (const id in MODE_LABELS) {
      const b = el('button', { class: 'tab' + (id === state.mode ? ' active' : ''), text: MODE_LABELS[id] });
      b.onclick = () => {
        state.mode = id;
        [...wrap.children].forEach((c) => c.classList.remove('active'));
        b.classList.add('active');
        buildModeParams();
        generate();
      };
      wrap.appendChild(b);
    }
  }

  function buildModeParams() {
    const wrap = $('mode-params');
    wrap.innerHTML = '';
    for (const c of SCHEMA[state.mode]) {
      const cur = state.params[state.mode][c.key];
      const row = el('div', { class: 'field' });
      if (c.type === 'check') {
        const lab = el('label', { class: 'checkrow' });
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!cur;
        cb.onchange = () => { state.params[state.mode][c.key] = cb.checked; scheduleRender(); };
        lab.appendChild(cb);
        lab.appendChild(el('span', { text: c.label }));
        row.appendChild(lab);
      } else if (c.type === 'select') {
        row.appendChild(el('label', { text: c.label }));
        const sel = el('select');
        c.options.forEach((o) => {
          const opt = el('option', { value: o, text: o });
          if (o === cur) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { state.params[state.mode][c.key] = sel.value; scheduleRender(); };
        row.appendChild(sel);
      } else {
        const head = el('label');
        head.textContent = c.label;
        const out = el('output', { text: String(cur) });
        head.appendChild(out);
        row.appendChild(head);
        const sl = el('input', { type: 'range', min: c.min, max: c.max, step: c.step });
        sl.value = cur;
        sl.oninput = () => {
          const v = parseFloat(sl.value);
          state.params[state.mode][c.key] = v;
          out.textContent = String(v);
          scheduleRender();
        };
        row.appendChild(sl);
      }
      wrap.appendChild(row);
    }
  }

  function buildSizeSelect() {
    const sel = $('size');
    sel.innerHTML = '';
    for (const id in SIZES) {
      const o = el('option', { value: id, text: SIZES[id].label });
      if (id === state.sizeId) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { state.sizeId = sel.value; generate(); };
  }

  function buildPaletteUI() {
    buildSwatches();
  }

  // Fixed 10-pen palette: colours are not editable. Clicking a swatch only
  // includes / excludes that pen from the current composition.
  function buildSwatches() {
    const wrap = $('swatches');
    wrap.innerHTML = '';
    state.colors.forEach((c) => {
      const sw = el('button', { class: 'swatch' + (c.active ? '' : ' off'),
        title: c.name + (c.active ? ' — on' : ' — off') });
      sw.style.background = c.hex;
      const tog = el('span', { class: 'tog' });
      tog.textContent = c.active ? '●' : '○';
      sw.appendChild(tog);
      sw.onclick = () => {
        c.active = !c.active;
        sw.classList.toggle('off', !c.active);
        tog.textContent = c.active ? '●' : '○';
        sw.title = c.name + (c.active ? ' — on' : ' — off');
        generate();
      };
      wrap.appendChild(sw);
    });
  }

  function renderLegend() {
    const wrap = $('legend');
    wrap.innerHTML = '';
    const groups = groupByColor(state.lastStrokes);
    let total = 0;
    groups.forEach((g) => (total += g.ds.length));
    $('count').textContent = `${total.toLocaleString()} strokes · ${groups.length} pens`;
    groups.forEach((g) => {
      const name = (state.colors.find((c) => c.hex === g.color) || {}).name || g.color;
      const row = el('label', { class: 'legend-row' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = !state.hidden.has(g.color);
      cb.onchange = () => {
        if (cb.checked) state.hidden.delete(g.color);
        else state.hidden.add(g.color);
        const node = $('artboard').querySelector(`g[data-color="${g.color}"]`);
        if (node) node.style.display = cb.checked ? '' : 'none';
      };
      const chip = el('span', { class: 'chip' });
      chip.style.background = g.color;
      row.appendChild(cb);
      row.appendChild(chip);
      row.appendChild(el('span', { class: 'legend-name', text: `${name} · ${g.ds.length}` }));
      wrap.appendChild(row);
    });
    $('warn').style.display = total > 26000 ? 'block' : 'none';
  }

  // ---- shared controls + actions -------------------------------------------
  function wireShared() {
    const mg = $('margin'), mgOut = $('margin-val');
    mg.value = state.margin; mgOut.textContent = state.margin;
    mg.oninput = () => { state.margin = parseFloat(mg.value); mgOut.textContent = mg.value; scheduleRender(); };

    const sw = $('stroke'), swOut = $('stroke-val');
    sw.value = state.strokeW; swOut.textContent = state.strokeW;
    sw.oninput = () => { state.strokeW = parseFloat(sw.value); swOut.textContent = sw.value; scheduleRender(); };

    const dt = $('detail'), dtOut = $('detail-val');
    dt.value = state.detail; dtOut.textContent = state.detail;
    dt.oninput = () => { state.detail = parseFloat(dt.value); dtOut.textContent = dt.value; scheduleRender(); };

    const seed = $('seed');
    seed.value = state.seed;
    seed.onchange = () => { state.seed = parseInt(seed.value, 10) || 0; generate(); };

    $('randomize').onclick = () => {
      state.seed = Math.floor(Math.random() * 1e9);
      seed.value = state.seed;
      generate();
    };
    $('regenerate').onclick = generate;
    $('export').onclick = exportSVG;
  }

  // ---- init -----------------------------------------------------------------
  function init() {
    buildModeTabs();
    buildModeParams();
    buildSizeSelect();
    buildPaletteUI();
    wireShared();
    generate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
