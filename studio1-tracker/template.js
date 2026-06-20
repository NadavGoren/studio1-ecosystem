'use strict';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function normalize(s) {
  if (!s) return '';
  return s.normalize('NFC').replace(/[\s.,;:'"״׳`\-_/\\()]/g, '').toLowerCase();
}

function statusBadge(category, text, mode = 'full') {
  const label = mode === 'short'
    ? ({
        delivered: 'Delivered',
        'out-for-delivery': 'Out for delivery',
        'awaiting-pickup': 'Awaiting pickup',
        'in-transit': 'In transit',
        returned: 'Returned',
        unknown: '—',
      }[category] || '—')
    : (text || '—');
  return `<span class="status status-${category}">${escapeHtml(label)}</span>`;
}

function renderDashboard({ rows, orders, days, query, generatedAt, serverMode = false, isFullScan, storeSize, newCount, updatedCount, lastFullScanAt }) {
  const stats = {
    total: rows.length,
    exact: rows.filter((r) => r.confidence === 'exact').length,
    fuzzy: rows.filter((r) => r.confidence === 'fuzzy').length,
    unmatched: rows.filter((r) => r.confidence === 'unmatched').length,
    delivered: rows.filter((r) => r.statusCategory === 'delivered').length,
    inTransit: rows.filter((r) => r.statusCategory && r.statusCategory !== 'delivered' && r.statusCategory !== 'unknown').length,
  };

  // Removed: "orders not yet shipped" section (user wants a single merged list).

  const tableRows = rows.map((r) => {
    const trackingLink = r.tracking
      ? `<a href="https://israelpost.co.il/en/itemtrace?itemcode=${encodeURIComponent(r.tracking)}" target="_blank" rel="noopener" class="track-link">${escapeHtml(r.tracking)} <span class="ext">↗</span></a>`
      : '<span class="muted">—</span>';

    const product = r.order?.products?.join(', ') || '';
    const wixOrder = r.order ? `<span class="mono small">#${escapeHtml(r.order.orderNumber)}</span>` : '<span class="muted">—</span>';
    const matchedName = r.order?.customerName || '';
    const phone = r.order?.phone || '';
    const city = r.order?.city || '';
    const status = r.statusText
      ? statusBadge(r.statusCategory || 'unknown', r.statusText)
      : statusBadge('unknown', null);

    const orderDate = r.order?.orderDate || r.emailDate || r.shipDate;
    return `
      <tr class="row-${r.confidence}">
        <td class="nowrap">${escapeHtml(formatDate(orderDate))}</td>
        <td>
          <div class="name">${escapeHtml(r.recipient?.name || '?')}</div>
          ${matchedName && normalize(matchedName) !== normalize(r.recipient?.name)
            ? `<div class="muted small">Wix: ${escapeHtml(matchedName)}</div>` : ''}
        </td>
        <td>${escapeHtml(product)}</td>
        <td>${escapeHtml(city)}</td>
        <td>${status}${(r.statusDate || r.statusLocation) ? `<div class="muted xsmall">${[r.statusDate ? escapeHtml(formatDate(r.statusDate)) : '', r.statusLocation ? escapeHtml(r.statusLocation) : ''].filter(Boolean).join(' · ')}</div>` : ''}</td>
        <td class="mono">${trackingLink}</td>
        <td>${wixOrder}</td>
        <td class="nowrap small">${escapeHtml(phone)}</td>
        <td><span class="match match-${r.confidence}" title="${r.confidence === 'unmatched' ? 'No matching Wix order — likely placed via Instagram, WhatsApp, phone, or manually' : ''}">${
          r.confidence === 'unmatched'
            ? 'Off-Wix'
            : r.confidence + (r.score ? ` ${Math.round(r.score * 100)}%` : '')
        }</span></td>
      </tr>`;
  }).join('');


  const controls = serverMode ? `
    <form id="sync-form" class="controls" onsubmit="return doSync(event)">
      <button type="submit" class="btn btn-primary" id="sync-btn">
        <span class="btn-text">Refresh</span>
        <span class="btn-spinner" hidden></span>
      </button>
      <input type="hidden" id="days-input" value="${days}">
      <div id="sync-status" class="sync-status muted small">Showing the last ${days} days</div>
    </form>
  ` : `
    <div class="controls">
      <div class="muted small">Static snapshot — re-run <code>npm run sync</code> to refresh.</div>
    </div>
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Studio 1 — Shipment Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #f7f8fa;
    --panel: #ffffff;
    --panel-alt: #fafbfc;
    --border: #e6e8ec;
    --border-strong: #d4d8de;
    --text: #1a1d23;
    --text-soft: #4a5260;
    --muted: #8a91a0;
    --accent: #4f46e5;
    --accent-soft: #eef2ff;
    --shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06);
    --shadow-lg: 0 4px 12px rgba(16, 24, 40, 0.08);
    --delivered: #15803d;
    --delivered-bg: #dcfce7;
    --transit: #1d4ed8;
    --transit-bg: #dbeafe;
    --pickup: #b45309;
    --pickup-bg: #fef3c7;
    --out: #6d28d9;
    --out-bg: #ede9fe;
    --returned: #b91c1c;
    --returned-bg: #fee2e2;
    --unknown: #6b7280;
    --unknown-bg: #f3f4f6;
    --exact: #15803d;
    --fuzzy: #b45309;
    --unmatched: #b91c1c;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 32px 28px 80px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0 0 4px; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
  .subtitle { color: var(--muted); font-size: 13px; }
  h2 { margin: 36px 0 14px; font-size: 13px; font-weight: 600; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.08em; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat {
    background: var(--panel); border: 1px solid var(--border);
    padding: 14px 16px; border-radius: 10px;
    box-shadow: var(--shadow);
  }
  .stat .num { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .stat .label { color: var(--muted); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .stat.accent .num { color: var(--accent); }
  .stat.delivered .num { color: var(--delivered); }
  .stat.transit .num { color: var(--transit); }
  .stat.warn .num { color: var(--pickup); }
  .stat.error .num { color: var(--unmatched); }

  .controls {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px; margin-bottom: 20px;
    box-shadow: var(--shadow);
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
  }
  .control-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--text-soft); font-weight: 500;
  }
  .num-input {
    width: 70px; padding: 7px 10px;
    border: 1px solid var(--border-strong); border-radius: 6px;
    font-size: 14px; font-family: inherit;
    background: var(--panel);
  }
  .num-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .btn {
    padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;
    cursor: pointer; border: 1px solid transparent; font-family: inherit;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.15s ease;
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: #4338ca; }
  .btn-primary:disabled { background: #a5a3d8; cursor: wait; }
  .btn-ghost { background: transparent; color: var(--text-soft); border-color: var(--border-strong); }
  .btn-ghost:hover { background: var(--panel-alt); }
  .btn-spinner {
    width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white; border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sync-status { margin-left: auto; }
  .divider { width: 1px; height: 28px; background: var(--border); margin: 0 4px; }
  .filter-input {
    flex: 1; min-width: 200px;
    padding: 8px 12px; border: 1px solid var(--border-strong); border-radius: 6px;
    font-size: 14px; font-family: inherit; background: var(--panel);
  }
  .filter-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

  .card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden;
    box-shadow: var(--shadow);
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { background: var(--panel-alt); font-size: 11px; font-weight: 600; text-transform: uppercase;
       letter-spacing: 0.06em; color: var(--text-soft); white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--panel-alt); }
  .nowrap { white-space: nowrap; }
  .mono { font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
  .small { font-size: 12px; }
  .xsmall { font-size: 11px; margin-top: 2px; }
  .muted { color: var(--muted); }
  .name { font-weight: 500; color: var(--text); }
  .track-link { color: var(--accent); text-decoration: none; }
  .track-link:hover { text-decoration: underline; }
  .track-link .ext { font-size: 10px; opacity: 0.6; }

  .status, .match {
    display: inline-block; padding: 3px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 600; line-height: 1.4;
    white-space: nowrap;
  }
  .status-delivered { background: var(--delivered-bg); color: var(--delivered); }
  .status-in-transit { background: var(--transit-bg); color: var(--transit); }
  .status-awaiting-pickup { background: var(--pickup-bg); color: var(--pickup); }
  .status-out-for-delivery { background: var(--out-bg); color: var(--out); }
  .status-returned { background: var(--returned-bg); color: var(--returned); }
  .status-unknown { background: var(--unknown-bg); color: var(--unknown); }

  .match-exact { background: var(--delivered-bg); color: var(--exact); }
  .match-fuzzy { background: var(--pickup-bg); color: var(--fuzzy); }
  /* "Off-Wix" — informational, not an error. Soft purple tint. */
  .match-unmatched { background: var(--out-bg); color: var(--out); }
  .row-unmatched td { background: rgba(237, 233, 254, 0.35); }
  .stat.offwix .num { color: var(--out); }

  .empty { text-align: center; padding: 40px 20px; color: var(--muted); }

  .section-pending h2 { color: var(--pickup); }
  .card-pending {
    border-color: #f3d58a;
    box-shadow: 0 1px 2px rgba(180, 83, 9, 0.06), 0 1px 3px rgba(180, 83, 9, 0.08);
  }
  .card-pending thead th { background: var(--pickup-bg); color: var(--pickup); }
  .card-pending tbody tr td:first-child { border-left: 3px solid var(--pickup); }

  #loading-overlay {
    position: fixed; inset: 0; background: rgba(247, 248, 250, 0.92);
    display: none; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(2px);
  }
  #loading-overlay.visible { display: flex; }
  .loader-card {
    background: white; border: 1px solid var(--border); border-radius: 12px;
    padding: 28px 36px; box-shadow: var(--shadow-lg);
    text-align: center; min-width: 280px;
  }
  .loader-card .spinner {
    width: 28px; height: 28px; margin: 0 auto 12px;
    border: 3px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  .loader-card .msg { font-weight: 500; }
  .loader-card .step { color: var(--muted); font-size: 12px; margin-top: 6px; min-height: 18px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Studio 1 — Shipment Tracker</h1>
      <div class="subtitle">
        ${escapeHtml(generatedAt)}
        ${(newCount != null && newCount > 0) ? ` · <strong style="color: var(--accent)">${newCount} new</strong>` : ''}
      </div>
    </div>
  </header>

  <div class="stats">
    <div class="stat accent"><div class="num">${stats.total}</div><div class="label">Shipments</div></div>
    <div class="stat delivered"><div class="num">${stats.delivered}</div><div class="label">Delivered</div></div>
    <div class="stat transit"><div class="num">${stats.inTransit}</div><div class="label">In transit</div></div>
    <div class="stat warn"><div class="num">${stats.fuzzy}</div><div class="label">Fuzzy match</div></div>
    <div class="stat offwix"><div class="num">${stats.unmatched}</div><div class="label">Off-Wix</div></div>
  </div>

  ${controls}

  <div class="controls" style="margin-bottom: 16px;">
    <input class="filter-input" id="filter" placeholder="Filter by name, tracking, product, city…" oninput="filterRows(this.value)">
  </div>

  <h2>Last ${days} days · ${rows.length} order${rows.length === 1 ? '' : 's'}</h2>
  <div class="card">
    <table id="shipments">
      <thead>
        <tr>
          <th>Order date</th>
          <th>Recipient</th>
          <th>Product</th>
          <th>City</th>
          <th>Status</th>
          <th>Tracking</th>
          <th>Order #</th>
          <th>Phone</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="9" class="empty">No shipments in this window.</td></tr>'}</tbody>
    </table>
  </div>
</div>

<div id="loading-overlay">
  <div class="loader-card">
    <div class="spinner"></div>
    <div class="msg">Syncing…</div>
    <div class="step" id="loader-step">Fetching from Gmail</div>
  </div>
</div>

<script>
function filterRows(q) {
  q = q.trim().toLowerCase();
  for (const row of document.querySelectorAll('#shipments tbody tr')) {
    row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
  }
}

async function doSync(e) {
  if (e && e.preventDefault) e.preventDefault();
  const days = document.getElementById('days-input').value;
  const overlay = document.getElementById('loading-overlay');
  const step = document.getElementById('loader-step');
  document.querySelector('.loader-card .msg').textContent = 'Refreshing shipments…';
  overlay.classList.add('visible');

  const steps = ['Looking for new PDFs…', 'Fetching Wix orders…', 'Refreshing tracking statuses…', 'Building dashboard…'];
  let i = 0;
  step.textContent = steps[0];
  const interval = setInterval(() => { i = (i + 1) % steps.length; step.textContent = steps[i]; }, 1800);

  try {
    const url = '/sync?days=' + encodeURIComponent(days);
    const res = await fetch(url, { method: 'POST' });
    clearInterval(interval);
    if (!res.ok) {
      const err = await res.text();
      step.textContent = 'Failed: ' + err.slice(0, 200);
      setTimeout(() => overlay.classList.remove('visible'), 4000);
      return false;
    }
    const html = await res.text();
    document.open();
    document.write(html);
    document.close();
  } catch (err) {
    clearInterval(interval);
    step.textContent = 'Error: ' + err.message;
    setTimeout(() => overlay.classList.remove('visible'), 4000);
  }
  return false;
}
</script>
</body>
</html>
`;
}

module.exports = { renderDashboard };
