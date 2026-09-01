import { Pool } from "pg";
import type { Status } from "@/lib/domain";
import type { Order } from "@/types";
import type { Store } from "./types";

/**
 * Production driver. Every write is a single atomic statement, so Nadav and his
 * partner can both be marking orders at the same moment without either of them
 * silently overwriting the other.
 */

const CONNECTION =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

// Reused across warm invocations; a new pool per request would exhaust Postgres.
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: CONNECTION,
      // Hosted Postgres (Neon/Supabase/…) terminates TLS with its own chain.
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  order_id      TEXT PRIMARY KEY,
  order_date    TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL DEFAULT '',
  customer      TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  method_raw    TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'mail',
  service       TEXT,
  pickup_point  TEXT NOT NULL DEFAULT '',
  address_raw   TEXT NOT NULL DEFAULT '',
  street        TEXT NOT NULL DEFAULT '',
  house         TEXT NOT NULL DEFAULT '',
  apartment     TEXT NOT NULL DEFAULT '',
  entrance      TEXT NOT NULL DEFAULT '',
  zip           TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  addr_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  addr_blocking BOOLEAN NOT NULL DEFAULT false,
  qty           INTEGER NOT NULL DEFAULT 0,
  total_ils     NUMERIC NOT NULL DEFAULT 0,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  note_order    TEXT NOT NULL DEFAULT '',
  note_ship     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new',
  status_at     TIMESTAMPTZ,
  note          TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

let ready: Promise<void> | null = null;
/** Create the table on first use so there is no separate migration step. */
function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        ready = null; // let the next request retry rather than caching the failure
        throw e;
      });
  }
  return ready;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toOrder(r: any): Order {
  return {
    orderId: r.order_id,
    orderDate: r.order_date,
    sourceStatus: r.source_status,
    customer: r.customer,
    phone: r.phone,
    email: r.email,
    methodRaw: r.method_raw,
    kind: r.kind,
    service: r.service,
    pickupPoint: r.pickup_point,
    addressRaw: r.address_raw,
    street: r.street,
    house: r.house,
    apartment: r.apartment,
    entrance: r.entrance,
    zip: r.zip,
    city: r.city,
    addrWarnings: r.addr_warnings ?? [],
    addrBlocking: r.addr_blocking,
    qty: r.qty,
    totalIls: Number(r.total_ils),
    items: r.items ?? [],
    noteOrder: r.note_order,
    noteShip: r.note_ship,
    status: r.status,
    statusAt: r.status_at ? new Date(r.status_at).toISOString() : null,
    note: r.note,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export const pgStore: Store = {
  async list() {
    await ensureSchema();
    const { rows } = await getPool().query(
      // Numeric-aware ordering so 7601 sorts above 999.
      `SELECT * FROM orders ORDER BY NULLIF(regexp_replace(order_id, '\\D', '', 'g'), '')::numeric DESC NULLS LAST, order_id DESC`
    );
    return rows.map(toOrder);
  },

  async upsertMany(incoming) {
    if (!incoming.length) return;
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const o of incoming) {
        await client.query(
          `INSERT INTO orders (
             order_id, order_date, source_status, customer, phone, email,
             method_raw, kind, service, pickup_point, address_raw,
             street, house, apartment, entrance, zip, city,
             addr_warnings, addr_blocking, qty, total_ils, items,
             note_order, note_ship, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18::jsonb,$19,$20,$21,$22::jsonb,$23,$24, now()
           )
           ON CONFLICT (order_id) DO UPDATE SET
             order_date = EXCLUDED.order_date,
             source_status = EXCLUDED.source_status,
             customer = EXCLUDED.customer,
             phone = EXCLUDED.phone,
             email = EXCLUDED.email,
             method_raw = EXCLUDED.method_raw,
             kind = EXCLUDED.kind,
             service = EXCLUDED.service,
             pickup_point = EXCLUDED.pickup_point,
             address_raw = EXCLUDED.address_raw,
             street = EXCLUDED.street,
             house = EXCLUDED.house,
             apartment = EXCLUDED.apartment,
             entrance = EXCLUDED.entrance,
             zip = EXCLUDED.zip,
             city = EXCLUDED.city,
             addr_warnings = EXCLUDED.addr_warnings,
             addr_blocking = EXCLUDED.addr_blocking,
             qty = EXCLUDED.qty,
             total_ils = EXCLUDED.total_ils,
             items = EXCLUDED.items,
             note_order = EXCLUDED.note_order,
             note_ship = EXCLUDED.note_ship,
             updated_at = now()
             -- status, status_at and note are deliberately NOT updated:
             -- they are ours, and a re-import must never reset the workflow.
          `,
          [
            o.orderId, o.orderDate, o.sourceStatus, o.customer, o.phone, o.email,
            o.methodRaw, o.kind, o.service, o.pickupPoint, o.addressRaw,
            o.street, o.house, o.apartment, o.entrance, o.zip, o.city,
            JSON.stringify(o.addrWarnings), o.addrBlocking, o.qty, o.totalIls,
            JSON.stringify(o.items), o.noteOrder, o.noteShip,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  async setStatus(orderId, status: Status) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `UPDATE orders SET status = $2, status_at = now(), updated_at = now()
       WHERE order_id = $1 RETURNING *`,
      [orderId, status]
    );
    return rows[0] ? toOrder(rows[0]) : null;
  },

  async setNote(orderId, note) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `UPDATE orders SET note = $2, updated_at = now() WHERE order_id = $1 RETURNING *`,
      [orderId, note]
    );
    return rows[0] ? toOrder(rows[0]) : null;
  },
};

export const hasPostgres = Boolean(CONNECTION);
