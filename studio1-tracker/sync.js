#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { fetchTrackingStatus, categorize, closeBrowser } = require('./tracking');
const { renderDashboard } = require('./template');

const ROOT = __dirname;
const CREDS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');
const CACHE_DIR = path.join(ROOT, 'cache');
const DASHBOARD_PATH = path.join(ROOT, 'dashboard.html');
const HISTORY_PATH = path.join(CACHE_DIR, 'delivered-history.json'); // legacy
const STORE_PATH = path.join(CACHE_DIR, 'shipments-store.json');

// Persistent store of every shipment we've ever seen, keyed by tracking number.
// Replaces the old "delivered-only" history.
function loadStore() {
  if (fs.existsSync(STORE_PATH)) {
    try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
    catch { /* fall through to fresh store */ }
  }
  // Migrate from old delivered-history.json on first run.
  const legacy = (() => { try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); } catch { return {}; } })();
  const migrated = {};
  for (const [tracking, snap] of Object.entries(legacy)) {
    migrated[tracking] = { ...snap, _migrated: true };
  }
  return { lastScanMtime: 0, lastFullScanAt: null, shipments: migrated };
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Back-compat shims for any external callers / tests.
function loadDeliveredHistory() {
  const store = loadStore();
  const out = {};
  for (const [tracking, s] of Object.entries(store.shipments || {})) {
    if (s.statusCategory === 'delivered' || s.statusCategory === 'returned') out[tracking] = s;
  }
  return out;
}
function saveDeliveredHistory() { /* no-op: writes happen via saveStore now */ }

const DEFAULT_DAYS = parseInt(process.env.DAYS || '20', 10);

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ---------- Gmail auth ----------

async function authGmail() {
  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error(
      `Missing credentials.json. Download it from Google Cloud Console:\n` +
      `  1. Enable Gmail API\n` +
      `  2. Create OAuth client (Desktop app)\n` +
      `  3. Save as ${CREDS_PATH}`
    );
  }
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const config = creds.installed || creds.web;
  const oAuth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    config.redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob'
  );

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });
  console.log('\nVisit this URL to authorize:\n  ' + authUrl + '\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) =>
    rl.question('Paste the authorization code here: ', (a) => { rl.close(); resolve(a.trim()); })
  );

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to', TOKEN_PATH);
  return oAuth2Client;
}

// ---------- Gmail fetch ----------

function decodeHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function findPdfPart(payload) {
  if (!payload) return null;
  if (payload.filename && /\.pdf$/i.test(payload.filename) && payload.body?.attachmentId) {
    return payload;
  }
  for (const p of payload.parts || []) {
    const found = findPdfPart(p);
    if (found) return found;
  }
  return null;
}

function getMessageBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  for (const p of payload.parts || []) {
    if (p.mimeType === 'text/plain' && p.body?.data) {
      return Buffer.from(p.body.data, 'base64').toString('utf8');
    }
  }
  for (const p of payload.parts || []) {
    const body = getMessageBody(p);
    if (body) return body;
  }
  return '';
}

function parseShipmentFields(text) {
  const stripped = text.replace(/\s+/g, ' ');
  const tracking = stripped.match(/מעקב[^A-Z0-9]*([A-Z]{2}\d{9}[A-Z]{2}|[A-Z0-9]{8,})/);
  const date = stripped.match(/מיום[:\s]+([0-9./\-]{6,10})/);
  const order = stripped.match(/הזמנה מספר[:\s]+(\d+)/);
  return {
    tracking: tracking?.[1] || null,
    shipDate: date?.[1] || null,
    ipOrder: order?.[1] || null,
  };
}

async function fetchShipments(auth, days, log) {
  const gmail = google.gmail({ version: 'v1', auth });
  const query = process.env.GMAIL_QUERY
    || `from:noreply@israelpost.co.il subject:תעודות משלוח newer_than:${days}d`;
  log(`Searching Gmail: ${query}`);

  const ids = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me', q: query, pageToken, maxResults: 100,
    });
    for (const m of res.data.messages || []) ids.push(m.id);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  log(`Found ${ids.length} matching messages.`);

  const out = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const subject = decodeHeader(headers, 'Subject');
    const dateHeader = decodeHeader(headers, 'Date');
    const body = getMessageBody(msg.data.payload);
    const snippet = msg.data.snippet || '';
    const fields = parseShipmentFields(body + '\n' + snippet);
    const pdfPart = findPdfPart(msg.data.payload);

    let pdfBuffer = null;
    let pdfFilename = null;
    if (pdfPart) {
      pdfFilename = pdfPart.filename;
      const cachePath = path.join(CACHE_DIR, `${id}-${pdfFilename}`);
      if (fs.existsSync(cachePath)) {
        pdfBuffer = fs.readFileSync(cachePath);
      } else {
        const att = await gmail.users.messages.attachments.get({
          userId: 'me', messageId: id, id: pdfPart.body.attachmentId,
        });
        const b64 = att.data.data.replace(/-/g, '+').replace(/_/g, '/');
        pdfBuffer = Buffer.from(b64, 'base64');
        fs.writeFileSync(cachePath, pdfBuffer);
      }
    }

    out.push({
      messageId: id, subject, emailDate: dateHeader, snippet,
      ...fields, pdfBuffer, pdfFilename,
    });
  }
  return { shipments: out, query };
}

// ---------- Local Downloads scanner ----------

const os = require('os');
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads');
// Match both the English filename ("israelPost123.pdf") and the Hebrew one
// Israel Post's website actually uses: "תעודת משלוח_3954248.pdf" (shipping cert).
const DOWNLOAD_FILENAME_RE = /israel.?post|תעודת.משלוח/i;

async function fetchShipmentsFromDownloads(days, log, { sinceMtime = 0 } = {}) {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    throw new Error(`Downloads folder not found at ${DOWNLOADS_DIR}. Set DOWNLOADS_DIR in .env to override.`);
  }

  const dayCutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  // Use the higher of (days window) and (sinceMtime) — incremental should never widen the window.
  const cutoff = Math.max(dayCutoff, sinceMtime);
  if (sinceMtime > 0) {
    log(`Scanning ${DOWNLOADS_DIR} for new Israel Post PDFs since ${new Date(sinceMtime).toISOString()}…`);
  } else {
    log(`Scanning ${DOWNLOADS_DIR} for Israel Post PDFs (last ${days} days)…`);
  }

  const all = fs.readdirSync(DOWNLOADS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf') && DOWNLOAD_FILENAME_RE.test(f))
    .map((f) => {
      const full = path.join(DOWNLOADS_DIR, f);
      const stat = fs.statSync(full);
      return { filename: f, fullPath: full, mtime: stat.mtimeMs };
    })
    .filter((f) => f.mtime >= cutoff)
    .sort((a, b) => b.mtime - a.mtime);

  log(`Found ${all.length} matching PDFs.`);

  // De-duplicate same-content PDFs (e.g. "labelX.pdf" and "labelX (1).pdf"
  // — browsers append "(1)" when downloading again). Keep newest mtime.
  const byHash = new Map();
  for (const f of all) {
    const buf = fs.readFileSync(f.fullPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const existing = byHash.get(hash);
    if (!existing || f.mtime > existing.mtime) {
      byHash.set(hash, { ...f, pdfBuffer: buf, hash });
    }
  }

  const shipments = Array.from(byHash.values()).map((f) => ({
    messageId: `pdf:${f.hash}`,
    subject: f.filename,
    emailDate: new Date(f.mtime).toISOString(),
    snippet: '',
    tracking: null,        // filled by extractShipmentInfo
    shipDate: new Date(f.mtime).toISOString(),
    ipOrder: null,
    pdfBuffer: f.pdfBuffer,
    pdfFilename: f.filename,
  }));

  return { shipments, query: `Downloads/${DOWNLOAD_FILENAME_RE.source}.pdf newer than ${days}d` };
}

// ---------- Tracking-number extraction & normalization ----------

// Strip whitespace + dashes, return null if format isn't a known Israel Post tracking code.
function normalizeTracking(raw) {
  if (!raw) return null;
  const c = String(raw).replace(/[-\s]/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{9}IL$/.test(c)) return c;     // international registered / EMS
  if (/^\d{12}U$/.test(c)) return c;              // domestic, 12 digits + U
  if (/^\d{13}$/.test(c)) return c;               // domestic, 13 digits
  return null;
}

// Find the first valid Israel Post tracking number in text.
// Priority order: domestic (ends in U) → strict international (RR + 9 digits + IL).
// Israel Post domestic labels print the number in multiple formats on one label:
//   *015113850010U*   ← barcode style with asterisks
//   01-511385001-0U   ← human-readable with dashes
// Both normalize to "015113850010U" (13 chars, 12 digits + U).
function findTrackingInText(text) {
  if (!text) return null;

  // Phase 1: U-ending domestic tracking. Lookbehind/ahead ensure the match
  // is JUST the tracking chars (no surrounding asterisks/punctuation).
  const domesticMatches = text.match(/(?<![A-Za-z0-9])\d[\d\-\s]{10,18}U(?![A-Za-z0-9])/g) || [];
  for (const m of domesticMatches) {
    const norm = normalizeTracking(m);
    if (norm && /U$/.test(norm)) return norm;
  }

  // Phase 2: pure 13-digit numeric tracking (rare but possible).
  const numericMatches = text.match(/(?<![A-Za-z0-9])\d[\d\-\s]{11,16}(?![A-Za-z0-9U])/g) || [];
  for (const m of numericMatches) {
    const norm = normalizeTracking(m);
    if (norm && /^\d{13}$/.test(norm)) return norm;
  }

  // Phase 3: strict international format ONLY (exactly 2 letters + 9 digits + IL).
  // Anything looser is a hallucination — skip it.
  const intlMatches = text.match(/(?<![A-Za-z0-9])[A-Z]{2}\d{9}IL(?![A-Za-z0-9])/g) || [];
  for (const m of intlMatches) {
    const norm = normalizeTracking(m);
    if (norm) return norm;
  }

  return null;
}

// ---------- PDF → recipient ----------

function recipientCachePath(pdfBuffer) {
  const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `recipient-${hash}.json`);
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Bump this when the extraction logic / cache schema meaningfully changes,
// so older cache files get re-extracted automatically on next read.
const EXTRACT_VERSION = 2;

async function extractShipmentInfo(pdfBuffer, anthropic, filename, log, { needTracking = false } = {}) {
  const cachePath = recipientCachePath(pdfBuffer);
  if (fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (!needTracking) return cached;
    // Force re-extract if the cache was written by an older version of this code.
    if (cached.version === EXTRACT_VERSION && cached.tracking) {
      const normalized = normalizeTracking(cached.tracking);
      if (normalized) {
        cached.tracking = normalized;
        return cached;
      }
    }
    log(`  ⚠ Cached tracking "${cached.tracking}" needs re-extraction (old version or invalid format).`);
  }

  let result = { name: null, address: null, tracking: null, source: null };
  let pdfText = '';

  try {
    const parsed = await pdfParse(pdfBuffer);
    pdfText = (parsed.text || '').trim();
  } catch (e) {
    log(`  pdf-parse failed on ${filename}: ${e.message}`);
  }

  // Cheap pass: regex for any valid Israel Post tracking format off the PDF text.
  // We trust this more than Claude for codes — Claude hallucinates dashes & prefixes.
  result.tracking = findTrackingInText(pdfText);

  if (pdfText.length >= 40) {
    try {
      const resp = await anthropic.messages.create({
        model: HAIKU,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are extracting info from an Israel Post shipping label. Ignore the sender (Studio 1 / סטודיו) — only the RECIPIENT (מקבל / נמען). Return ONLY this JSON, no prose:

{"name": "recipient full name in original script", "address": "street, city", "tracking": "tracking number EXACTLY as printed"}

For the tracking number:
- Israel Post DOMESTIC tracking is 13 characters: 12 digits followed by 'U'. Example: 015113850010U
- The label may print it with dashes for readability (01-511385001-0U) or surrounded by asterisks (*015113850010U*). Return the DIGITS+U form without dashes or asterisks.
- DO NOT add an "RR" prefix, "IL" suffix, or any other letters. Return EXACTLY what is on the label.
- If you cannot find a valid tracking number, use null. Never invent one.

If any field is missing, use null. Label text:
---
${pdfText.slice(0, 8000)}
---`,
        }],
      });
      const parsed = extractJson(resp.content[0].text);
      if (parsed && parsed.name) {
        // Trust regex-derived tracking over Claude's tracking (Claude hallucinates dashes/RR-IL wrappers).
        const claudeTracking = normalizeTracking(parsed.tracking);
        result = {
          name: parsed.name,
          address: parsed.address || null,
          tracking: result.tracking || claudeTracking,
          source: 'pdf-parse+haiku',
        };
      }
    } catch (e) {
      log(`  Haiku extraction failed: ${e.message}`);
    }
  }

  if (!result.name) {
    try {
      const resp = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') } },
            { type: 'text', text: 'Extract from this Israel Post shipping label. Skip the sender, only the RECIPIENT. Return ONLY JSON: {"name": "...", "address": "...", "tracking": "RR123456789IL or null"}. Use null for missing fields.' },
          ],
        }],
      });
      const parsed = extractJson(resp.content[0].text);
      if (parsed) {
        const claudeTracking = normalizeTracking(parsed.tracking);
        result = {
          name: parsed.name || null,
          address: parsed.address || null,
          tracking: result.tracking || claudeTracking,
          source: 'sonnet-pdf',
        };
      }
    } catch (e) {
      log(`  Sonnet PDF extraction failed: ${e.message}`);
    }
  }

  result.version = EXTRACT_VERSION;
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
  return result;
}

// Back-compat alias
const extractRecipient = extractShipmentInfo;

// ---------- Wix orders ----------

async function fetchWixOrders() {
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  const accountId = process.env.WIX_ACCOUNT_ID;
  if (!apiKey || !siteId) {
    throw new Error('Missing WIX_API_KEY or WIX_SITE_ID in .env');
  }

  const res = await fetch('https://www.wixapis.com/ecom/v1/orders/search', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'wix-site-id': siteId,
      ...(accountId ? { 'wix-account-id': accountId } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      search: {
        sort: [{ fieldName: 'createdDate', order: 'DESC' }],
        cursorPaging: { limit: 100 },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Wix API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const orders = data.orders || [];

  return orders.map((o) => {
    const billing = o.billingInfo?.contactDetails || {};
    const recipient = o.recipientInfo?.contactDetails || {};
    const buyer = o.buyerInfo || {};
    const firstName = recipient.firstName || billing.firstName || '';
    const lastName = recipient.lastName || billing.lastName || '';
    const shippingAddress = o.shippingInfo?.logistics?.shippingDestination?.address
      || o.shippingInfo?.shippingDestination?.address || {};
    return {
      orderNumber: o.number || o.id,
      orderId: o.id,
      customerName: `${firstName} ${lastName}`.trim(),
      email: buyer.email || billing.email,
      phone: recipient.phone || billing.phone,
      products: (o.lineItems || [])
        .map((li) => (typeof li.productName === 'string' ? li.productName : li.productName?.original))
        .filter(Boolean),
      orderDate: o.createdDate || o._createdDate,
      total: o.priceSummary?.total?.formattedAmount || o.totals?.total,
      city: shippingAddress.city || '',
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
    };
  });
}

// ---------- Matching ----------

function normalize(s) {
  if (!s) return '';
  return s
    .normalize('NFC')
    .replace(/[֑-ׇֽֿׁׂׅׄ]/g, '')
    .replace(/[.,;:'"״׳`\-_/\\()]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function nameTokens(s) {
  return (s || '').normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean);
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(nameTokens(a).map(normalize).filter(Boolean));
  const tb = new Set(nameTokens(b).map(normalize).filter(Boolean));
  if (ta.size && tb.size) {
    let shared = 0;
    for (const t of ta) if (tb.has(t)) shared++;
    const tokenScore = shared / Math.max(ta.size, tb.size);
    if (tokenScore === 1) return 0.97;
    if (tokenScore >= 0.5) {
      const lev = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
      return Math.max(tokenScore * 0.9, lev);
    }
  }
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return Math.max(0, 1 - levenshtein(na, nb) / Math.max(na.length, nb.length));
}

function matchOrder(recipientName, orders) {
  let best = null;
  let bestScore = 0;
  for (const o of orders) {
    const s = similarity(recipientName, o.customerName);
    if (s > bestScore) { bestScore = s; best = o; }
  }
  let confidence;
  if (bestScore >= 0.97) confidence = 'exact';
  else if (bestScore >= 0.75) confidence = 'fuzzy';
  else confidence = 'unmatched';
  return { order: confidence === 'unmatched' ? null : best, score: bestScore, confidence };
}

// ---------- runSync (exposed for both CLI and server) ----------

// Merge a freshly-scanned shipment into an existing store entry, keeping the
// best fields from each side (don't overwrite good data with missing data).
function mergeIntoStored(stored, fresh) {
  if (!stored) return { ...fresh };
  return {
    ...stored,
    ...fresh,
    // Prefer the most complete recipient.
    recipient: (fresh.recipient && fresh.recipient.name) ? fresh.recipient : (stored.recipient || fresh.recipient),
    // Keep earliest first-seen timestamp.
    firstSeenAt: stored.firstSeenAt || fresh.firstSeenAt,
    // Don't overwrite a known status with nothing.
    statusText: fresh.statusText || stored.statusText,
    statusDate: fresh.statusDate || stored.statusDate,
    statusLocation: fresh.statusLocation || stored.statusLocation,
    statusCategory: fresh.statusCategory || stored.statusCategory,
    statusSource: fresh.statusSource || stored.statusSource,
  };
}

async function runSync({
  days = DEFAULT_DAYS,
  source = (process.env.SOURCE || 'downloads'),
  fullScan = false,
  log = console.log,
} = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY in .env');
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const runStartedAt = Date.now();

  // Load persistent store of every shipment we've ever processed.
  const store = loadStore();
  const storeWasEmpty = Object.keys(store.shipments).length === 0;
  const isFullScan = fullScan || store.lastScanMtime === 0 || storeWasEmpty;
  log(`Store has ${Object.keys(store.shipments).length} known shipments. Mode: ${isFullScan ? `FULL SCAN (${days}d window)` : 'incremental (since last sync)'}.`);

  // Scan source for shipments (incremental = files newer than last scan).
  let scanned, query;
  if (source === 'gmail') {
    const auth = await authGmail();
    ({ shipments: scanned, query } = await fetchShipments(auth, days, log));
  } else {
    const sinceMtime = isFullScan ? 0 : store.lastScanMtime;
    ({ shipments: scanned, query } = await fetchShipmentsFromDownloads(days, log, { sinceMtime }));
  }
  const needTrackingFromPdf = source === 'downloads';

  // Extract recipient + tracking from each scanned PDF (cached after first time).
  for (let i = 0; i < scanned.length; i++) {
    const s = scanned[i];
    if (!s.pdfBuffer) {
      s.recipient = { name: null, address: null, source: 'no-pdf' };
      continue;
    }
    log(`[${i + 1}/${scanned.length}] Extracting from ${s.pdfFilename}`);
    const info = await extractShipmentInfo(
      s.pdfBuffer, anthropic, s.pdfFilename, log,
      { needTracking: needTrackingFromPdf }
    );
    s.recipient = { name: info.name, address: info.address, source: info.source };
    if (!s.tracking && info.tracking) s.tracking = info.tracking;
    if (s.tracking) s.tracking = normalizeTracking(s.tracking) || s.tracking;
    s.firstSeenAt = s.firstSeenAt || new Date().toISOString();
    log(`  → ${info.name || '(none)'}  ${s.tracking || '(no tracking)'}  [${info.source}]`);
  }

  // Merge scanned shipments into the store (dedupe by tracking number).
  // Multiple PDFs sharing a tracking number → one record.
  let newCount = 0;
  let updatedCount = 0;
  const noTrackingBucket = [];
  for (const s of scanned) {
    delete s.pdfBuffer;
    if (!s.tracking) { noTrackingBucket.push(s); continue; }
    const existing = store.shipments[s.tracking];
    store.shipments[s.tracking] = mergeIntoStored(existing, s);
    if (existing) updatedCount++; else newCount++;
  }
  // Untrackable shipments keyed by message/file id so they don't all collide.
  for (const s of noTrackingBucket) {
    const key = `notrack:${s.messageId}`;
    const existing = store.shipments[key];
    store.shipments[key] = mergeIntoStored(existing, s);
    if (existing) updatedCount++; else newCount++;
  }
  log(`Scanned ${scanned.length} PDFs → ${newCount} new shipment(s), ${updatedCount} updated.`);

  log('Fetching Wix orders…');
  const orders = await fetchWixOrders();
  log(`Found ${orders.length} Wix orders.`);

  // Refresh tracking status for non-terminal shipments only. Delivered/returned
  // are permanent and skipped entirely. Others use 6h-cached lookups.
  const toCheck = Object.values(store.shipments).filter(
    (s) => s.tracking && s.statusCategory !== 'delivered' && s.statusCategory !== 'returned'
  );
  if (toCheck.length) {
    log(`Checking status for ${toCheck.length} non-delivered shipment(s)…`);
    try {
      for (let i = 0; i < toCheck.length; i++) {
        const s = toCheck[i];
        const status = await fetchTrackingStatus(s.tracking, { cacheDir: CACHE_DIR, log });
        s.statusText = status.text;
        s.statusDate = status.date;
        s.statusLocation = status.location;
        s.statusCategory = categorize(status.text);
        s.statusSource = status.source;
        log(`  [${i + 1}/${toCheck.length}] ${s.tracking} → ${status.text || '(none)'} [${status.source}]`);
      }
    } finally {
      await closeBrowser();
    }
  } else {
    log('No non-delivered shipments to re-check. Skipping browser launch.');
  }

  // Match every shipment in the store against current Wix orders, then keep
  // only those whose ORDER DATE (or ship date as fallback) is within the
  // display window. Sorted by order placement date, newest first.
  const displayCutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const rowDate = (r) =>
    new Date(r.order?.orderDate || r.emailDate || r.shipDate || 0).getTime();

  const rows = Object.values(store.shipments)
    .map((s) => {
      const match = matchOrder(s.recipient?.name, orders);
      return { ...s, ...match };
    })
    .filter((r) => rowDate(r) >= displayCutoff);

  rows.sort((a, b) => rowDate(b) - rowDate(a));

  // Persist the updated store, and bump the high-water mark.
  store.lastScanMtime = runStartedAt;
  if (isFullScan) store.lastFullScanAt = new Date(runStartedAt).toISOString();
  saveStore(store);

  return {
    rows,
    orders,
    query,
    days,
    isFullScan,
    storeSize: Object.keys(store.shipments).length,
    newCount,
    updatedCount,
    lastFullScanAt: store.lastFullScanAt,
    generatedAt: new Date().toLocaleString('en-GB'),
  };
}

// ---------- CLI entry ----------

async function cliMain() {
  if (process.argv.includes('--auth-only')) {
    await authGmail();
    console.log('Auth OK.');
    return;
  }

  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : DEFAULT_DAYS;
  const sourceArg = process.argv.find((a) => a.startsWith('--source='));
  const source = sourceArg ? sourceArg.split('=')[1] : (process.env.SOURCE || 'downloads');
  const fullScan = process.argv.includes('--full') || process.argv.includes('--full-scan');

  const result = await runSync({ days, source, fullScan });
  const html = renderDashboard({ ...result, serverMode: false });
  fs.writeFileSync(DASHBOARD_PATH, html);
  console.log(`\n✓ Dashboard written to ${DASHBOARD_PATH}`);
  console.log(`  open "${DASHBOARD_PATH}"`);
}

if (require.main === module) {
  cliMain().catch((e) => {
    console.error('\n✗ Failed:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  });
}

module.exports = { runSync, renderDashboard, DEFAULT_DAYS, DASHBOARD_PATH };
