import type { Order } from "@/types";

/**
 * The seven fields דואר בקליק asks for, in the order its form asks for them.
 *
 * The wire format is POSITIONAL and FIXED-LENGTH: seven lines, always, one per
 * field. The userscript on the דואר בקליק side maps line index → label, so a
 * missing value still has to occupy its slot — hence EMPTY rather than an
 * omitted line. `tools/israelpost-sequence.user.js` holds the same two
 * constants; change them here and there together or the two stop agreeing.
 */
export const SEQUENCE_FIELDS = [
  "שם פרטי",
  "שם משפחה",
  "עיר",
  "רחוב",
  "מספר בית",
  "אימייל",
  "טלפון",
] as const;

/** Stands in for a value we don't have. Also keeps the payload from ending in
 *  a blank line, which clipboard managers are free to trim away. */
export const EMPTY = "—";

/**
 * Morning gives the customer as one field. First token is the given name, the
 * rest the family name — right for "עדי כפרי", a guess for anything longer.
 * That guess is why the badge on the form side shows the value it is about to
 * paste rather than only the field name.
 */
export function splitName(customer: string): [string, string] {
  const parts = customer.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [parts[0] ?? "", ""];
  return [parts[0], parts.slice(1).join(" ")];
}

/** The seven values, same order as SEQUENCE_FIELDS. Empties stay as "". */
export function sequenceValues(o: Order): string[] {
  const [first, last] = splitName(o.customer);
  return [first, last, o.city, o.street, o.house, o.email, o.phone].map((v) =>
    (v ?? "").trim()
  );
}

/** Exactly seven lines — the payload the userscript recognises as a sequence. */
export function sequenceText(o: Order): string {
  return sequenceValues(o)
    .map((v) => v || EMPTY)
    .join("\n");
}
