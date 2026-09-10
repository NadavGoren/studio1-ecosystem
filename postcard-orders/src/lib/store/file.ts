import { promises as fs } from "node:fs";
import path from "node:path";
import type { Complaint, Status } from "@/lib/domain";
import type { Order } from "@/types";
import type { Store } from "./types";

/**
 * Development-only driver: the whole dataset as one JSON file under ./.data.
 * Read-modify-write, so it is single-writer by nature — fine for one person on
 * one laptop, which is exactly and only what it is for. Production uses Postgres.
 */
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "orders.json");
const META_FILE = path.join(DIR, "meta.json");
// Kept as a real .csv rather than stuffed into meta.json, so it stays readable
// and diffable on disk during development.
const CSV_FILE = path.join(DIR, "last-import.csv");

async function read(): Promise<Order[]> {
  try {
    const all = JSON.parse(await fs.readFile(FILE, "utf8")) as Order[];
    // Rows written before complaints existed have no such key at all, and
    // `undefined` would reach the client as a missing field rather than as
    // "no complaint". Postgres gets the same treatment in toOrder().
    return all.map((o) => ({ ...o, complaint: o.complaint ?? null }));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function write(orders: Order[]): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(orders, null, 2), "utf8");
}

type Meta = { lastImportAt: string | null; lastImportName?: string };

async function readMeta(): Promise<Meta> {
  try {
    return JSON.parse(await fs.readFile(META_FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { lastImportAt: null };
    throw e;
  }
}

async function writeMeta(meta: Meta): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), "utf8");
}

export const fileStore: Store = {
  async list() {
    const all = await read();
    return all.sort((a, b) => b.orderId.localeCompare(a.orderId, "en", { numeric: true }));
  },

  async upsertMany(incoming) {
    const existing = await read();
    const byId = new Map(existing.map((o) => [o.orderId, o]));
    for (const o of incoming) {
      const prev = byId.get(o.orderId);
      // Same guard as the Postgres driver: an import never overwrites an order
      // that was entered by hand.
      if (prev?.manual) continue;
      byId.set(o.orderId, {
        ...o,
        // Our workflow fields survive the import untouched.
        manual: false,
        status: prev?.status ?? o.status,
        statusAt: prev?.statusAt ?? null,
        shippedOn: prev?.shippedOn ?? null,
        note: prev?.note ?? "",
        complaint: prev?.complaint ?? null,
        updatedAt: new Date().toISOString(),
      });
    }
    await write([...byId.values()]);
  },

  // Same rule as the Postgres driver: shipped_on is written only on the way
  // into "shipped", and never cleared by any other status.
  async createOrder(o) {
    const all = await read();
    // Same contract as the Postgres driver: a taken number is refused, never
    // overwritten.
    if (all.some((x) => x.orderId === o.orderId)) return null;
    const created = { ...o, manual: true };
    all.push(created);
    await write(all);
    return created;
  },

  async deleteManualOrder(orderId) {
    const all = await read();
    const keep = all.filter((o) => !(o.orderId === orderId && o.manual));
    if (keep.length === all.length) return false;
    await write(keep);
    return true;
  },

  async setStatus(orderId, status: Status, shippedOn = null) {
    const all = await read();
    const hit = all.find((o) => o.orderId === orderId);
    if (!hit) return null;
    hit.status = status;
    hit.statusAt = new Date().toISOString();
    if (status === "shipped") hit.shippedOn = shippedOn;
    hit.updatedAt = hit.statusAt;
    await write(all);
    return hit;
  },

  async setStatusMany(orderIds, status: Status, shippedOn = null) {
    const ids = new Set(orderIds);
    const all = await read();
    const at = new Date().toISOString();
    let n = 0;
    for (const o of all) {
      if (!ids.has(o.orderId)) continue;
      o.status = status;
      o.statusAt = at;
      if (status === "shipped") o.shippedOn = shippedOn;
      o.updatedAt = at;
      n++;
    }
    await write(all);
    return n;
  },

  async getLastImportFileInfo() {
    try {
      const [stat, meta] = await Promise.all([fs.stat(CSV_FILE), readMeta()]);
      if (!stat.size) return null;
      return { filename: meta.lastImportName || "morning.csv", bytes: stat.size };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },

  async getLastImportFile() {
    try {
      const [csv, meta] = await Promise.all([
        fs.readFile(CSV_FILE, "utf8"),
        readMeta(),
      ]);
      return { csv, filename: meta.lastImportName || "morning.csv" };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },

  async setLastImportFile(csv, filename) {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(CSV_FILE, csv, "utf8");
    await writeMeta({ ...(await readMeta()), lastImportName: filename });
  },

  async setComplaint(orderId, complaint: Complaint | null) {
    const all = await read();
    const hit = all.find((o) => o.orderId === orderId);
    if (!hit) return null;
    hit.complaint = complaint;
    // Not statusAt: a complaint is not a status change.
    hit.updatedAt = new Date().toISOString();
    await write(all);
    return hit;
  },

  async setNote(orderId, note) {
    const all = await read();
    const hit = all.find((o) => o.orderId === orderId);
    if (!hit) return null;
    hit.note = note;
    hit.updatedAt = new Date().toISOString();
    await write(all);
    return hit;
  },

  async getLastImportAt() {
    return (await readMeta()).lastImportAt;
  },

  async setLastImportAt(iso) {
    await writeMeta({ lastImportAt: iso });
  },
};
