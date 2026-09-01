import { promises as fs } from "node:fs";
import path from "node:path";
import type { Status } from "@/lib/domain";
import type { Order } from "@/types";
import type { Store } from "./types";

/**
 * Development-only driver: the whole dataset as one JSON file under ./.data.
 * Read-modify-write, so it is single-writer by nature — fine for one person on
 * one laptop, which is exactly and only what it is for. Production uses Postgres.
 */
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "orders.json");

async function read(): Promise<Order[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Order[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function write(orders: Order[]): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(orders, null, 2), "utf8");
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
      byId.set(o.orderId, {
        ...o,
        // Our workflow fields survive the import untouched.
        status: prev?.status ?? o.status,
        statusAt: prev?.statusAt ?? null,
        note: prev?.note ?? "",
        updatedAt: new Date().toISOString(),
      });
    }
    await write([...byId.values()]);
  },

  async setStatus(orderId, status: Status) {
    const all = await read();
    const hit = all.find((o) => o.orderId === orderId);
    if (!hit) return null;
    hit.status = status;
    hit.statusAt = new Date().toISOString();
    hit.updatedAt = hit.statusAt;
    await write(all);
    return hit;
  },

  async setStatusMany(orderIds, status: Status) {
    const ids = new Set(orderIds);
    const all = await read();
    const at = new Date().toISOString();
    let n = 0;
    for (const o of all) {
      if (!ids.has(o.orderId)) continue;
      o.status = status;
      o.statusAt = at;
      o.updatedAt = at;
      n++;
    }
    await write(all);
    return n;
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
};
