"use client";

import { useState } from "react";

const MESSAGE = "עדי כפרה עלייך לא לשכוח להעלות CSV מעודכן. אל תהיי ז**";

/**
 * A nudge from Nadav to Adi, shown fresh every time the app is opened — not a
 * one-time tip that gets dismissed forever. Closing it only clears this visit;
 * the next reload brings it back, which is the point.
 */
export default function CsvNag({ onImport }: { onImport: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="nag" role="status">
      <span className="nag-emoji" aria-hidden="true">📮</span>
      <p>{MESSAGE}</p>
      <button
        type="button"
        className="btn sm primary"
        onClick={() => {
          onImport();
          setDismissed(true);
        }}
      >
        ייבוא CSV
      </button>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => setDismissed(true)}
        aria-label="סגירה"
      >
        ✕
      </button>
    </div>
  );
}
