#!/usr/bin/env node
'use strict';

require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { runSync, renderDashboard, DEFAULT_DAYS } = require('./sync');

const PORT = parseInt(process.env.PORT || '3137', 10);
const ROOT = __dirname;
const DASHBOARD_PATH = path.join(ROOT, 'dashboard.html');

let lastResult = null;
let lastError = null;
let currentDays = DEFAULT_DAYS;
let syncing = false;

function html(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function text(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function renderWith(result) {
  return renderDashboard({ ...result, serverMode: true });
}

function errorPage(err) {
  const safe = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Studio 1 — Sync Failed</title>
<style>
  body { margin: 0; font-family: 'Inter', -apple-system, sans-serif; background: #fff5f5;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; }
  .card { background: white; border: 1px solid #fecaca; border-radius: 12px;
    padding: 32px 36px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); max-width: 680px; }
  h2 { margin: 0 0 10px; color: #b91c1c; font-size: 18px; }
  .msg { background: #fef2f2; border-radius: 8px; padding: 12px 14px;
    font-family: 'SF Mono', Menlo, monospace; font-size: 13px; color: #7f1d1d;
    white-space: pre-wrap; word-break: break-word; }
  .at { color: #9ca3af; font-size: 12px; margin-top: 12px; }
  button { background: #4f46e5; color: white; border: 0; border-radius: 6px;
    padding: 8px 16px; font: 500 14px 'Inter', sans-serif; cursor: pointer; margin-top: 16px; }
  button:hover { background: #4338ca; }
</style></head>
<body><div class="card">
  <h2>Sync failed</h2>
  <p>The script hit an error. The full stack is in your Terminal window.</p>
  <div class="msg">${safe(err.message)}</div>
  <div class="at">Failed at ${safe(err.at)}</div>
  <button onclick="fetch('/sync?days=' + ${currentDays}, {method:'POST'}).then(r => r.text()).then(t => document.body.innerHTML = t)">Try again</button>
</div></body></html>`;
}

function loadingPage(message = 'Loading initial data…') {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Studio 1 — Loading</title>
<style>
  body { margin: 0; font-family: 'Inter', -apple-system, sans-serif; background: #f7f8fa;
    display: flex; align-items: center; justify-content: center; height: 100vh; }
  .card { background: white; border: 1px solid #e6e8ec; border-radius: 12px;
    padding: 32px 40px; box-shadow: 0 4px 12px rgba(16,24,40,0.08); text-align: center; min-width: 320px; }
  .spinner { width: 32px; height: 32px; margin: 0 auto 14px;
    border: 3px solid #e6e8ec; border-top-color: #4f46e5;
    border-radius: 50%; animation: spin 0.7s linear infinite; }
  h2 { margin: 0 0 6px; font-size: 16px; }
  p { color: #6b7280; margin: 0; font-size: 13px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body><div class="card">
  <div class="spinner"></div>
  <h2>${message}</h2>
  <p>This page will reload when ready.</p>
</div>
<script>setTimeout(() => location.reload(), 2500);</script>
</body></html>`;
}

async function doSync(days, { fullScan = false } = {}) {
  if (syncing) throw new Error('A sync is already in progress.');
  syncing = true;
  lastError = null;
  try {
    console.log(`\n→ Syncing (${days} days${fullScan ? ', FULL SCAN' : ', incremental'})…`);
    const result = await runSync({ days, fullScan });
    lastResult = result;
    currentDays = days;
    fs.writeFileSync(DASHBOARD_PATH, renderDashboard({ ...result, serverMode: false }));
    console.log(`✓ Sync complete — ${result.rows.length} shipments (${result.newCount} new, ${result.updatedCount} updated)`);
    return result;
  } catch (err) {
    lastError = { message: err.message, stack: err.stack, at: new Date().toISOString() };
    console.error('\n✗ Sync failed:', err.message);
    if (err.stack) console.error(err.stack);
    throw err;
  } finally {
    syncing = false;
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsed.pathname;

  try {
    if (method === 'GET' && pathname === '/') {
      if (!lastResult) {
        if (lastError && !syncing) return html(res, errorPage(lastError));
        if (!syncing) doSync(currentDays).catch(() => { /* logged in doSync */ });
        return html(res, loadingPage('Syncing for the first time…'));
      }
      return html(res, renderWith(lastResult));
    }

    if (method === 'POST' && pathname === '/sync') {
      const days = parseInt(parsed.query.days || currentDays, 10);
      if (!days || days < 1 || days > 365) return text(res, 'Invalid days value', 400);
      const fullScan = parsed.query.full === '1' || parsed.query.full === 'true';
      try {
        const result = await doSync(days, { fullScan });
        return html(res, renderWith(result));
      } catch (err) {
        return text(res, `Sync failed: ${err.message}`, 500);
      }
    }

    if (method === 'GET' && pathname === '/status') {
      return text(res, JSON.stringify({ syncing, currentDays, hasData: !!lastResult, lastError }));
    }

    if (method === 'GET' && pathname === '/dashboard.html') {
      if (fs.existsSync(DASHBOARD_PATH)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(DASHBOARD_PATH).pipe(res);
      }
    }

    text(res, 'Not found', 404);
  } catch (err) {
    console.error('Server error:', err);
    text(res, `Error: ${err.message}`, 500);
  }
});

server.listen(PORT, () => {
  const urlStr = `http://localhost:${PORT}`;
  console.log(`\n┌─────────────────────────────────────────┐`);
  console.log(`│ Studio 1 Tracker is running             │`);
  console.log(`│                                         │`);
  console.log(`│   ${urlStr.padEnd(38)}│`);
  console.log(`└─────────────────────────────────────────┘`);
  console.log(`\nOpening your browser…  (press Ctrl+C here to stop the server)\n`);

  // Auto-open in default browser on macOS
  const { exec } = require('child_process');
  exec(`open ${urlStr}`, (err) => {
    if (err) console.log(`Could not auto-open browser. Visit ${urlStr} manually.`);
  });

  // Start initial sync in the background
  doSync(currentDays).catch((e) => console.error('Initial sync failed:', e.message));
});
