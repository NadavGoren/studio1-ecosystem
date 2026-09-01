/**
 * Morning writes the shipping address as one free-text field, roughly:
 *
 *   רחוב מספר, [כניסה Y,] [דירה X,] מיקוד NNNNNNN, עיר
 *
 * The format is not consistent. Observed in real exports: a missing house
 * number, a stray "ישראל" in the middle, a missing city, and postcodes that
 * are 4, 5 or 6 digits or all zeros. This parser is deliberately forgiving —
 * it extracts what it can and reports the rest as warnings rather than failing.
 */

export interface ParsedAddress {
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  zip: string;
  city: string;
  /** Human-readable problems, shown in the UI. Empty means the address is clean. */
  warnings: string[];
  /** True when something would stop Israel Post accepting it (bad zip / no city). */
  blocking: boolean;
}

const EMPTY: ParsedAddress = {
  street: "",
  house: "",
  apartment: "",
  entrance: "",
  zip: "",
  city: "",
  warnings: [],
  blocking: false,
};

/** Words that carry no address information and only confuse the split. */
const NOISE = new Set(["ישראל", "israel"]);

export function parseAddress(raw: string): ParsedAddress {
  const text = (raw || "").trim();
  if (!text) {
    return { ...EMPTY, warnings: ["אין כתובת משלוח"], blocking: true };
  }

  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "" && !NOISE.has(p.toLowerCase()));

  let zip = "";
  let apartment = "";
  let entrance = "";
  let zipIdx = -1;
  const streetParts: string[] = [];
  const afterZip: string[] = [];

  parts.forEach((part, i) => {
    const zipMatch = part.match(/^מיקוד\s*([0-9]+)$/);
    // A bare run of exactly 7 digits is a postcode even without the word מיקוד.
    const bareZip = part.match(/^([0-9]{7})$/);
    if (zipMatch || bareZip) {
      zip = (zipMatch?.[1] ?? bareZip![1]).trim();
      zipIdx = i;
      return;
    }
    const aptMatch = part.match(/^דירה\s*(.+)$/);
    if (aptMatch) {
      apartment = aptMatch[1].trim();
      return;
    }
    const entMatch = part.match(/^כניסה\s*(.+)$/);
    if (entMatch) {
      entrance = entMatch[1].trim();
      return;
    }
    if (zipIdx === -1) streetParts.push(part);
    else afterZip.push(part);
  });

  // Everything after the postcode is the city. Before it, the street.
  const city = afterZip.join(", ").trim();
  const streetLine = streetParts.join(", ").trim();

  // Split a trailing house number off the street ("יצחק טבנקין 24" → 24).
  // Allows a Hebrew letter suffix, e.g. "הרצל 12א".
  let street = streetLine;
  let house = "";
  const houseMatch = streetLine.match(/^(.*\S)\s+(\d+[א-ת]?)$/);
  if (houseMatch) {
    street = houseMatch[1].trim();
    house = houseMatch[2].trim();
  }

  const warnings: string[] = [];
  let blocking = false;

  if (!zip) {
    warnings.push("חסר מיקוד");
    blocking = true;
  } else if (!/^\d{7}$/.test(zip)) {
    warnings.push(`מיקוד לא תקין (${zip.length} ספרות)`);
    blocking = true;
  } else if (/^0+$/.test(zip)) {
    warnings.push("מיקוד אפסים");
    blocking = true;
  }

  if (!city) {
    warnings.push("חסרה עיר");
    blocking = true;
  }

  // Small communities genuinely have no house numbers — a warning, never a block.
  if (!house) warnings.push("אין מספר בית");

  if (!street) {
    warnings.push("חסר רחוב");
    blocking = true;
  }

  return { street, house, apartment, entrance, zip, city, warnings, blocking };
}

/** One-line address for display and for pasting into דואר בקליק. */
export function formatAddress(a: ParsedAddress): string {
  const streetLine = [a.street, a.house].filter(Boolean).join(" ");
  const extras = [
    a.entrance ? `כניסה ${a.entrance}` : "",
    a.apartment ? `דירה ${a.apartment}` : "",
  ].filter(Boolean);
  return [streetLine, ...extras, a.city, a.zip].filter(Boolean).join(", ");
}

/**
 * Extract the pickup location from a "איסוף עצמי- מנהלל, משק 196" method string.
 * Returns the part after the dash, or the whole string if there is no dash.
 */
export function parsePickupPoint(method: string): string {
  const m = (method || "").match(/^\s*איסוף\s*עצמי\s*[-–—]\s*(.+)$/);
  return (m ? m[1] : method || "").trim();
}

/** Morning marks self-pickup inside the delivery-method field. */
export function isPickupMethod(method: string): boolean {
  return /איסוף\s*עצמי/.test(method || "");
}
