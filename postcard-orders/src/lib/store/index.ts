import { ordersFromCsv } from "@/lib/parseOrders";
import type { ImportReport, Order } from "@/types";
import { fileStore } from "./file";
import { hasPostgres, pgStore } from "./postgres";
import type { Store } from "./types";

export type { Store } from "./types";

/**
 * Postgres when a connection string is configured, otherwise a local JSON file so
 * the app can be run and tried with zero setup.
 *
 * The file driver is refused in production: Vercel's filesystem is read-only, so
 * it would read as an empty table and then fail with an opaque EROFS on the first
 * import. Better to say plainly that the database isn't connected yet.
 */
export function getStore(): Store {
  if (!hasPostgres && process.env.NODE_ENV === "production") {
    throw new Error(
      "אין חיבור למסד נתונים. ב-Vercel: Storage ← Create Database ← Postgres, ואז Redeploy."
    );
  }
  return hasPostgres ? pgStore : fileStore;
}

export const storeKind = (): "postgres" | "file" => (hasPostgres ? "postgres" : "file");

/** The Morning-derived fields, as one string. Changes here mean the CSV moved. */
function fingerprint(o: Order): string {
  return JSON.stringify([
    o.customer, o.phone, o.email, o.methodRaw, o.addressRaw,
    o.qty, o.totalIls, o.items, o.noteOrder, o.noteShip, o.sourceStatus,
  ]);
}

/**
 * Import a Morning CSV: merge its rows into orders, write them, and report what
 * actually moved. Existing workflow statuses are preserved by the store layer.
 */
export async function importCsv(csvText: string): Promise<ImportReport> {
  const incoming = ordersFromCsv(csvText);
  const store = getStore();
  const before = new Map((await store.list()).map((o) => [o.orderId, o]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let statusesKept = 0;
  const serviceChanges: ImportReport["serviceChanges"] = [];

  for (const o of incoming) {
    const prev = before.get(o.orderId);
    if (!prev) {
      created++;
      continue;
    }
    // Worth stating outright in the report: this is the guarantee Nadav relies on
    // every time he re-uploads, and it should be visible rather than assumed.
    if (prev.status !== "new") statusesKept++;
    if (prev.service !== o.service) {
      // Worth surfacing: an order that grew past 3 cards changes post service,
      // and may already have been packed or labelled under the old one.
      serviceChanges.push({ orderId: o.orderId, from: prev.service, to: o.service });
    }
    if (fingerprint(prev) === fingerprint(o)) unchanged++;
    else updated++;
  }

  await store.upsertMany(incoming);

  return {
    parsedRows: incoming.reduce((n, o) => n + o.items.length, 0),
    orders: incoming.length,
    created,
    updated,
    unchanged,
    serviceChanges,
    statusesKept,
    problems: incoming.filter((o) => o.kind === "mail" && o.addrBlocking).length,
  };
}
