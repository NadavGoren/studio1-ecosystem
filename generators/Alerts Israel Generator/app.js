/* Alerts Israel — temporal timeline generator
 * Pure vanilla JS + SVG. Data is embedded via data/data.js (window.ALERTS_DATA).
 * All time bucketing uses the browser's local timezone (Asia/Jerusalem for the studio).
 */
(() => {
  "use strict";

  const DATA = window.ALERTS_DATA;
  if (!DATA) {
    document.body.innerHTML = "<p style='padding:40px'>data/data.js failed to load. Run preprocess.py.</p>";
    return;
  }

  // Fixed colors per threat-type id (keys come from the dataset).
  const COLORS = {
    0: "#e8412c", // Rocket / Missile
    5: "#7b61ff", // Hostile UAV / Drone
    2: "#f5a623", // Hostile Aircraft
    3: "#3fb27f", // Earthquake
    8: "#f7d038", // Radiological / CBRN
  };
  // Display order: most frequent first, but stable.
  const TYPE_IDS = Object.keys(DATA.meta.threatTypes)
    .map(Number)
    .sort((a, b) => (DATA.meta.typeCounts[b] || 0) - (DATA.meta.typeCounts[a] || 0));

  // Split mode: which threats grow UP (airborne, from the sky) vs DOWN (ground-launched).
  const GROUP_TOP = [5, 2];        // Hostile UAV / Drone, Hostile Aircraft
  const GROUP_BOTTOM = [0, 3, 8];  // Rocket / Missile, Earthquake, Radiological / CBRN

  // Curated real-world events, matched to spikes in the data.
  const EVENTS = [
    { d: "2022-08-07", t: "Op. Breaking Dawn" },
    { d: "2023-10-07", t: "Oct 7 — war begins" },
    { d: "2024-10-01", t: "Iran: 180 missiles" },
    { d: "2024-10-26", t: "Israel strikes Iran" },
    { d: "2025-06-13", t: "12-Day War — 525-city alert" },
    { d: "2026-02-28", t: "2026 Iran war begins" },
    { d: "2026-03-01", t: "Beit Shemesh strike (9 killed)" },
  ].map((e) => ({ ...e, ts: Math.floor(new Date(e.d + "T12:00:00").getTime() / 1000) }));

  const visibleEvents = () =>
    EVENTS.filter((e) => e.ts >= state.from && e.ts <= state.to)
      .sort((a, b) => a.ts - b.ts)
      .map((e, i) => ({ ...e, n: i + 1 }));

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtNum = (n) => n.toLocaleString("en-US");

  // ---------- state ----------
  const state = {
    from: DATA.meta.tmin,
    to: DATA.meta.tmax,
    view: "timeline", // timeline | calendar
    bucket: "week",
    mode: "stacked",  // timeline display mode
    glyph: "rings",   // calendar glyph style
    events: true,     // overlay key real-world events
    log: false,
    activeTypes: new Set(TYPE_IDS),
    cities: new Set(), // empty => all cities
  };

  // ---------- date helpers (local time) ----------
  const tsToDate = (ts) => new Date(ts * 1000);
  function bucketStart(date, bucket) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (bucket === "week") d.setDate(d.getDate() - d.getDay()); // Sunday
    else if (bucket === "month") d.setDate(1);
    return d;
  }
  function nextBucket(d, bucket) {
    const n = new Date(d);
    if (bucket === "day") n.setDate(n.getDate() + 1);
    else if (bucket === "week") n.setDate(n.getDate() + 7);
    else n.setMonth(n.getMonth() + 1);
    return n;
  }
  function bucketLabel(d, bucket) {
    const dd = d.getDate(), mm = MONTHS[d.getMonth()], yy = d.getFullYear();
    if (bucket === "month") return `${mm} ${yy}`;
    if (bucket === "week") return `Week of ${dd} ${mm} ${yy}`;
    return `${dd} ${mm} ${yy}`;
  }
  function axisLabel(d, bucket) {
    if (bucket === "month" || bucket === "week") return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const toInputDate = (ts) => {
    const d = tsToDate(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ---------- pipeline ----------
  function filterEvents() {
    const { from, to, activeTypes, cities } = state;
    const useCities = cities.size > 0;
    const out = [];
    for (const ev of DATA.events) {
      const [type, ts, cityIdxs] = ev;
      if (ts < from || ts > to) continue;
      if (!activeTypes.has(type)) continue;
      if (useCities) {
        let hit = false;
        for (const ci of cityIdxs) if (cities.has(ci)) { hit = true; break; }
        if (!hit) continue;
      }
      out.push(ev);
    }
    return out;
  }

  function bucketize(events) {
    const { from, to, bucket } = state;
    const buckets = [];
    const index = new Map();
    let cur = bucketStart(tsToDate(from), bucket);
    const end = bucketStart(tsToDate(to), bucket);
    while (cur <= end) {
      const b = { t: new Date(cur), key: cur.getTime(), counts: {}, total: 0 };
      buckets.push(b);
      index.set(b.key, b);
      cur = nextBucket(cur, bucket);
    }
    for (const [type, ts] of events) {
      const k = bucketStart(tsToDate(ts), bucket).getTime();
      const b = index.get(k);
      if (!b) continue;
      b.counts[type] = (b.counts[type] || 0) + 1;
      b.total++;
    }
    return buckets;
  }

  // ---------- rendering ----------
  const SVG_NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const chart = document.getElementById("chart");
  let lastBuckets = [];

  // bright / print palette
  const INK = "#1a1d21", MUTE = "#6b7280", AXIS = "#9aa1ab", GRID = "#edeef1", FRAME = "#cfd4da", PAGE = "#ffffff";
  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const BUCKET_ADV = { day: "daily", week: "weekly", month: "monthly" };

  const text = (x, y, str, attrs = {}) => {
    const t = el("text", Object.assign({ x, y, "font-family": FONT }, attrs));
    t.textContent = str;
    return t;
  };
  const estWidth = (s, fs) => s.length * fs * 0.58;
  const fmtDateLong = (ts) => { const d = tsToDate(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

  function render() {
    const events = filterEvents();
    const buckets = bucketize(events);
    lastBuckets = buckets;
    updateStats(events, buckets);

    const wrap = document.getElementById("chartWrap");
    const W = wrap.clientWidth, H = wrap.clientHeight;
    chart.setAttribute("viewBox", `0 0 ${W} ${H}`);
    chart.setAttribute("width", W);
    chart.setAttribute("height", H);
    while (chart.firstChild) chart.removeChild(chart.firstChild);

    // white page so the exported SVG is a self-contained, printable asset
    chart.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: PAGE }));

    const types = TYPE_IDS.filter((t) => state.activeTypes.has(t));

    const m = { top: 88, right: 30, bottom: 42, left: 60 };
    m.top = drawHeader(W, m, events.length, types);

    const innerW = Math.max(10, W - m.left - m.right);
    const innerH = Math.max(10, H - m.top - m.bottom);
    const g = el("g", { transform: `translate(${m.left},${m.top})` });
    chart.appendChild(g);

    if (state.view === "calendar") {
      renderCalendar(g, buckets, innerW, innerH, types);
      return;
    }

    if (state.mode === "split") {
      renderSplit(g, buckets, innerW, innerH, types);
      return;
    }

    // Y domain
    let maxV = 0;
    if (state.mode === "stacked") {
      for (const b of buckets) maxV = Math.max(maxV, b.total);
    } else {
      for (const b of buckets) for (const t of types) maxV = Math.max(maxV, b.counts[t] || 0);
    }
    maxV = maxV || 1;

    const yPos = state.log
      ? (v) => innerH * (1 - Math.log1p(v) / Math.log1p(maxV))
      : (v) => innerH * (1 - v / maxV);

    for (const tv of yTicks(maxV, state.log)) {
      const y = yPos(tv);
      g.appendChild(el("line", { x1: 0, x2: innerW, y1: y, y2: y, stroke: GRID, "stroke-width": 1 }));
      g.appendChild(text(-10, y + 3, fmtNum(tv), { fill: AXIS, "font-size": 10, "text-anchor": "end" }));
    }
    g.appendChild(el("line", { x1: 0, x2: innerW, y1: innerH, y2: innerH, stroke: FRAME, "stroke-width": 1 }));

    const n = buckets.length;
    const slot = innerW / Math.max(1, n);
    const barW = Math.max(1, Math.min(slot - 1, slot * 0.86));

    if (state.mode === "stacked") {
      buckets.forEach((b, i) => {
        const x = i * slot + (slot - barW) / 2;
        let acc = 0;
        for (const t of types) {
          const v = b.counts[t] || 0;
          if (!v) continue;
          const y0 = yPos(acc), y1 = yPos(acc + v);
          g.appendChild(el("rect", { x, y: y1, width: barW, height: Math.max(0.5, y0 - y1), fill: COLORS[t] || "#888" }));
          acc += v;
        }
      });
    } else {
      for (const t of types) {
        let d = "";
        buckets.forEach((b, i) => {
          const x = i * slot + slot / 2;
          const y = yPos(b.counts[t] || 0);
          d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
        });
        g.appendChild(el("path", { d, fill: "none", stroke: COLORS[t] || "#888", "stroke-width": 1.6, "stroke-linejoin": "round" }));
      }
    }

    const step = Math.ceil(n / 11) || 1;
    for (let i = 0; i < n; i += step) {
      const x = i * slot + slot / 2;
      g.appendChild(text(x, innerH + 16, axisLabel(buckets[i].t, state.bucket), { fill: AXIS, "font-size": 10, "text-anchor": "middle" }));
    }

    drawTimelineEvents(g, buckets, slot, innerH);
  }

  // Title block + legend, drawn inside the SVG so the export is complete.
  // Legend wraps to fit the width; returns the y where the chart should begin.
  function drawHeader(W, m, total, types) {
    chart.appendChild(text(m.left, 36, "Israel Air-Raid Alerts", { fill: INK, "font-size": 23, "font-weight": 700 }));
    const sub = `${fmtDateLong(state.from)} – ${fmtDateLong(state.to)}   ·   ${BUCKET_ADV[state.bucket]}   ·   ${fmtNum(total)} alerts`
      + (state.cities.size ? `   ·   ${state.cities.size} ${state.cities.size === 1 ? "city" : "cities"}` : "");
    chart.appendChild(text(m.left, 58, sub, { fill: MUTE, "font-size": 12 }));

    const avail = W - m.left - m.right;
    let x = m.left, ly = 78;
    for (const t of types) {
      const label = DATA.meta.threatTypes[t];
      const w = 16 + estWidth(label, 11) + 18;
      if (x > m.left && x - m.left + w > avail) { x = m.left; ly += 18; } // wrap
      chart.appendChild(el("rect", { x, y: ly - 9, width: 11, height: 11, rx: 2, fill: COLORS[t] || "#888" }));
      chart.appendChild(text(x + 16, ly, label, { fill: "#374151", "font-size": 11 }));
      x += w;
    }
    return Math.max(m.top, ly + 14);
  }

  // Split view: airborne threats hang DOWN from the top edge, ground-launched
  // threats rise UP from the bottom edge — they meet toward the middle.
  function renderSplit(g, buckets, innerW, innerH, allTypes) {
    const topTypes = GROUP_TOP.filter((t) => state.activeTypes.has(t));
    const botTypes = GROUP_BOTTOM.filter((t) => state.activeTypes.has(t));

    const sumOf = (b, types) => types.reduce((s, t) => s + (b.counts[t] || 0), 0);
    let topMax = 0, botMax = 0;
    for (const b of buckets) {
      topMax = Math.max(topMax, sumOf(b, topTypes));
      botMax = Math.max(botMax, sumOf(b, botTypes));
    }
    topMax = topMax || 1;
    botMax = botMax || 1;

    const gap = 2;                          // sliver of breathing room at the meeting line
    const centerY = innerH / 2;
    const topH = centerY - gap / 2;         // airborne band: top edge → middle
    const botH = innerH - centerY - gap / 2; // ground band: bottom edge → middle
    const len = (v, max, h) => state.log
      ? h * (Math.log1p(v) / Math.log1p(max))
      : h * (v / max);

    const n = buckets.length;
    const slot = innerW / Math.max(1, n);

    // grid ticks: airborne measured from TOP edge down; ground from BOTTOM edge up
    for (const tv of yTicks(topMax, state.log)) {
      if (tv === 0) continue;
      const y = len(tv, topMax, topH);
      g.appendChild(el("line", { x1: 0, x2: innerW, y1: y, y2: y, stroke: GRID, "stroke-width": 1 }));
      g.appendChild(text(-10, y + 3, fmtNum(tv), { fill: AXIS, "font-size": 10, "text-anchor": "end" }));
    }
    for (const tv of yTicks(botMax, state.log)) {
      if (tv === 0) continue;
      const y = innerH - len(tv, botMax, botH);
      g.appendChild(el("line", { x1: 0, x2: innerW, y1: y, y2: y, stroke: GRID, "stroke-width": 1 }));
      g.appendChild(text(-10, y + 3, fmtNum(tv), { fill: AXIS, "font-size": 10, "text-anchor": "end" }));
    }

    const drawSide = (types, baseY, dir, max, h) => {
      const cum = new Array(n).fill(0);
      for (const t of types) {
        const pts = buckets.map((b, i) => {
          const x = i * slot + slot / 2;
          const y0 = baseY + dir * len(cum[i], max, h);
          cum[i] += b.counts[t] || 0;
          const y1 = baseY + dir * len(cum[i], max, h);
          return { x, y0, y1 };
        });
        let d = "";
        pts.forEach((p, i) => { d += (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y1.toFixed(1) + " "; });
        for (let i = n - 1; i >= 0; i--) d += "L" + pts[i].x.toFixed(1) + " " + pts[i].y0.toFixed(1) + " ";
        d += "Z";
        g.appendChild(el("path", {
          d, fill: COLORS[t] || "#888", "fill-opacity": 0.9,
          stroke: COLORS[t] || "#888", "stroke-width": 1, "stroke-linejoin": "round",
        }));
      }
    };

    drawSide(topTypes, 0, 1, topMax, topH);        // airborne: from TOP edge, downward
    drawSide(botTypes, innerH, -1, botMax, botH);  // ground: from BOTTOM edge, upward

    // anchor edges
    g.appendChild(el("line", { x1: 0, x2: innerW, y1: 0, y2: 0, stroke: FRAME, "stroke-width": 1 }));
    g.appendChild(el("line", { x1: 0, x2: innerW, y1: innerH, y2: innerH, stroke: FRAME, "stroke-width": 1 }));

    const step = Math.ceil(n / 11) || 1;
    for (let i = 0; i < n; i += step) {
      const x = i * slot + slot / 2;
      g.appendChild(text(x, innerH + 16, axisLabel(buckets[i].t, state.bucket), { fill: AXIS, "font-size": 10, "text-anchor": "middle" }));
    }

    // side captions on the (near-empty) left edge so they never collide with spikes
    if (topTypes.length) g.appendChild(text(3, 13, "↓ from the sky", { fill: MUTE, "font-size": 10 }));
    if (botTypes.length) g.appendChild(text(3, innerH - 7, "↑ from the ground", { fill: MUTE, "font-size": 10 }));

    drawTimelineEvents(g, buckets, slot, innerH);
  }

  // Dashed event markers with vertical labels, for the timeline modes.
  function drawTimelineEvents(g, buckets, slot, innerH) {
    if (!state.events) return;
    for (const ev of visibleEvents()) {
      const k = bucketStart(tsToDate(ev.ts), state.bucket).getTime();
      const idx = buckets.findIndex((b) => b.key === k);
      if (idx < 0) continue;
      const x = idx * slot + slot / 2;
      g.appendChild(el("line", { x1: x, x2: x, y1: 0, y2: innerH, stroke: "#9aa1ab", "stroke-width": 1, "stroke-dasharray": "3 3" }));
      g.appendChild(el("circle", { cx: x, cy: 0, r: 2.5, fill: INK }));
      g.appendChild(text(x + 3, 6, ev.t, { fill: "#4b5563", "font-size": 9, "text-anchor": "start", transform: `rotate(90 ${x + 3} 6)` }));
    }
  }

  // Calendar grid: the canvas split into cells (one per day / week / month).
  // Count is encoded as a stroke-based glyph (rings / square / hatch) so the
  // result plots cleanly; colour marks the dominant threat in each cell.
  function renderCalendar(g, buckets, innerW, innerH, types) {
    const minYear = tsToDate(state.from).getFullYear();
    const maxYear = tsToDate(state.to).getFullYear();
    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);

    let maxCount = 1;
    for (const b of buckets) maxCount = Math.max(maxCount, b.total);

    const frac = (c) => c <= 0 ? 0 : (state.log ? Math.log1p(c) / Math.log1p(maxCount) : c / maxCount);
    const domType = (b) => {
      let best = -1, bv = -1;
      for (const t of types) { const v = b.counts[t] || 0; if (v > bv) { bv = v; best = t; } }
      return best;
    };
    const weekOfYear = (d) => {
      const start = new Date(d.getFullYear(), 0, 1);
      const doy = Math.floor((d - start) / 86400000);
      return Math.floor((doy + start.getDay()) / 7);
    };

    const drawGlyph = (cx, cy, inner, count, color) => {
      if (count <= 0) return;
      const f = frac(count);
      if (state.glyph === "square") {
        const sz = Math.max(1.4, inner * Math.sqrt(f));
        g.appendChild(el("rect", { x: cx - sz / 2, y: cy - sz / 2, width: sz, height: sz, fill: "none", stroke: color, "stroke-width": 1 }));
      } else if (state.glyph === "rings") {
        const half = inner / 2;
        const rings = 1 + Math.round(f * 4); // 1..5 nested squares
        for (let k = 1; k <= rings; k++) {
          const r = half * (k / rings);
          g.appendChild(el("rect", { x: cx - r, y: cy - r, width: r * 2, height: r * 2, fill: "none", stroke: color, "stroke-width": 0.8 }));
        }
      } else { // hatch — 45° fill, denser = more alerts
        const half = inner / 2;
        g.appendChild(el("rect", { x: cx - half, y: cy - half, width: inner, height: inner, fill: "none", stroke: color, "stroke-width": 0.7 }));
        const lines = 1 + Math.round(f * 7);
        const gap = inner / (lines + 1);
        for (let c = -inner + gap; c < inner; c += gap) {
          const x1 = Math.max(0, c), y1 = x1 - c;
          const x2 = Math.min(inner, inner + c), y2 = x2 - c;
          if (x1 < x2) g.appendChild(el("line", { x1: cx - half + x1, y1: cy - half + y1, x2: cx - half + x2, y2: cy - half + y2, stroke: color, "stroke-width": 0.7 }));
        }
      }
    };

    const evs = state.events ? visibleEvents() : [];
    const keyH = evs.length ? evs.length * 15 + 22 : 0;

    const LBL_LEFT = 38, LBL_TOP = 18;
    const gridW = innerW - LBL_LEFT;
    const gridH = innerH - LBL_TOP - keyH;
    const monthTick = (originX, originY, cell, refYear) => {
      for (let mon = 0; mon < 12; mon++) {
        const col = weekOfYear(new Date(refYear, mon, 1));
        g.appendChild(text(originX + col * cell + cell / 2, originY - 6, MONTHS[mon][0], { fill: AXIS, "font-size": 9, "text-anchor": "middle" }));
      }
    };

    // Highlight event cells + a numbered key in the reserved bottom strip.
    const annotate = (cellOf) => {
      for (const ev of evs) {
        const c = cellOf(tsToDate(ev.ts));
        if (!c) continue;
        g.appendChild(el("rect", { x: c.x, y: c.y, width: c.s, height: c.s, fill: "none", stroke: INK, "stroke-width": 1.6 }));
        g.appendChild(el("circle", { cx: c.x, cy: c.y, r: 6, fill: "#fff", stroke: INK, "stroke-width": 1 }));
        g.appendChild(text(c.x, c.y + 2.8, String(ev.n), { fill: INK, "font-size": 8, "font-weight": 700, "text-anchor": "middle" }));
      }
      let ky = innerH - keyH + 20;
      for (const ev of evs) {
        g.appendChild(el("circle", { cx: 8, cy: ky - 3.5, r: 6, fill: "#fff", stroke: INK, "stroke-width": 1 }));
        g.appendChild(text(8, ky - 0.8, String(ev.n), { fill: INK, "font-size": 8, "font-weight": 700, "text-anchor": "middle" }));
        g.appendChild(text(20, ky, `${fmtDateLong(ev.ts)} — ${ev.t}`, { fill: "#4b5563", "font-size": 10 }));
        ky += 15;
      }
    };

    if (state.bucket === "day") {
      const cols = 53, sub = 7, gapRows = 1;
      const rowUnits = years.length * sub + (years.length - 1) * gapRows;
      const cell = Math.min(gridW / cols, gridH / rowUnits);
      const originX = LBL_LEFT + (gridW - cell * cols) / 2;
      const originY = LBL_TOP + (gridH - cell * rowUnits) / 2;
      const inner = cell * 0.82;

      for (const b of buckets) {
        const d = b.t, bi = d.getFullYear() - minYear;
        const bandTop = originY + bi * (sub + gapRows) * cell;
        const cx = originX + weekOfYear(d) * cell + cell / 2;
        const cy = bandTop + d.getDay() * cell + cell / 2;
        drawGlyph(cx, cy, inner, b.total, COLORS[domType(b)] || INK);
      }
      years.forEach((yr, bi) => {
        const bandTop = originY + bi * (sub + gapRows) * cell;
        g.appendChild(text(originX - 8, bandTop + sub * cell / 2 + 3, String(yr), { fill: MUTE, "font-size": 11, "text-anchor": "end" }));
      });
      monthTick(originX, originY, cell, years[Math.floor(years.length / 2)]);
      annotate((d) => {
        if (d.getFullYear() < minYear || d.getFullYear() > maxYear) return null;
        const bandTop = originY + (d.getFullYear() - minYear) * (sub + gapRows) * cell;
        return { x: originX + weekOfYear(d) * cell, y: bandTop + d.getDay() * cell, s: cell };
      });
    } else {
      const cols = state.bucket === "month" ? 12 : 53;
      const rows = years.length;
      const cell = Math.min(gridW / cols, gridH / rows);
      const originX = LBL_LEFT + (gridW - cell * cols) / 2;
      const originY = LBL_TOP + (gridH - cell * rows) / 2;
      const inner = cell * 0.84;

      if (cols * rows <= 800) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          g.appendChild(el("rect", { x: originX + c * cell, y: originY + r * cell, width: cell, height: cell, fill: "none", stroke: GRID, "stroke-width": 0.6 }));
        }
      }
      for (const b of buckets) {
        const d = b.t, row = d.getFullYear() - minYear;
        const col = state.bucket === "month" ? d.getMonth() : weekOfYear(d);
        drawGlyph(originX + col * cell + cell / 2, originY + row * cell + cell / 2, inner, b.total, COLORS[domType(b)] || INK);
      }
      years.forEach((yr, row) => {
        g.appendChild(text(originX - 8, originY + row * cell + cell / 2 + 3, String(yr), { fill: MUTE, "font-size": 11, "text-anchor": "end" }));
      });
      if (state.bucket === "month") {
        for (let mon = 0; mon < 12; mon++) {
          g.appendChild(text(originX + mon * cell + cell / 2, originY - 6, MONTHS[mon][0], { fill: AXIS, "font-size": 9, "text-anchor": "middle" }));
        }
      } else {
        monthTick(originX, originY, cell, years[Math.floor(years.length / 2)]);
      }
      annotate((d) => {
        if (d.getFullYear() < minYear || d.getFullYear() > maxYear) return null;
        const col = state.bucket === "month" ? d.getMonth() : weekOfYear(d);
        return { x: originX + col * cell, y: originY + (d.getFullYear() - minYear) * cell, s: cell };
      });
    }
  }

  function yTicks(max, log) {
    if (log) {
      const out = [0];
      let v = 1;
      while (v <= max) { out.push(v); v *= 10; }
      if (out[out.length - 1] < max) out.push(max);
      return out;
    }
    const count = 5;
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const stepNice = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const out = [];
    for (let v = 0; v <= max + stepNice * 0.5; v += stepNice) out.push(Math.round(v));
    return out;
  }

  // ---------- stats ----------
  function updateStats(events, buckets) {
    let peak = { total: 0, t: null };
    for (const b of buckets) if (b.total > peak.total) peak = b;
    const span = `${toInputDate(state.from)} → ${toInputDate(state.to)}`;
    const cityTxt = state.cities.size ? `${state.cities.size} selected` : "All";
    document.getElementById("stats").innerHTML = `
      <div class="stat"><b>${fmtNum(events.length)}</b><span>alerts shown</span></div>
      <div class="stat"><b>${peak.total ? fmtNum(peak.total) : "—"}</b><span>peak / ${state.bucket}</span></div>
      <div class="stat"><b>${cityTxt}</b><span>cities</span></div>
    `;
    document.getElementById("cityHint").textContent = state.cities.size ? `(${state.cities.size})` : "(all)";
    document.title = `Alerts Israel — ${fmtNum(events.length)} alerts`;
  }

  // ---------- UI build ----------
  function buildTypes() {
    const box = document.getElementById("types");
    box.innerHTML = "";
    for (const t of TYPE_IDS) {
      const row = document.createElement("div");
      row.className = "type-row" + (state.activeTypes.has(t) ? "" : " off");
      row.innerHTML = `
        <span class="swatch" style="background:${COLORS[t] || "#888"}"></span>
        <span class="name">${DATA.meta.threatTypes[t]}</span>
        <span class="count">${fmtNum(DATA.meta.typeCounts[t] || 0)}</span>`;
      row.addEventListener("click", () => {
        if (state.activeTypes.has(t)) state.activeTypes.delete(t);
        else state.activeTypes.add(t);
        if (state.activeTypes.size === 0) state.activeTypes.add(t); // keep at least one
        buildTypes();
        render();
      });
      box.appendChild(row);
    }
  }

  function buildCitySearch() {
    const input = document.getElementById("citySearch");
    const results = document.getElementById("cityResults");
    const selected = document.getElementById("citySelected");

    function renderSelected() {
      selected.innerHTML = "";
      for (const ci of state.cities) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${DATA.cities[ci]} <button title="remove">×</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          state.cities.delete(ci);
          renderSelected(); render();
        });
        selected.appendChild(chip);
      }
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (!q) { results.classList.remove("show"); results.innerHTML = ""; return; }
      const matches = DATA.cityTotals
        .filter((c) => c.n.includes(q) && !state.cities.has(c.i))
        .slice(0, 12);
      results.innerHTML = "";
      for (const c of matches) {
        const row = document.createElement("div");
        row.innerHTML = `<span>${c.n}</span><span class="c">${fmtNum(c.c)}</span>`;
        row.addEventListener("click", () => {
          state.cities.add(c.i);
          input.value = "";
          results.classList.remove("show");
          renderSelected(); render();
        });
        results.appendChild(row);
      }
      results.classList.toggle("show", matches.length > 0);
    });
    document.addEventListener("click", (e) => {
      if (!results.contains(e.target) && e.target !== input) results.classList.remove("show");
    });
  }

  // ---------- exports ----------
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function stamp() {
    return `${toInputDate(state.from)}_to_${toInputDate(state.to)}_${state.bucket}`;
  }
  function exportSvg() {
    // WYSIWYG: the on-screen SVG already holds the white page, title, legend,
    // axes and the chart with explicit colors — just serialize it.
    const clone = chart.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    download(`israel_alerts_${stamp()}.svg`, out, "image/svg+xml");
  }
  function exportCsv() {
    const types = TYPE_IDS.filter((t) => state.activeTypes.has(t));
    const head = ["bucket_start", "label", ...types.map((t) => DATA.meta.threatTypes[t]), "total"];
    const rows = [head.join(",")];
    for (const b of lastBuckets) {
      const cells = [toInputDate(b.key / 1000), `"${bucketLabel(b.t, state.bucket)}"`];
      for (const t of types) cells.push(b.counts[t] || 0);
      cells.push(b.total);
      rows.push(cells.join(","));
    }
    download(`alerts_timeline_${stamp()}.csv`, rows.join("\n"), "text/csv;charset=utf-8;");
  }

  // ---------- wiring ----------
  function setActive(container, attr, value) {
    container.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.getAttribute(attr) === value));
  }

  document.getElementById("presets").addEventListener("click", (e) => {
    const p = e.target.getAttribute("data-preset");
    if (!p) return;
    if (p === "all") state.from = DATA.meta.tmin;
    else state.from = DATA.meta.tmax - Number(p) * 86400;
    state.to = DATA.meta.tmax;
    document.getElementById("fromDate").value = toInputDate(state.from);
    document.getElementById("toDate").value = toInputDate(state.to);
    setActive(document.getElementById("presets"), "data-preset", p);
    render();
  });

  document.getElementById("fromDate").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.from = Math.floor(new Date(e.target.value + "T00:00:00").getTime() / 1000);
    setActive(document.getElementById("presets"), "data-preset", "_none_");
    render();
  });
  document.getElementById("toDate").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.to = Math.floor(new Date(e.target.value + "T23:59:59").getTime() / 1000);
    setActive(document.getElementById("presets"), "data-preset", "_none_");
    render();
  });

  document.getElementById("view").addEventListener("click", (e) => {
    const v = e.target.getAttribute("data-view");
    if (!v) return;
    state.view = v;
    setActive(document.getElementById("view"), "data-view", v);
    document.getElementById("displayPanel").hidden = v !== "timeline";
    document.getElementById("glyphPanel").hidden = v !== "calendar";
    document.getElementById("bucketLabel").textContent = v === "calendar" ? "Cell" : "Bucket";
    render();
  });
  document.getElementById("glyph").addEventListener("click", (e) => {
    const gl = e.target.getAttribute("data-glyph");
    if (!gl) return;
    state.glyph = gl;
    setActive(document.getElementById("glyph"), "data-glyph", gl);
    render();
  });

  document.getElementById("bucket").addEventListener("click", (e) => {
    const b = e.target.getAttribute("data-bucket");
    if (!b) return;
    state.bucket = b;
    setActive(document.getElementById("bucket"), "data-bucket", b);
    render();
  });
  document.getElementById("mode").addEventListener("click", (e) => {
    const mo = e.target.getAttribute("data-mode");
    if (!mo) return;
    state.mode = mo;
    setActive(document.getElementById("mode"), "data-mode", mo);
    document.getElementById("splitHint").hidden = mo !== "split";
    render();
  });
  document.getElementById("logScale").addEventListener("change", (e) => {
    state.log = e.target.checked; render();
  });
  document.getElementById("eventsToggle").addEventListener("change", (e) => {
    state.events = e.target.checked; render();
  });

  document.getElementById("exportSvg").addEventListener("click", exportSvg);
  document.getElementById("exportCsv").addEventListener("click", exportCsv);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  // ---------- init ----------
  document.getElementById("fromDate").value = toInputDate(state.from);
  document.getElementById("toDate").value = toInputDate(state.to);
  document.getElementById("source").innerHTML =
    `Data: ${fmtNum(DATA.meta.events)} alerts · ${DATA.meta.cities.toLocaleString ? fmtNum(DATA.meta.cities) : DATA.meta.cities} localities<br>` +
    `${toInputDate(DATA.meta.tmin)} → ${toInputDate(DATA.meta.tmax)}<br>` +
    `Generated ${DATA.meta.generated}<br>` +
    `Source: tzevaadom.co.il`;

  buildTypes();
  buildCitySearch();
  render();
})();
