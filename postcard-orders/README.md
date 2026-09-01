# הזמנות גלויות · Postcard Orders

Order and shipping tracker for the Studio 1 Rosh Hashanah postcard run.
Upload the Morning CSV, get one organised table: every order merged, sorted into
דואר 24 / דואר 72 / איסוף עצמי, with a status per order and a one-click contact
panel for filling in דואר בקליק.

Hebrew RTL. Runs locally on port **6120**, deploys to Vercel for sharing.

---

## The rules it encodes

| Rule | Where |
|---|---|
| 1–2 postcards → דואר 72 · 3+ → דואר 24 | `SERVICE_THRESHOLD` in [src/lib/domain.ts](src/lib/domain.ts) |
| Weight = 12g packaging + 6g per card | `PACKAGING_G`, `PER_CARD_G`, same file |
| Israel Post tariff bands (Jan 2026) | `TARIFF`, same file |

The 24/72 split keys off the **merged order quantity**, not the row count —
Morning writes one row per product line, so an order with three designs is three
rows sharing a מספר הזמנה. They are summed before classifying.

> The weight constants are copied from the brief and **have not been checked on a
> real scale**. They only affect the displayed weight and which tariff band shows;
> they never affect the 24/72 split.

## Statuses

Mail orders: `חדש → ארוז → מדבקה הודפסה → נשלח → נמסר`
Pickup orders: `חדש → מוכן לאיסוף → נאסף` — no label, never posted.
Either can be flagged `בעיה / תקוע`.

## Re-importing

Upload the updated CSV as often as you like. New orders are added, existing ones
have their Morning fields refreshed, and **the statuses and notes you set are
never touched**. The import report tells you what changed, and specifically
flags any order whose quantity changed enough to move it between דואר 24 and
דואר 72 — worth seeing if you already packed it.

## Address validation

Morning's address is one free-text field and the format is inconsistent. Orders
are flagged with ⚠ in the table when the address would not be accepted:

- postcode that is not exactly 7 digits, or is all zeros
- missing city
- missing street

A missing house number is only a soft warning — small communities genuinely
have none.

---

## Filling the דואר בקליק form

Open an order, hit **c** (or the **העתק לרצף** button). On the דואר בקליק form,
press **Ctrl+V** in each field in turn — every paste inserts the *next* value,
so you never go back and forth to copy again.

Install [`tools/israelpost-sequence.user.js`](tools/israelpost-sequence.user.js)
in [Tampermonkey](https://www.tampermonkey.net/) once. It runs on
`israelpost.co.il` only.

**There is no cross-origin storage anywhere in this.** The panel copies all
seven fields as one seven-line block, and that whole block rides along on every
paste event — so the userscript reads the list out of the clipboard each time
and only has to remember how far down it has got. Two consequences worth
knowing:

- Copying a **different order resets the sequence by itself**, because the
  payload changed. You almost never need the reset button.
- A **single-line clipboard is left completely alone**, so ordinary copy-paste
  on that site still behaves normally. Only a seven-line block is treated as a
  sequence.

A floating badge bottom-left shows which field is next **and the value it is
about to paste** — that is how you catch a bad first/last-name split before it
lands in the form. Its buttons step back (↑), skip a field (↓) and start over
(↺, or Alt+Shift+R). After the seventh field it turns green and *swallows*
further pastes rather than dumping the whole block into a field.

Fields the order doesn't have are skipped, not pasted as blanks. The wire
format is positional and fixed-length, so `SEQUENCE_FIELDS` and `EMPTY` in
[src/lib/shipSequence.ts](src/lib/shipSequence.ts) and the `FIELDS`/`EMPTY`
constants at the top of the userscript **must be changed together**.

Without the userscript installed the copy button is still useful — it puts the
whole order on the clipboard in form order.

---

## Running locally

```bash
npm install && npm run dev
```

Then open http://localhost:6120 — or double-click `Launch.command`, or pick
**הזמנות גלויות** in the Studio 1 dashboard.

With no `DATABASE_URL` set, data is kept in `.data/orders.json` and there is no
password. Two badges in the header say so: **מצב מקומי** and **ללא סיסמה**. This
mode is for one person on one laptop; it is not what runs in production.

---

## Deploying to Vercel

### 1. Push the repo

The app lives in the `postcard-orders/` subdirectory of `studio1-ecosystem`.

### 2. Import the project

At [vercel.com/new](https://vercel.com/new), pick the `studio1-ecosystem` repo and
set **Root Directory** to `postcard-orders`. Framework detects as Next.js.

### 3. Connect the database

In the project → **Storage** → **Create Database** → **Postgres** (Neon). Accept
the free plan and connect it to the project. Vercel injects `DATABASE_URL`
automatically; you never paste it anywhere. The `orders` table is created on
first use — there is no migration step.

### 4. Set two environment variables

Project → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `APP_PASSWORD` | the password you and your partner will share |
| `AUTH_SECRET` | a long random string — `openssl rand -hex 32` |

Then **Redeploy** so they take effect.

> Without `APP_PASSWORD` a production deploy refuses to serve anything and
> returns a 503 explaining what is missing. That is deliberate: the table holds
> real customer phone numbers and addresses, and failing open would publish them.

### 5. Share the URL

Your partner opens it, types the password once, and stays logged in on that
device for 30 days. Both of you can mark orders at the same time — every write
is a single atomic statement, so neither of you can silently overwrite the other.

---

## Layout

```
src/
  lib/
    domain.ts        business rules — the 24/72 threshold, weight, tariff, statuses
    address.ts       free-text address → parts, with validation
    parseOrders.ts   CSV reader + Morning row merging
    auth.ts          shared-password cookie (Web Crypto, runs on Edge and Node)
    store/
      index.ts       driver selection + the import diff/report
      postgres.ts    production driver
      file.ts        local JSON driver, dev only
  app/
    page.tsx         reads the store server-side, renders the table
    login/           password screen
    api/             orders (list), orders/import, orders/[id] (PATCH), auth
  components/
    OrdersView.tsx   table, tabs, filters, sorting, keyboard nav
    OrderDetail.tsx  contact panel with the copy buttons
    SequenceCopy.tsx the seven-field copy for the דואר בקליק form
    ImportDialog.tsx CSV drop zone and import report
tools/
  israelpost-sequence.user.js  Tampermonkey script for the other end of that
```

## Not included

This is the tracker only. Label PDFs, barcode-range management and the Israel
Post manifest file described in `BRIEF.md` are a separate job — and still blocked
on Israel Post confirming the barcode symbology and allocating a range.
