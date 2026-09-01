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
  /**
   * Set one status across many orders in a SINGLE atomic operation.
   * Never implement this as a loop of setStatus() calls from the caller: N
   * concurrent read-modify-write requests race and silently lose most of the
   * updates while every one of them still answers 200.
   */
  setStatusMany(orderIds: string[], status: Status): Promise<number>;
  setNote(orderId: string, note: string): Promise<Order | null>;
}
