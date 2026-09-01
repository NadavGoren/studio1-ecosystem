/**
 * Business rules for Studio 1 postcard shipping.
 *
 * The service split is Nadav's own rule — it is NOT derived from the Israel Post
 * price list or from weight. It lives here as a single constant so it can be
 * changed in one place if the rule ever changes.
 */

/** Orders with this many postcards or more go דואר 24; fewer go דואר 72. */
export const SERVICE_THRESHOLD = 3;

/** Envelope/packaging weight in grams. NOT yet verified on a real scale. */
export const PACKAGING_G = 12;
/** Weight of a single postcard in grams. NOT yet verified on a real scale. */
export const PER_CARD_G = 6;

export type Service = "post24" | "post72";
export type Kind = "mail" | "pickup";

/** Which service an order takes, from the number of postcards in it. */
export function classify(qty: number): Service {
  return qty >= SERVICE_THRESHOLD ? "post24" : "post72";
}

/** Total posted weight in grams. */
export function weightG(qty: number): number {
  return PACKAGING_G + PER_CARD_G * qty;
}

/**
 * Israel Post tariff, business rates incl. VAT, January 2026.
 * Bands are "up to N grams"; the first band whose ceiling the parcel fits under wins.
 */
const TARIFF: Record<Service, { maxG: number; ils: number }[]> = {
  post72: [{ maxG: 50, ils: 4.7 }],
  post24: [
    { maxG: 50, ils: 10.5 },
    { maxG: 100, ils: 11.0 },
    { maxG: 200, ils: 17.0 },
    { maxG: 350, ils: 25.0 },
  ],
};

/** Postage cost for an order, or null if it is heavier than every known band. */
export function postageIls(service: Service, grams: number): number | null {
  const band = TARIFF[service].find((b) => grams <= b.maxG);
  return band ? band.ils : null;
}

/* ── Statuses ──────────────────────────────────────────────────────────────
 * "new" is the implicit state of a freshly imported order — nothing done yet.
 * "issue" is the escape hatch for anything stuck or wrong.
 */
export const STATUSES = ["new", "packed", "label", "shipped", "delivered", "issue"] as const;
export type Status = (typeof STATUSES)[number];

/** The ladder a mail order climbs. */
export const FLOW_MAIL: Status[] = ["new", "packed", "label", "shipped", "delivered"];
/** Pickup orders never get a label and are never posted. */
export const FLOW_PICKUP: Status[] = ["new", "packed", "delivered"];

export function flowFor(kind: Kind): Status[] {
  return kind === "pickup" ? FLOW_PICKUP : FLOW_MAIL;
}

/** Statuses a given order can actually be set to, including "issue". */
export function statusOptions(kind: Kind): Status[] {
  return [...flowFor(kind), "issue"];
}

/** Hebrew label for a status. Pickup orders read differently at two steps. */
export function statusLabel(status: Status, kind: Kind): string {
  if (kind === "pickup") {
    if (status === "packed") return "מוכן לאיסוף";
    if (status === "delivered") return "נאסף";
  }
  const labels: Record<Status, string> = {
    new: "חדש",
    packed: "ארוז",
    label: "מדבקה הודפסה",
    shipped: "נשלח",
    delivered: "נמסר",
    issue: "בעיה / תקוע",
  };
  return labels[status];
}

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

/**
 * The next rung up this order's ladder, or null when there is nowhere further.
 * Returns null for "issue" too — a stuck order needs a decision, not a nudge,
 * so the UI sends that case to the full picker instead.
 */
export function nextStatus(current: Status, kind: Kind): Status | null {
  const flow = flowFor(kind);
  const at = flow.indexOf(current);
  if (at === -1 || at === flow.length - 1) return null;
  return flow[at + 1];
}

/** An order counts as "done" once it has reached the end of its own ladder. */
export function isDone(status: Status, kind: Kind): boolean {
  return status === "delivered" && flowFor(kind).includes("delivered");
}

export const serviceLabel: Record<Service, string> = {
  post24: "דואר 24",
  post72: "דואר 72",
};
