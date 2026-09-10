"use client";

import { useEffect, useRef, useState } from "react";
import {
  REMEDIES,
  dayIso,
  remedyDoneLabel,
  remedyLabel,
  shipDateLabel,
  type Complaint,
  type Remedy,
} from "@/lib/domain";
import type { Order } from "@/types";

/**
 * The complaint, in full, inside the order panel: when they told us, what we
 * promised, and — the reason this exists at all — whether we have actually
 * done it yet.
 *
 * Every control writes the whole complaint back through one `onChange`. The
 * record is small and always edited as a whole, so a per-field API would only
 * add ways for the amount and the "paid" tick to be a request apart.
 */
export default function ComplaintPanel({
  order,
  onChange,
}: {
  order: Order;
  /** null removes the complaint entirely. */
  onChange: (complaint: Complaint | null) => void;
}) {
  const c = order.complaint;
  // Free text and a money field are typed, not clicked, so they hold a local
  // draft and commit on blur — exactly like the order note above them.
  const [note, setNote] = useState(c?.note ?? "");
  const [refund, setRefund] = useState(c?.refundIls?.toString() ?? "");
  const [askRemove, setAskRemove] = useState(false);
  const saved = useRef({ note: c?.note ?? "", refund: c?.refundIls ?? null });

  useEffect(() => {
    setNote(c?.note ?? "");
    setRefund(c?.refundIls?.toString() ?? "");
    saved.current = { note: c?.note ?? "", refund: c?.refundIls ?? null };
    setAskRemove(false);
  }, [order.orderId, c?.note, c?.refundIls]);

  if (!c) return null;

  const patch = (fields: Partial<Complaint>) => onChange({ ...c, ...fields });

  function pickRemedy(r: Remedy) {
    // Picking the same one again clears it — the customer changed their mind
    // and we are back to undecided, which is a real state worth being able to
    // return to rather than a dead end.
    if (c!.remedy === r) return patch({ remedy: null });
    patch({
      remedy: r,
      // A refund defaults to the whole order, because that is what we offered.
      // Only filled in when there is nothing there yet, so an amount typed by
      // hand survives flipping between the options.
      refundIls: r === "refund" && c!.refundIls === null ? order.totalIls : c!.refundIls,
    });
  }

  function commitNote() {
    if (note !== saved.current.note) {
      saved.current = { ...saved.current, note };
      patch({ note });
    }
  }

  function commitRefund() {
    const trimmed = refund.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setRefund(saved.current.refund?.toString() ?? ""); // put the old one back
      return;
    }
    if (value !== saved.current.refund) {
      saved.current = { ...saved.current, refund: value };
      patch({ refundIls: value });
    }
  }

  const done = Boolean(c.doneOn);

  return (
    <div className="complaint">
      <div className="crow">
        <span className="clbl">הלקוח דיווח</span>
        <input
          type="date"
          className="shipdate-input"
          value={c.reportedOn}
          max={dayIso(0)}
          onChange={(e) => e.target.value && patch({ reportedOn: e.target.value })}
        />
      </div>

      <div className="crow stack">
        <span className="clbl">מה סיכמנו</span>
        <div className="statusgrid">
          {REMEDIES.map((r) => (
            <button
              key={r}
              type="button"
              className={`statusbtn${c.remedy === r ? ` rem-${r}` : ""}`}
              aria-pressed={c.remedy === r}
              onClick={() => pickRemedy(r)}
            >
              {remedyLabel[r]}
            </button>
          ))}
        </div>
      </div>

      {c.remedy === "refund" && (
        <div className="crow">
          <span className="clbl">סכום הזיכוי</span>
          <input
            type="number"
            className="shipdate-input camount"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            onBlur={commitRefund}
          />
          <span className="cunit">₪</span>
          {c.refundIls !== order.totalIls && (
            <button
              type="button"
              className="clink"
              onClick={() => {
                setRefund(order.totalIls.toString());
                saved.current = { ...saved.current, refund: order.totalIls };
                patch({ refundIls: order.totalIls });
              }}
            >
              החזר מלא ({order.totalIls.toFixed(0)} ₪)
            </button>
          )}
        </div>
      )}

      {/* The whole point of the feature: nobody is left waiting for money or
          for a second parcel because it was agreed and then forgotten. */}
      {c.remedy ? (
        <div className={`cdone${done ? " on" : ""}`}>
          <label>
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => patch({ doneOn: e.target.checked ? dayIso(0) : null })}
            />
            <span>{remedyDoneLabel[c.remedy]}</span>
          </label>
          {done && (
            <>
              <span className="cwhen">{shipDateLabel(c.doneOn!)}</span>
              <input
                type="date"
                className="shipdate-input"
                value={c.doneOn!}
                max={dayIso(0)}
                onChange={(e) => e.target.value && patch({ doneOn: e.target.value })}
              />
            </>
          )}
        </div>
      ) : (
        <div className="cpending">עוד לא הוחלט מה עושים</div>
      )}

      <textarea
        className="mynote"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commitNote}
        placeholder="מה הלקוח אמר — למשל: לא הגיע, בדק בסניף"
      />

      {askRemove ? (
        <div className="confirmdel">
          <span>למחוק את רישום התלונה?</span>
          <button className="btn sm danger" onClick={() => onChange(null)}>
            כן, מחק
          </button>
          <button className="btn ghost sm" onClick={() => setAskRemove(false)}>
            ביטול
          </button>
        </div>
      ) : (
        <button className="btn ghost sm deltrigger" onClick={() => setAskRemove(true)}>
          מחיקת רישום התלונה
        </button>
      )}
    </div>
  );
}
