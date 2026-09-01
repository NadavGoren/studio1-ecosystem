"use client";

import { useEffect, useRef, useState } from "react";
import { dayIso } from "@/lib/domain";

/**
 * מתי נשלח? — [היום] [אתמול] [תאריך אחר]
 *
 * Shown whenever נשלח is chosen deliberately: from the status dropdown, from
 * the detail panel, or for a whole selection at once. The one-click ← נשלח
 * button in the table skips it and files today, which is the right default
 * for marking a parcel as it actually goes out the door.
 */
export default function ShipDateChoice({
  onPick,
  onCancel,
  count,
}: {
  onPick: (day: string) => void;
  onCancel: () => void;
  /** Shown when this is standing in for a whole selection, so it is obvious
   *  the date is about to land on more than the one order under the cursor. */
  count?: number;
}) {
  const [custom, setCustom] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  // Focus the field as it appears — otherwise "תאריך אחר" costs a click to
  // reveal and a second to aim at.
  useEffect(() => {
    if (custom) dateRef.current?.focus();
  }, [custom]);

  return (
    <div className="shipdate" onClick={(e) => e.stopPropagation()}>
      <div className="shipdate-h">
        מתי נשלח?
        {count && count > 1 ? <span className="n"> {count} הזמנות</span> : null}
      </div>

      <div className="shipdate-opts">
        <button type="button" className="btn sm" onClick={() => onPick(dayIso(0))}>
          היום
        </button>
        <button type="button" className="btn sm" onClick={() => onPick(dayIso(1))}>
          אתמול
        </button>
        {!custom && (
          <button type="button" className="btn sm ghost" onClick={() => setCustom(true)}>
            תאריך אחר…
          </button>
        )}
      </div>

      {custom && (
        <input
          ref={dateRef}
          type="date"
          className="shipdate-input"
          // Nothing can have shipped tomorrow.
          max={dayIso(0)}
          defaultValue={dayIso(0)}
          onChange={(e) => e.target.value && onPick(e.target.value)}
        />
      )}

      <button type="button" className="shipdate-cancel" onClick={onCancel}>
        ביטול
      </button>
    </div>
  );
}
