"use client";

import { useEffect, useRef, useState } from "react";
import type { Order } from "@/types";

/**
 * Manual order entry — a phone order, an Instagram DM, someone catching us at
 * a market. Everything Morning would have given us, asked for directly.
 *
 * Deliberately short: name and quantity are the only required fields, because
 * the common case is writing down a sale in ten seconds while the customer is
 * still standing there. Everything else can be filled in later from the detail
 * panel or left empty.
 */
export default function NewOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const [kind, setKind] = useState<"mail" | "pickup">("mail");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const f = new FormData(e.currentTarget);
    const payload = {
      orderId: String(f.get("orderId") ?? "").trim(),
      customer: String(f.get("customer") ?? ""),
      phone: String(f.get("phone") ?? ""),
      email: String(f.get("email") ?? ""),
      kind,
      street: String(f.get("street") ?? ""),
      house: String(f.get("house") ?? ""),
      city: String(f.get("city") ?? ""),
      zip: String(f.get("zip") ?? ""),
      pickupPoint: String(f.get("pickupPoint") ?? ""),
      qty: Number(f.get("qty") ?? 0),
      totalIls: Number(f.get("totalIls") ?? 0),
      product: String(f.get("product") ?? ""),
      note: String(f.get("note") ?? ""),
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שמירת ההזמנה נכשלה");
      onCreated(body.order as Order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת ההזמנה נכשלה");
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal neworder"
        role="dialog"
        aria-modal="true"
        aria-label="הזמנה ידנית"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>הזמנה ידנית</h2>
        <p className="lede">
          הזמנה שלא הגיעה מהאתר. היא לא תיפגע מייבוא CSV — גם לא אם מספר ההזמנה
          שלה יופיע בקובץ יום אחד.
        </p>

        <form onSubmit={submit}>
          <div className="frow">
            <label className="fld grow">
              <span>שם הלקוח *</span>
              <input ref={firstField} name="customer" required autoComplete="off" />
            </label>
            <label className="fld sm">
              <span>כמות *</span>
              <input name="qty" type="number" min={1} defaultValue={1} required />
            </label>
          </div>

          <div className="frow">
            <label className="fld">
              <span>טלפון</span>
              <input name="phone" inputMode="tel" autoComplete="off" />
            </label>
            <label className="fld">
              <span>אימייל</span>
              <input name="email" type="email" autoComplete="off" />
            </label>
          </div>

          <div className="seg kindseg">
            {([["mail", "משלוח"], ["pickup", "איסוף עצמי"]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>

          {kind === "mail" ? (
            <>
              <div className="frow">
                <label className="fld grow">
                  <span>רחוב</span>
                  <input name="street" placeholder="דיזנגוף" autoComplete="off" />
                </label>
                <label className="fld sm">
                  <span>מספר</span>
                  <input name="house" placeholder="50" autoComplete="off" />
                </label>
              </div>
              <div className="frow">
                <label className="fld grow">
                  <span>עיר</span>
                  <input name="city" placeholder="תל אביב" autoComplete="off" />
                </label>
                <label className="fld sm">
                  <span>מיקוד</span>
                  <input name="zip" inputMode="numeric" placeholder="6433222" autoComplete="off" />
                </label>
              </div>
            </>
          ) : (
            <label className="fld">
              <span>נקודת איסוף</span>
              <input name="pickupPoint" defaultValue="הסטודיו" autoComplete="off" />
            </label>
          )}

          <div className="frow">
            <label className="fld grow">
              <span>מה בהזמנה</span>
              <input name="product" placeholder="שם הגלויה" autoComplete="off" />
            </label>
            <label className="fld sm">
              <span>שולם ₪</span>
              <input name="totalIls" type="number" min={0} step="0.01" defaultValue={0} />
            </label>
          </div>

          <div className="frow">
            <label className="fld grow">
              <span>הערה</span>
              <input name="note" autoComplete="off" />
            </label>
            <label className="fld sm">
              <span>מס׳ הזמנה</span>
              <input name="orderId" placeholder="אוטומטי" autoComplete="off" />
            </label>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              ביטול
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "שומר…" : "הוספה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
