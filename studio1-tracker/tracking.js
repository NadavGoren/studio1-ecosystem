'use strict';

// Israel Post tracking via headless Chrome.
// The public tracking page sits behind Radware bot protection that blocks
// plain HTTP requests. We drive a real browser, navigate to the tracking page,
// and intercept the JSON response their SPA fetches from:
//   https://israelpost.co.il/umbraco/Surface/ItemTrace/GetItemTrace
//
// Response shape (observed 2026-05-12):
//   {
//     "ReturnCode": 0,
//     "Result": {
//       "Barcode": "...",
//       "typeName": "Door to Door",
//       "itemcodeinfo": {
//         "ColumnHeaders": ["Date","Description","Postal Unit","City"],
//         "InfoLines": [["05/05/2026", "Received for mailing...", "Central", "Jerusalem"], ...]
//       }
//     }
//   }

const fs = require('fs');
const path = require('path');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 60 * 1000; // short cache for failed lookups so we don't retry every minute

// Sanitize tracking code: strip dashes/spaces, validate format. Returns null if invalid.
function sanitizeTracking(raw) {
  if (!raw) return null;
  const c = String(raw).replace(/[-\s]/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{9}IL$/.test(c)) return c;
  if (/^\d{12}U$/.test(c)) return c;
  if (/^\d{13}$/.test(c)) return c;
  return null;
}
const TRACK_URL = (code) => `https://www.israelpost.co.il/en/itemtrace?itemcode=${encodeURIComponent(code)}`;
const API_HINT = 'GetItemTrace';

let puppeteer;
function loadPuppeteer() {
  if (!puppeteer) puppeteer = require('puppeteer');
  return puppeteer;
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = loadPuppeteer().launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browserPromise;
}
async function closeBrowser() {
  if (browserPromise) {
    try { (await browserPromise).close(); } catch { /* ignore */ }
    browserPromise = null;
  }
}

function statusCachePath(cacheDir, itemCode) {
  return path.join(cacheDir, `status-${itemCode}.json`);
}
function readCachedStatus(cacheDir, itemCode) {
  const p = statusCachePath(cacheDir, itemCode);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Delivered / returned are terminal states — never expire.
    if (data.permanent) return data;
    // Retroactively detect permanence for entries cached before the flag existed.
    if (data.text) {
      const cat = categorize(data.text);
      if (cat === 'delivered' || cat === 'returned') return data;
    }
    const ttl = data.text ? CACHE_TTL_MS : FAILURE_TTL_MS;
    if (Date.now() - data.fetchedAt < ttl) return data;
  } catch { /* ignore */ }
  return null;
}
function writeCachedStatus(cacheDir, itemCode, status) {
  const category = categorize(status.text);
  const permanent = category === 'delivered' || category === 'returned';
  fs.writeFileSync(statusCachePath(cacheDir, itemCode),
    JSON.stringify({ ...status, fetchedAt: Date.now(), permanent }, null, 2));
}

// Parse a DD/MM/YYYY (or DD.MM.YYYY) Israeli-format date to a Date for sorting.
function parseILDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
}

function extractFromJson(json) {
  if (!json) return null;

  // Primary path — Israel Post's actual response.
  const info = json?.Result?.itemcodeinfo || json?.result?.itemcodeinfo;
  if (info?.InfoLines?.length) {
    const headers = (info.ColumnHeaders || []).map((h) => String(h).toLowerCase());
    const dateIdx = headers.findIndex((h) => /date|תאריך/.test(h));
    const descIdx = headers.findIndex((h) => /desc|status|תיאור|סטטוס/.test(h));
    const cityIdx = headers.findIndex((h) => /city|עיר|location|מיקום/.test(h));

    // Pick the line with the most recent date (or the last line if no dates parse).
    const lines = info.InfoLines.slice();
    lines.sort((a, b) => {
      const da = parseILDate(dateIdx >= 0 ? a[dateIdx] : a[0]);
      const db = parseILDate(dateIdx >= 0 ? b[dateIdx] : b[0]);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    const latest = lines[0];
    const text = descIdx >= 0 ? latest[descIdx] : latest[1];
    const dateRaw = dateIdx >= 0 ? latest[dateIdx] : latest[0];
    const dateIso = parseILDate(dateRaw)?.toISOString() || (dateRaw ? String(dateRaw) : null);
    const location = cityIdx >= 0 ? latest[cityIdx] : null;
    if (text) return { text: String(text), date: dateIso, location: location || null };
  }

  // Fallback paths (other postal APIs / future variants).
  const items = json.Parcels || json.parcels || json.Items || json.items
    || json.data || (Array.isArray(json) ? json : null);
  const item = Array.isArray(items) ? items[0] : items;
  if (item) {
    const text = item.LastStatusDesc || item.StatusDescription || item.Status
      || item.statusDescription || item.status || item.EventDescription
      || (item.Events && item.Events[0] && (item.Events[0].EventDescription || item.Events[0].Description));
    const date = item.LastStatusDate || item.StatusDate || item.statusDate
      || (item.Events && item.Events[0] && (item.Events[0].EventDate || item.Events[0].Date));
    if (text) return { text: String(text), date: date ? String(date) : null, location: null };
  }

  return null;
}

async function fetchTrackingStatus(itemCode, { cacheDir, force = false, log = () => {} } = {}) {
  if (!itemCode) return { text: null, date: null, source: 'no-tracking' };

  // Sanitize: strip dashes/spaces, validate format. Bad formats fail immediately.
  const clean = sanitizeTracking(itemCode);
  if (!clean) return { text: null, date: null, source: 'invalid-format' };

  if (!force && cacheDir) {
    const cached = readCachedStatus(cacheDir, clean);
    if (cached) return { ...cached, source: 'cache' };
  }

  // Use the sanitized code for the actual lookup.
  itemCode = clean;

  let browser;
  try { browser = await getBrowser(); }
  catch (e) { return { text: null, date: null, source: `puppeteer-launch-failed:${e.message}` }; }

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Race: wait for the GetItemTrace JSON response OR a navigation timeout.
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(API_HINT) && r.status() === 200,
      { timeout: 20000 }
    ).catch(() => null);

    await page.goto(TRACK_URL(itemCode), { waitUntil: 'domcontentloaded', timeout: 25000 });

    const response = await responsePromise;
    if (response) {
      const json = await response.json().catch(() => null);
      const found = extractFromJson(json);
      if (found) {
        const result = { ...found, source: 'live' };
        if (cacheDir) writeCachedStatus(cacheDir, itemCode, result);
        return result;
      }
    }

    const failResult = { text: null, date: null, source: response ? 'json-no-match' : 'no-api-response' };
    if (cacheDir) writeCachedStatus(cacheDir, itemCode, failResult);
    return failResult;
  } catch (err) {
    const errResult = { text: null, date: null, source: `error:${err.message}` };
    if (cacheDir) writeCachedStatus(cacheDir, itemCode, errResult);
    return errResult;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function categorize(text) {
  if (!text) return 'unknown';
  if (/(delivered|נמסר|הסתיים)/i.test(text)) return 'delivered';
  if (/(out for delivery|delivery courier|חלוקה|יוצא לחלוקה|במסלול)/i.test(text)) return 'out-for-delivery';
  if (/(pickup|collection|איסוף|מוכן לאיסוף|מוכנה לאיסוף|ממתין לאיסוף)/i.test(text)) return 'awaiting-pickup';
  if (/(transit|sorting|received|departed|arrived|forwarded|נקלט|במיון|בעיבוד|התקבל|בדרך|נשלח)/i.test(text)) return 'in-transit';
  if (/(return|הוחזר|חזרה לשולח|address unknown|not delivered)/i.test(text)) return 'returned';
  return 'in-transit';
}

module.exports = { fetchTrackingStatus, closeBrowser, categorize };
