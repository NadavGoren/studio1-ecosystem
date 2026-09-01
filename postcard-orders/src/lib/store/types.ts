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
  setStatus(orderId: string, status: Status): Promise<Order | null>;
  setNote(orderId: string, note: string): Promise<Order | null>;
}
