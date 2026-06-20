const DRAWABLE_TAGS = ['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect'];
const DEFAULT_COLORS = ['#e63946', '#2a9d8f', '#264653', '#f4a261', '#8338ec', '#06d6a0'];

const fileInput = document.getElementById('file');
const groupCountInput = document.getElementById('groupCount');
const strokeWidthInput = document.getElementById('strokeWidth');
const strokeWidthVal = document.getElementById('strokeWidthVal');
const groupsPanel = document.getElementById('groupsPanel');
const preview = document.getElementById('preview');
const reshuffleBtn = document.getElementById('reshuffle');
const exportBtn = document.getElementById('export');
const stats = document.getElementById('stats');

let sourceSvg = null;       // original parsed <svg> element
let drawables = [];         // array of original drawable elements (cloned references)
let assignment = [];        // parallel array: which group each drawable belongs to
let groups = [];            // [{ color, weight }]
let userUnitsPerMm = 96 / 25.4; // computed per loaded SVG

function parseLengthMm(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^([-+]?[\d.]+)\s*(mm|cm|in|pt|pc|px)?$/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  const mmPerUnit = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 };
  return val * mmPerUnit[unit];
}

function computeUserUnitsPerMm(svgEl) {
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    const vbW = parts[2], vbH = parts[3];
    const wMm = parseLengthMm(svgEl.getAttribute('width'));
    const hMm = parseLengthMm(svgEl.getAttribute('height'));
    if (wMm && vbW) return vbW / wMm;
    if (hMm && vbH) return vbH / hMm;
  }
  return 96 / 25.4; // fallback: assume user units are CSS pixels
}

function initGroups(n) {
  const prev = groups;
  groups = [];
  for (let i = 0; i < n; i++) {
    groups.push({
      color: prev[i]?.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      weight: prev[i]?.weight ?? (100 / n),
    });
  }
  renderGroupsPanel();
}

function renderGroupsPanel() {
  groupsPanel.innerHTML = '';
  groups.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'group';
    row.innerHTML = `
      <input type="color" data-i="${i}" class="color" value="${g.color}" />
      <input type="range" data-i="${i}" class="weight" min="0" max="100" step="1" value="${g.weight.toFixed(0)}" />
      <span class="pct" data-i="${i}">${g.weight.toFixed(0)}%</span>
    `;
    groupsPanel.appendChild(row);
  });

  groupsPanel.querySelectorAll('.color').forEach(el => {
    el.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      groups[i].color = e.target.value;
      applyStyles();
    });
  });

  groupsPanel.querySelectorAll('.weight').forEach(el => {
    el.addEventListener('input', e => {
      const i = +e.target.dataset.i;
      groups[i].weight = +e.target.value;
      groupsPanel.querySelector(`.pct[data-i="${i}"]`).textContent = `${groups[i].weight.toFixed(0)}%`;
    });
    el.addEventListener('change', () => {
      assignGroups();
      render();
    });
  });
}

function collectDrawables(svgEl) {
  const selector = DRAWABLE_TAGS.join(',');
  return Array.from(svgEl.querySelectorAll(selector));
}

function assignGroups() {
  const weights = groups.map(g => Math.max(0, g.weight));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    assignment = drawables.map(() => 0);
    return;
  }
  const norm = weights.map(w => w / total);
  // cumulative
  const cum = [];
  let acc = 0;
  for (const w of norm) { acc += w; cum.push(acc); }

  assignment = drawables.map(() => {
    const r = Math.random();
    for (let i = 0; i < cum.length; i++) {
      if (r <= cum[i]) return i;
    }
    return cum.length - 1;
  });
}

function buildOutputSvg() {
  if (!sourceSvg) return null;
  const out = sourceSvg.cloneNode(false); // shallow clone keeps viewBox/width/height
  // Preserve namespace + viewBox
  if (!out.getAttribute('xmlns')) out.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const sw = (parseFloat(strokeWidthInput.value) * userUnitsPerMm).toFixed(4);

  // Group elements by assignment for nicer output
  const buckets = groups.map(() => []);
  drawables.forEach((el, i) => {
    const clone = el.cloneNode(true);
    clone.setAttribute('stroke', groups[assignment[i]].color);
    clone.setAttribute('stroke-width', sw);
    clone.setAttribute('fill', 'none');
    buckets[assignment[i]].push(clone);
  });

  buckets.forEach((els, i) => {
    if (!els.length) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `group-${i + 1}`);
    g.setAttribute('stroke', groups[i].color);
    g.setAttribute('stroke-width', sw);
    g.setAttribute('fill', 'none');
    els.forEach(el => g.appendChild(el));
    out.appendChild(g);
  });

  return out;
}

function render() {
  preview.innerHTML = '';
  const out = buildOutputSvg();
  if (!out) {
    preview.innerHTML = '<p class="placeholder">Upload an SVG to begin.</p>';
    stats.textContent = '';
    return;
  }
  preview.appendChild(out);

  const counts = groups.map((_, i) => assignment.filter(a => a === i).length);
  stats.textContent =
    `${drawables.length} lines → ` + counts.map((c, i) => `G${i + 1}: ${c}`).join(', ') +
    `  ·  scale: ${userUnitsPerMm.toFixed(3)} u/mm`;
}

function applyStyles() {
  // Re-color existing rendered svg without reshuffling
  const svgEl = preview.querySelector('svg');
  if (!svgEl) return;
  const sw = (parseFloat(strokeWidthInput.value) * userUnitsPerMm).toFixed(4);
  groups.forEach((g, i) => {
    const gEl = svgEl.querySelector(`#group-${i + 1}`);
    if (gEl) {
      gEl.setAttribute('stroke', g.color);
      gEl.setAttribute('stroke-width', sw);
    }
  });
}

async function loadSvgFile(file) {
  if (!file) return;
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    alert('No <svg> element found.');
    return;
  }
  sourceSvg = svgEl;
  userUnitsPerMm = computeUserUnitsPerMm(svgEl);
  drawables = collectDrawables(svgEl);
  assignGroups();
  render();
}

fileInput.addEventListener('change', e => loadSvgFile(e.target.files[0]));

const dropOverlay = document.getElementById('dropOverlay');
let dragDepth = 0;

window.addEventListener('dragenter', e => {
  e.preventDefault();
  dragDepth++;
  dropOverlay.classList.add('active');
});

window.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', e => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth <= 0) {
    dragDepth = 0;
    dropOverlay.classList.remove('active');
  }
});

window.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
    alert('Please drop an SVG file.');
    return;
  }
  loadSvgFile(file);
});

groupCountInput.addEventListener('change', () => {
  const n = Math.max(2, Math.min(6, parseInt(groupCountInput.value) || 2));
  groupCountInput.value = n;
  initGroups(n);
  assignGroups();
  render();
});

strokeWidthInput.addEventListener('input', () => {
  strokeWidthVal.textContent = parseFloat(strokeWidthInput.value).toFixed(1) + ' mm';
  applyStyles();
});

reshuffleBtn.addEventListener('click', () => {
  assignGroups();
  render();
});

exportBtn.addEventListener('click', () => {
  const out = buildOutputSvg();
  if (!out) return;
  const serialized = new XMLSerializer().serializeToString(out);
  const blob = new Blob([serialized], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'split.svg';
  a.click();
  URL.revokeObjectURL(url);
});

initGroups(parseInt(groupCountInput.value));
