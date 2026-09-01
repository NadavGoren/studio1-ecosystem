"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";

/** Copy-to-clipboard button that confirms in place for a moment. */
export default function CopyButton({
  value,
  label = "העתק",
  title,
}: {
  value: string;
  label?: string;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  if (!value) return null;

  return (
    <button
      type="button"
      className={`copy${state === "done" ? " done" : ""}${state === "failed" ? " failed" : ""}`}
      title={title ?? `העתק: ${value}`}
      onClick={async (e) => {
        e.stopPropagation();
        // Never fail silently: a copy that didn't happen must not look like one that did.
        setState((await copyText(value)) ? "done" : "failed");
      }}
    >
      {state === "done" ? "✓ הועתק" : state === "failed" ? "לא הצליח — סמני והעתיקי" : label}
    </button>
  );
}
