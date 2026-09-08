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
  /**
   * Insert one hand-entered order. Rejects a duplicate order number rather than
   * overwriting — this is the one write that creates an order out of nothing,
   * and quietly replacing an existing one would lose real work.
   */
  createOrder(order: Order): Promise<Order | null>;
  /**
   * Delete a hand-entered order. MUST refuse anything that came from a CSV —
   * an imported order would just reappear on the next import, so deleting one
   * only looks like it worked. Enforced here, not in the UI.
   * Returns false when nothing was deleted.
   */
  deleteManualOrder(orderId: string): Promise<boolean>;
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

  /* ── The uploaded file itself ────────────────────────────────────────────
   * Kept verbatim so the exact CSV can be handed back later. Deliberately not
   * regenerated from the orders table: that would lose Morning's own columns
   * and its one-row-per-product-line shape, and would silently be a different
   * file from the one that came in.
   */

  /** Size and name only — enough to render a download button without pulling
   *  a few hundred KB of CSV through a page render. */
  getLastImportFileInfo(): Promise<{ filename: string; bytes: number } | null>;
  getLastImportFile(): Promise<{ csv: string; filename: string } | null>;
  setLastImportFile(csv: string, filename: string): Promise<void>;
}
