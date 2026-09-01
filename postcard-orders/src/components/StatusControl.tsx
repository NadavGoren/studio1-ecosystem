"use client";

import { useEffect, useRef, useState } from "react";
import {
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
 */
export default function StatusControl({
  status,
  kind,
  onChange,
}: {
  status: Status;
  kind: Kind;
  onChange: (next: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const next = nextStatus(status, kind);

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
            {statusOptions(kind).map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                aria-pressed={status === s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                <span className={`dot d-${s}`} aria-hidden="true" />
                {statusLabel(s, kind)}
              </button>
            ))}
          </div>
        )}
      </div>

      {next && (
        <button
          type="button"
          className="advance"
          title={`סמן כ־${statusLabel(next, kind)}`}
          onClick={() => onChange(next)}
        >
          <span className="arrow" aria-hidden="true">←</span>
          {statusLabel(next, kind)}
        </button>
      )}
    </div>
  );
}
