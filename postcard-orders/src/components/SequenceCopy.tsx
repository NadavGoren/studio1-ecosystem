"use client";

import { useCallback, useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { SEQUENCE_FIELDS, sequenceText, sequenceValues } from "@/lib/shipSequence";
import type { Order } from "@/types";

/**
 * Copies the seven דואר בקליק fields as one block, for the userscript in
 * `tools/israelpost-sequence.user.js` to hand out one field per Ctrl+V.
 * Without the userscript installed this is still a useful "everything about
 * this order, in form order" copy.
 */
export default function SequenceCopy({ order }: { order: Order }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const values = sequenceValues(order);

  const copy = useCallback(async () => {
    setState((await copyText(sequenceText(order))) ? "done" : "failed");
  }, [order]);

  // A new order means a new sequence — don't leave the previous ✓ standing.
  useEffect(() => {
    setState("idle");
  }, [order.orderId]);

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  // "c" copies the open order: the arrows already walk the rows, so the hands
  // are on the keyboard anyway.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      e.preventDefault();
      void copy();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copy]);

  return (
    <>
      <button
        type="button"
        className={`seqcopy${state === "done" ? " done" : ""}${
          state === "failed" ? " failed" : ""
        }`}
        onClick={copy}
        title="מעתיק את שבעת השדות. בטופס דואר בקליק כל Ctrl+V מדביק את הבא בתור."
      >
        {state === "done"
          ? "✓ הועתק — עכשיו Ctrl+V בטופס, שדה אחרי שדה"
          : state === "failed"
            ? "לא הצליח — סמני והעתיקי ידנית"
            : "העתק לרצף · 7 שדות"}
      </button>

      <div className="seqhint">
        או <kbd>c</kbd> · בטופס: כל הדבקה מכניסה את השדה הבא
      </div>

      <details className="seqpreview">
        <summary>מה ייצא, לפי הסדר</summary>
        <ol className="seqlist">
          {SEQUENCE_FIELDS.map((field, i) => (
            <li key={field}>
              <span className="n">{i + 1}</span>
              <span className="k">{field}</span>
              <span className={`v${values[i] ? "" : " empty"}`}>
                {values[i] || "חסר — יידלג"}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
