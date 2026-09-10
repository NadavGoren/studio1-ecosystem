import { postageIls, remedyLabel, serviceLabel } from "@/lib/domain";
import { splitName } from "@/lib/shipSequence";
import type { Order } from "@/types";

/**
 * Current orders, as a CSV.
 *
 * Distinct from the stored upload that `/api/orders/import` hands back: that
 * one is the exact file Morning produced, this one is built from the database
 * and therefore includes everything the app itself knows — status, ship date,
 * our notes, postage.
 *
 * Shaped like a Morning export on purpose, using its exact column names and
 * ONE ROW PER PRODUCT LINE, so this file can be fed back through the importer.
 * That makes it a usable backup, not just a report. The app's own columns are
 * appended after Morning's; the importer looks columns up by name and ignores
 * ones it does not know, so they ride along harmlessly.
 */

/** Morning's own columns, spelled exactly as `parseOrders` looks for them. */
const MORNING_COLUMNS = [
  "מספר הזמנה",
  "תאריך הזמנה",
  "סטטוס הזמנה",
  "השם הפרטי של הלקוח",
  "שם המשפחה של הלקוח",
  "טלפון הלקוח",
  "מייל",
  "שם המוצר",
  "כמות",
  'סה"כ כולל מע"מ',
  "שיטת מסירה",
  "כתובת המשלוח",
  "טלפון המשלוח",
  "הערה להזמנה",
  "הערה למשלוח",
] as const;

/** Ours. Unknown to the importer, which is why they are safe to append. */
const OWN_COLUMNS = [
  "שירות",
  "דמי משלוח",
  "סטטוס טיפול",
  "תאריך שליחה",
  "הערה שלנו",
  // The complaint, spread across its own columns rather than stuffed into one
  // cell — the refunds actually paid have to be filterable in a spreadsheet,
  // which is where that reckoning gets done.
  "תלונה — תאריך דיווח",
  "תלונה — סוכם",
  "תלונה — בוצע בתאריך",
  "תלונה — סכום זיכוי",
  "תלונה — פירוט",
] as const;

/** RFC 4180: quote only when it matters, and double an inner quote. */
function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordersToCsv(orders: Order[]): string {
  const rows: string[] = [[...MORNING_COLUMNS, ...OWN_COLUMNS].map(cell).join(",")];

  for (const o of orders) {
    const [first, last] = splitName(o.customer);
    // An order with no product lines still gets one row — a row per item would
    // drop it entirely, and losing an order from a backup is the one outcome
    // worth guarding against.
    const items = o.items.length ? o.items : [{ name: "", qty: o.qty }];

    items.forEach((it, i) => {
      rows.push(
        [
          o.orderId,
          o.orderDate,
          o.sourceStatus,
          first,
          last,
          o.phone,
          o.email,
          it.name,
          it.qty,
          // The order total belongs to the ORDER, but Morning's column is a LINE
          // total that the importer sums. Putting it all on the first line keeps
          // that sum right instead of multiplying it by the number of lines.
          i === 0 ? o.totalIls : 0,
          o.methodRaw,
          o.addressRaw,
          o.phone,
          o.noteOrder,
          o.noteShip,
          o.service ? serviceLabel[o.service] : "",
          o.kind === "mail" ? postageIls(o.qty).toFixed(2) : "",
          o.status,
          o.shippedOn ?? "",
          o.note,
          o.complaint?.reportedOn ?? "",
          o.complaint?.remedy ? remedyLabel[o.complaint.remedy] : "",
          o.complaint?.doneOn ?? "",
          // Only against a refund: an amount left over from a remedy that was
          // changed later would read here as money we paid, and we didn't.
          o.complaint?.remedy === "refund" && o.complaint.refundIls !== null
            ? o.complaint.refundIls.toFixed(2)
            : "",
          o.complaint?.note ?? "",
        ].map(cell).join(",")
      );
    });
  }

  // BOM + CRLF: without both, Excel on Windows opens Hebrew as mojibake and
  // treats the whole file as one column.
  return "﻿" + rows.join("\r\n") + "\r\n";
}
