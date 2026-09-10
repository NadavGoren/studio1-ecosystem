/**
 * Business rules for Studio 1 postcard shipping.
 *
 * The 24/72 split is not a preference — it falls out of the weight. דואר 72
 * is capped at 50g and a postcard is 25g, so two fit exactly and three cannot.
 * Weight and service are therefore ONE rule, and it is written here once and
 * derived, rather than stated twice in terms that could drift apart: change
 * the card weight and the split moves with it.
 */

export type Service = "post24" | "post72";
export type Kind = "mail" | "pickup";

/**
 * A postcard, in grams. This is the rule, no exceptions — and nothing else is
 * counted toward it. An earlier version added 12g of packaging on top, which
 * put two cards at 62g and pushed every two-card order off the דואר 72 band
 * it is supposed to sit exactly on.
 */
export const PER_CARD_G = 25;

/** The ceiling on דואר 72. An order over it goes דואר 24 instead. */
export const POST72_MAX_G = 50;

/** Total posted weight in grams. */
export function weightG(qty: number): number {
  return PER_CARD_G * qty;
}

/**
 * Which service an order takes. Two cards come to 50g, and 50g is still
 * *within* the band — the comparison has to be inclusive or the common
 * two-card order silently upgrades to דואר 24.
 */
export function classify(qty: number): Service {
  return weightG(qty) <= POST72_MAX_G ? "post72" : "post24";
}

/**
 * The quantity the split works out to — 3 at present. Derived, not chosen:
 * it exists so the rule can be quoted as "3 or more" without that number
 * being able to disagree with classify().
 */
export const SERVICE_THRESHOLD = Math.floor(POST72_MAX_G / PER_CARD_G) + 1;

/**
 * What a shipment actually costs, by postcard count.
 *
 * These are Nadav's own figures from דואר בקליק (confirmed 2026-09-02), not a
 * published price list — they are what actually leaves the account, which is
 * the only thing worth averaging.
 *
 * Keyed on COUNT, not weight. The weight bands this replaced were copied from
 * a brief and disagreed with reality at 4 and 5 cards; a lookup by the number
 * you are holding is also how the cost is actually thought about.
 *
 * NOTE THE DIP: five cards cost LESS than four (15.70 vs 17.00). That is
 * confirmed, not a typo, and it is not a mistake to be tidied away. Anything
 * from five up stays at that same rate.
 */
const POSTAGE_ILS: Record<number, number> = {
  1: 4.7,
  2: 4.7,
  3: 11,
  4: 17,
  5: 15.7,
};

/** At and above this count the rate stops changing. */
const POSTAGE_FLAT_FROM = 5;

/** Postage for an order of `qty` postcards. Pickup orders never reach this. */
export function postageIls(qty: number): number {
  if (qty <= 0) return 0;
  return POSTAGE_ILS[qty] ?? POSTAGE_ILS[POSTAGE_FLAT_FROM];
}

/* ── Statuses ──────────────────────────────────────────────────────────────
 * "new" is the implicit state of a freshly imported order — nothing done yet.
 * "issue" is the escape hatch for anything stuck or wrong.
 */
export const STATUSES = [
  "new",
  "packed",
  "label",
  "shipped",
  "notified",
  "delivered",
  "issue",
] as const;
export type Status = (typeof STATUSES)[number];

/** The ladder a mail order climbs. */
export const FLOW_MAIL: Status[] = ["new", "packed", "label", "shipped", "delivered"];
/**
 * Pickup orders never get a label and are never posted. They do get a message
 * once they're ready — that is the step between packing and collection, and
 * the one that tells us whether the customer even knows to come.
 */
export const FLOW_PICKUP: Status[] = ["new", "packed", "notified", "delivered"];

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
    notified: "הודעה נשלחה",
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

/* ── Ship date ─────────────────────────────────────────────────────────────
 * The day a parcel actually went out, which is NOT the moment its status was
 * clicked: a batch posted on Sunday afternoon often gets marked on Monday.
 * That is why this is stored separately from `statusAt` and can be backdated.
 *
 * A plain YYYY-MM-DD calendar day on purpose — "which day did this go out"
 * has no time of day, and giving it one only invites timezone bugs.
 */

/**
 * The local calendar day `offsetDays` back from today, as YYYY-MM-DD.
 * Assembled from local parts deliberately: toISOString() reports UTC, and
 * Israel runs 2–3 hours ahead of it, so anything marked before ~03:00 would
 * be filed under the previous day.
 */
export function dayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Guards the API boundary — a ship date only ever arrives as a bare day. */
export function isDayIso(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** How a ship date reads in the UI: היום / אתמול, else 03/09. */
export function shipDateLabel(day: string): string {
  if (day === dayIso(0)) return "היום";
  if (day === dayIso(1)) return "אתמול";
  const [y, m, d] = day.split("-");
  return `${d}/${m}${y === String(new Date().getFullYear()) ? "" : `/${y.slice(2)}`}`;
}

/* ── Complaints ────────────────────────────────────────────────────────────
 * A parcel that never arrived is not a status — it is a conversation, and it
 * outlives whatever rung the order is sitting on. A resend has to go back to
 * ארוז and climb the ladder again; a refund leaves the order exactly where it
 * already was. Either way the promise we made the customer must survive the
 * status moving, so a complaint is stored ALONGSIDE the status rather than as
 * one of them, and only "we actually did the thing" closes it.
 */

export const REMEDIES = ["refund", "wait", "resend"] as const;
export type Remedy = (typeof REMEDIES)[number];

export function isRemedy(v: unknown): v is Remedy {
  return typeof v === "string" && (REMEDIES as readonly string[]).includes(v);
}

/** What we offered the customer. */
export const remedyLabel: Record<Remedy, string> = {
  refund: "זיכוי מלא",
  wait: "להמתין עוד כמה ימים",
  resend: "שליחה חוזרת",
};

/** The same three, short enough to sit under a status pill in the table. */
export const remedyShort: Record<Remedy, string> = {
  refund: "זיכוי",
  wait: "בהמתנה",
  resend: "שליחה חוזרת",
};

/**
 * What "done" means — which is a different act for each remedy: money left the
 * account, a second parcel went out, or the wait simply ended well. One
 * checkbox, three meanings, so three labels: a generic "טופל" would make the
 * refunds list impossible to trust, and trusting it is the entire point.
 */
export const remedyDoneLabel: Record<Remedy, string> = {
  refund: "הזיכוי בוצע",
  wait: "הגלויה הגיעה",
  resend: "נשלח שוב",
};

export interface Complaint {
  /** The day the customer told us, YYYY-MM-DD. Editable — they often write
   *  on Friday and get answered on Sunday. */
  reportedOn: string;
  /** null while the customer hasn't chosen yet — a real state, not a gap. */
  remedy: Remedy | null;
  /**
   * The day we carried the remedy out, or null if we still owe it. This IS
   * the done flag: a separate boolean beside a date can disagree with it, and
   * then neither answers "who is still waiting for their money".
   */
  doneOn: string | null;
  /** ₪ actually refunded. Only meaningful when the remedy is a refund. */
  refundIls: number | null;
  /** What the customer said, in their words. Ours goes in the order note. */
  note: string;
}

/** An open complaint is one we still owe something on. */
export function isComplaintOpen(c: Complaint | null | undefined): boolean {
  return Boolean(c) && !c?.doneOn;
}

/** A fresh complaint, opened today. */
export function newComplaint(remedy: Remedy | null = null): Complaint {
  return { reportedOn: dayIso(0), remedy, doneOn: null, refundIls: null, note: "" };
}

export class ComplaintError extends Error {}

/**
 * Guards the API boundary. Every field here is typed by hand into a form, so
 * each one is checked rather than trusted — and a bad one is the caller's
 * mistake (400), not the server falling over.
 */
export function parseComplaint(v: unknown): Complaint | null {
  if (v === null) return null;
  if (typeof v !== "object") throw new ComplaintError("תלונה לא תקינה");
  const c = v as Record<string, unknown>;

  if (!isDayIso(c.reportedOn)) throw new ComplaintError("תאריך הדיווח לא תקין");

  const remedy = c.remedy ?? null;
  if (remedy !== null && !isRemedy(remedy)) throw new ComplaintError("פתרון לא מוכר");

  const doneOn = c.doneOn ?? null;
  if (doneOn !== null && !isDayIso(doneOn)) throw new ComplaintError("תאריך הביצוע לא תקין");

  const refund = c.refundIls ?? null;
  if (refund !== null && (typeof refund !== "number" || !Number.isFinite(refund) || refund < 0)) {
    throw new ComplaintError("סכום הזיכוי לא תקין");
  }

  if (c.note !== undefined && typeof c.note !== "string") {
    throw new ComplaintError("פירוט התלונה חייב להיות טקסט");
  }

  return {
    reportedOn: c.reportedOn,
    remedy: remedy as Remedy | null,
    doneOn: doneOn as string | null,
    // Agorot and no further: a refund is money, and a float that drifted
    // through a form would print as 34.999999999 ₪ in the export.
    refundIls: refund === null ? null : Math.round(refund * 100) / 100,
    note: ((c.note as string) ?? "").slice(0, 2000),
  };
}
