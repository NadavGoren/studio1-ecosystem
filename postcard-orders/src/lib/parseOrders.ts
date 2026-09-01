import { classify } from "@/lib/domain";
import { isPickupMethod, parseAddress, parsePickupPoint } from "@/lib/address";
import type { Order, OrderItem } from "@/types";

/** RFC 4180 CSV reader. Handles quoted fields, embedded commas, "" escapes, BOM. */
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // UTF-8 BOM from Morning

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines — Morning exports often end with one.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * Normalise a header cell so lookup survives the quote characters Morning uses.
 * It writes סה״כ with a geresh (U+05F4) and דוא״ל likewise; we fold those to ".
 */
function normHeader(h: string): string {
  return h
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Column name candidates, in preference order. */
const COLUMNS = {
  orderId: ["מספר הזמנה"],
  date: ["תאריך הזמנה"],
  sourceStatus: ["סטטוס הזמנה"],
  firstName: ["השם הפרטי של הלקוח"],
  lastName: ["שם המשפחה של הלקוח"],
  phone: ["טלפון הלקוח"],
  email: ["מייל", 'דוא"ל', "אימייל"],
  product: ["שם המוצר"],
  qty: ["כמות"],
  lineTotal: ['סה"כ כולל מע"מ', 'סה"כ'],
  method: ["שיטת מסירה"],
  address: ["כתובת המשלוח"],
  shipPhone: ["טלפון המשלוח"],
  noteOrder: ["הערה להזמנה"],
  noteShip: ["הערה למשלוח"],
} as const;

type ColumnKey = keyof typeof COLUMNS;

export class CsvFormatError extends Error {}

function buildIndex(header: string[]): Record<ColumnKey, number> {
  const norm = header.map(normHeader);
  const index = {} as Record<ColumnKey, number>;
  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    const candidates: readonly string[] = COLUMNS[key];
    let at = -1;
    for (const c of candidates) {
      at = norm.indexOf(c);
      if (at !== -1) break;
    }
    index[key] = at;
  }
  // Only the columns we cannot work without are fatal.
  const required: ColumnKey[] = ["orderId", "qty", "method"];
  const missing = required.filter((k) => index[k] === -1);
  if (missing.length) {
    throw new CsvFormatError(
      `לא נמצאו עמודות חובה בקובץ: ${missing.map((k) => COLUMNS[k][0]).join(", ")}`
    );
  }
  return index;
}

function num(v: string): number {
  const n = parseFloat((v || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Read a Morning export into merged orders.
 *
 * Morning emits ONE ROW PER PRODUCT LINE, so an order with three designs is
 * three rows sharing a מספר הזמנה. Quantity is summed across those rows — the
 * 24/72 split keys off the order total, not the row count. The `סה״כ כולל מע״מ`
 * column is likewise a LINE total, so it is summed too.
 */
export function ordersFromCsv(csvText: string): Order[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new CsvFormatError("הקובץ ריק או חסר שורת כותרות");

  const idx = buildIndex(rows[0]);
  const cell = (r: string[], k: ColumnKey) => (idx[k] === -1 ? "" : (r[idx[k]] ?? "").trim());

  const byId = new Map<string, Order>();

  for (const r of rows.slice(1)) {
    const orderId = cell(r, "orderId");
    if (!orderId) continue;

    const qty = Math.max(0, Math.round(num(cell(r, "qty"))));
    const product = cell(r, "product");
    const lineTotal = num(cell(r, "lineTotal"));

    const existing = byId.get(orderId);
    if (existing) {
      existing.qty += qty;
      existing.totalIls += lineTotal;
      mergeItem(existing.items, product, qty);
      continue;
    }

    const method = cell(r, "method");
    const kind = isPickupMethod(method) ? "pickup" : "mail";
    const addressRaw = cell(r, "address");
    const addr = kind === "mail" ? parseAddress(addressRaw) : null;

    byId.set(orderId, {
      orderId,
      orderDate: cell(r, "date"),
      sourceStatus: cell(r, "sourceStatus"),
      customer: [cell(r, "firstName"), cell(r, "lastName")].filter(Boolean).join(" ").trim(),
      // The shipping phone is the one the courier needs; fall back to the account phone.
      phone: cell(r, "shipPhone") || cell(r, "phone"),
      email: cell(r, "email"),

      methodRaw: method,
      kind,
      service: null, // set once every row has been folded in and qty is final
      pickupPoint: kind === "pickup" ? parsePickupPoint(method) : "",

      addressRaw,
      street: addr?.street ?? "",
      house: addr?.house ?? "",
      apartment: addr?.apartment ?? "",
      entrance: addr?.entrance ?? "",
      zip: addr?.zip ?? "",
      city: addr?.city ?? "",
      addrWarnings: addr?.warnings ?? [],
      addrBlocking: addr?.blocking ?? false,

      qty,
      totalIls: lineTotal,
      items: product ? [{ name: product, qty }] : [],
      noteOrder: cell(r, "noteOrder"),
      noteShip: cell(r, "noteShip"),

      status: "new",
      statusAt: null,
      note: "",
      updatedAt: new Date().toISOString(),
    });
  }

  // Service depends on the merged quantity, so it is resolved only now.
  for (const o of byId.values()) {
    o.service = o.kind === "mail" ? classify(o.qty) : null;
  }

  return [...byId.values()];
}

function mergeItem(items: OrderItem[], name: string, qty: number) {
  if (!name) return;
  const hit = items.find((i) => i.name === name);
  if (hit) hit.qty += qty;
  else items.push({ name, qty });
}
