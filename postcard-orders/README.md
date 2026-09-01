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
| A postcard weighs 25g — nothing else counts | `PER_CARD_G` in [src/lib/domain.ts](src/lib/domain.ts) |
| דואר 72 is capped at 50g; over it goes דואר 24 | `POST72_MAX_G`, same file |
| Israel Post tariff bands (Jan 2026) | `TARIFF`, same file |
| Status ladders, per order kind | `FLOW_MAIL` / `FLOW_PICKUP`, same file |

**The 24/72 split is the weight rule, not a second rule that happens to agree
with it.** A postcard is 25g and דואר 72 stops at 50g, so two fit exactly and
three cannot. `classify()` derives the service from the weight instead of
comparing quantity against a hardcoded 3, so the two cannot drift apart —
`SERVICE_THRESHOLD` is computed from the weight, not chosen alongside it.

It keys off the **merged order quantity**, not the row count — Morning writes one
row per product line, so an order with three designs is three rows sharing a
מספר הזמנה. They are summed before classifying.

> Packaging is deliberately **not** counted. Any weight added for the envelope
> puts two cards over 50g and quietly moves every two-card order into דואר 24.
>
> `TARIFF.post24` runs out at 350g — 14 cards. A larger order shows
> `מעל המדרגות` rather than a price. The heavier bands should be copied from the
> Israel Post price list, never guessed.

## Best sellers

Under the totals: every design ranked by how many postcards of it were sold,
with a share bar. Counts postcards, not orders — an order of four rimonim
contributes four — so **these numbers add up to exactly the סה״כ גלויות figure
above** and the two cannot drift apart.

Like the totals, it reads every order, not the filtered view: "what sold best"
is a fact about the run, not about what happens to be on screen.

Morning's product names share a long prefix (`גלויית שנה טובה — רימון`), which
is the least useful part of a ranked list, so the shared run is stripped and
only the distinguishing word is shown. It is only cut at a separator, never
mid-word, and the full name stays on hover.

Open by default on a desktop, folded on a phone — expanded it costs ~155px
there, which takes the order list from seven rows on screen down to three. The
summary line still carries the top seller while folded.

`גלויות בממוצע להזמנה` sits with the other totals. One decimal, deliberately:
the difference between 3.0 and 3.4 is the difference in how much of the run is
דואר 24.

## Statuses

Mail orders: `חדש → ארוז → מדבקה הודפסה → נשלח → נמסר`
Pickup orders: `חדש → מוכן לאיסוף → הודעה נשלחה → נאסף` — no label, never posted.
Either can be flagged `בעיה / תקוע`.

`הודעה נשלחה` is the SMS or WhatsApp telling a pickup customer their order is
waiting. It is pickup-only: it never appears on the shipments table, and the
mail ladder is unchanged.

### The ship date

`נשלח` is the one status that carries a date of its own, because the day a
parcel went out and the day you got round to marking it are often not the same.
It is kept separately from `statusAt` and can be backdated:

- the one-click **← נשלח** button files it under **today**, which is what
  marking a parcel as it goes out means;
- picking **נשלח** from the dropdown, the detail panel, or the bulk bar asks
  **היום / אתמול / תאריך אחר** first. A bulk change asks once for the whole
  selection, not once per order.

The date is written **only** on the way into `נשלח`, and never cleared by a
later status — walking an order back to `ארוז` to fix a mistake does not lose
the day it actually went out. Like statuses and notes, it survives a re-import.

## When the CSV was last uploaded

Shown at the end of the totals row — "עודכן לפני 3 שע׳" — because the cubes are
only as current as the file behind them. It turns amber once the CSV is over a
day old.

## On a phone

The table becomes a list, not a stack of cards. One order is two tight lines —
name, warning flag and status on top; `1042 · 4 גלויות · דואר 24 · תל אביב`
underneath — so six or seven orders fit on screen instead of one and a half.

Both status controls stay: the pill opens the full list, the ← button still
advances one rung in a single tap.

The totals are chips rather than tiles for the same reason. As stacked cards
they pushed the first order about 450px down the page, which defeats the point
of a list you can scan; the order date is dropped from the row and lives in the
detail panel, which opens as a bottom sheet on tap.

Two CSS traps are commented in `globals.css`, both of which silently restore the
tall layout if disturbed: `width: 100%` must not reach the `td` (as flex items,
full-width cells each take their own line), and the padding override has to be
`tbody td`, not `td`, to match the specificity of the desktop rule.

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

> Adding a **column** later is not covered by that. `CREATE TABLE IF NOT EXISTS`
> does nothing to a table that already exists, so every new column needs its own
> `ALTER TABLE … ADD COLUMN IF NOT EXISTS` line in `SCHEMA` beside it — see
> `shipped_on` in [src/lib/store/postgres.ts](src/lib/store/postgres.ts). Miss
> it and dev looks fine, where the table is built fresh, while production 500s
> on the first query that selects the column.

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
