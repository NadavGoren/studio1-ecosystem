import { parseAddress } from "@/lib/address";
import { classify } from "@/lib/domain";
import type { Order } from "@/types";

/**
 * Build an Order from what the manual-entry form collects.
 *
 * Everything derived — service, address parts, warnings — goes through the same
 * functions the CSV importer uses, so a hand-entered order behaves exactly like
 * an imported one everywhere else in the app. Nothing here is a parallel
 * implementation of a rule that already exists.
 */

export interface NewOrderInput {
  orderId?: string;
  customer: string;
  phone?: string;
  email?: string;
  kind: "mail" | "pickup";
  /* Address as separate parts. Morning gives one free-text field and the app
     parses it; there is no reason to make someone typing a fresh order imitate
     that format — especially since it puts the city AFTER the postcode, which
     nobody guesses right. */
  street?: string;
  house?: string;
  city?: string;
  zip?: string;
  pickupPoint?: string;
  qty: number;
  totalIls?: number;
  product?: string;
  note?: string;
}

/**
 * Next free `M-n`. Prefixed so it can never be mistaken for — or collide with —
 * a Morning order number, which is always digits.
 */
export function nextManualId(existing: Order[]): string {
  let max = 0;
  for (const o of existing) {
    const m = /^M-(\d+)$/.exec(o.orderId);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `M-${max + 1}`;
}

export class NewOrderError extends Error {}

export function buildManualOrder(input: NewOrderInput, orderId: string): Order {
  const customer = (input.customer ?? "").trim();
  if (!customer) throw new NewOrderError("שם הלקוח חסר");

  const qty = Math.round(Number(input.qty));
  if (!Number.isFinite(qty) || qty < 1) throw new NewOrderError("כמות הגלויות חייבת להיות לפחות 1");

  const kind = input.kind === "pickup" ? "pickup" : "mail";
  // Composed into Morning's exact shape and then run through the same parser,
  // so a manual address gets the identical warnings and ⚠ flag an imported one
  // would. Validation stays in one place instead of being written twice.
  const addressRaw =
    kind === "mail"
      ? [
          [(input.street ?? "").trim(), (input.house ?? "").trim()].filter(Boolean).join(" "),
          (input.zip ?? "").trim() ? `מיקוד ${(input.zip ?? "").trim()}` : "",
          (input.city ?? "").trim(),
        ]
          .filter(Boolean)
          .join(", ")
      : "";
  const addr = kind === "mail" ? parseAddress(addressRaw) : null;
  const product = (input.product ?? "").trim();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    orderId,
    // Today, in the same YYYY-MM-DD shape Morning writes, so sorting and the
    // detail panel need no special case for a manual order.
    orderDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    sourceStatus: "",
    customer,
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),

    methodRaw: kind === "pickup" ? "איסוף עצמי" : "משלוח",
    kind,
    service: kind === "mail" ? classify(qty) : null,
    pickupPoint: kind === "pickup" ? (input.pickupPoint ?? "").trim() : "",

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
    totalIls: Number.isFinite(Number(input.totalIls)) ? Number(input.totalIls) : 0,
    // One line, like a single-product Morning order. Named so it still shows up
    // in the best-sellers list rather than vanishing from it.
    items: product ? [{ name: product, qty }] : [],
    noteOrder: "",
    noteShip: "",

    manual: true,
    status: "new",
    statusAt: null,
    shippedOn: null,
    complaint: null,
    note: (input.note ?? "").trim(),
    updatedAt: now.toISOString(),
  };
}
