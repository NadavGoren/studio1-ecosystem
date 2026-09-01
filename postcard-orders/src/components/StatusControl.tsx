"use client";

import { useEffect, useRef, useState } from "react";
import ShipDateChoice from "./ShipDateChoice";
import {
  dayIso,
  nextStatus,
  statusLabel,
  statusOptions,
  type Kind,
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
 */
export default function StatusControl({
  status,
  kind,
  onChange,
}: {
  status: Status;
  kind: Kind;
  onChange: (next: Status, shippedOn?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [askDate, setAskDate] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const next = nextStatus(status, kind);

  // Reopening the menu should always start on the status list, never on a
  // date question left over from last time.
  useEffect(() => {
    if (!open) setAskDate(false);
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
            ) : (
              statusOptions(kind).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  aria-pressed={status === s}
                  onClick={() => {
                    if (s === "shipped") {
                      setAskDate(true);
                      return; // menu stays open, swaps to the date question
                    }
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
