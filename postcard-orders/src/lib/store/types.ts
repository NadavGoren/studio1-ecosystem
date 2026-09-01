import type { Status } from "@/lib/domain";
import type { Order } from "@/types";

export interface Store {
  /** Every order we know about, newest order number first. */
  list(): Promise<Order[]>;
  /**
   * Insert new orders and refresh the Morning-derived fields of existing ones.
   * MUST NOT touch `status`, `statusAt` or `note` — those are ours, not Morning's,
   * and a re-import of an updated CSV has to leave the workflow untouched.
   */
  upsertMany(orders: Order[]): Promise<void>;
  /**
   * `shippedOn` (YYYY-MM-DD) is recorded ONLY when `status` is "shipped", and
   * an existing one is never cleared by a move to some other status — walking
   * an order back to ארוז to fix a typo must not lose the day it went out.
   */
  setStatus(orderId: string, status: Status, shippedOn?: string | null): Promise<Order | null>;
  /**
   * Set one status across many orders in a SINGLE atomic operation.
   * Never implement this as a loop of setStatus() calls from the caller: N
   * concurrent read-modify-write requests race and silently lose most of the
   * updates while every one of them still answers 200.
   */
  setStatusMany(
    orderIds: string[],
    status: Status,
    shippedOn?: string | null
  ): Promise<number>;
  /** When the CSV was last successfully imported — null if never. Set only
   *  by an import, never by editing an order, so it can't be mistaken for
   *  "when was this order last touched." */
  getLastImportAt(): Promise<string | null>;
  setLastImportAt(iso: string): Promise<void>;
  setNote(orderId: string, note: string): Promise<Order | null>;
}
