"use client";

import { useEffect, useRef, useState } from "react";
import RemedyChoice from "./RemedyChoice";
import ShipDateChoice from "./ShipDateChoice";
import {
  dayIso,
  nextStatus,
  statusLabel,
  statusOptions,
  type Kind,
  type Remedy,
  type Status,
} from "@/lib/domain";

/**
 * Two ways to move an order along, side by side:
 * the pill opens the full list, and the button beside it advances one rung
 * with a single click — which is the thing done dozens of times in a sitting.
 *
 * נשלח is the one status that carries a date. The quick button files it under
 * today without asking, because that is what marking a parcel as it goes out
 * means; choosing נשלח from the list instead asks which day, which is how you
 * catch up on a batch posted yesterday.
 *
 * בעיה asks its own follow-up in the same slot: what we agreed to do about it.
 * A problem with no remedy against it is exactly the customer who gets missed,
 * so the question is asked where the problem is logged rather than left for
 * whoever opens the panel later.
 */
export default function StatusControl({
  status,
  kind,
  remedy,
  onChange,
  onIssue,
}: {
  status: Status;
  kind: Kind;
  /** What was already agreed, so reopening the question shows the answer. */
  remedy: Remedy | null;
  onChange: (next: Status, shippedOn?: string | null) => void;
  /** Mark the order as a problem AND record the remedy in one go. */
  onIssue: (remedy: Remedy | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [askDate, setAskDate] = useState(false);
  const [askRemedy, setAskRemedy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const next = nextStatus(status, kind);

  // Reopening the menu should always start on the status list, never on a
  // follow-up question left over from last time.
  useEffect(() => {
    if (!open) {
      setAskDate(false);
      setAskRemedy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // Row clicks open the detail panel; status clicks must not.
    <div className="statuscell" onClick={(e) => e.stopPropagation()}>
      <div className="pickwrap" ref={wrap}>
        <button
          type="button"
          className={`statuspill st-${status}`}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
        >
          {statusLabel(status, kind)}
          <span className="caret" aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className="pickmenu" role="menu">
            {askDate ? (
              <ShipDateChoice
                onPick={(day) => {
                  onChange("shipped", day);
                  setOpen(false);
                }}
                onCancel={() => setAskDate(false)}
              />
            ) : askRemedy ? (
              <RemedyChoice
                current={remedy}
                onPick={(r) => {
                  onIssue(r);
                  setOpen(false);
                }}
                onCancel={() => setAskRemedy(false)}
              />
            ) : (
              statusOptions(kind).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  aria-pressed={status === s}
                  onClick={() => {
                    // Both of these stay open and swap the menu's contents for
                    // their follow-up question rather than closing on a
                    // half-recorded answer.
                    if (s === "shipped") return setAskDate(true);
                    if (s === "issue") return setAskRemedy(true);
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  <span className={`dot d-${s}`} aria-hidden="true" />
                  {statusLabel(s, kind)}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {next && (
        <button
          type="button"
          className="advance"
          title={
            next === "shipped"
              ? "סמן כנשלח היום — לתאריך אחר, פתחי את הרשימה"
              : `סמן כ־${statusLabel(next, kind)}`
          }
          onClick={() => onChange(next, next === "shipped" ? dayIso(0) : null)}
        >
          <span className="arrow" aria-hidden="true">←</span>
          {statusLabel(next, kind)}
        </button>
      )}
    </div>
  );
}
