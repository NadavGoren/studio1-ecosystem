"use client";

import { useEffect, useState } from "react";

/**
 * "When was the CSV last uploaded" — not "when was any order last touched".
 * Formatting depends on the current time, so it can only be computed after
 * mount: doing it during the server/client-shared render would either be
 * wrong (server clock, UTC) or mismatch between server and client and trip
 * React's hydration check. A blank first frame is cheap and invisible.
 */
export default function LastImport({ iso }: { iso: string | null }) {
  const [text, setText] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    function render() {
      if (!iso) {
        setText("מעולם לא הועלה קובץ");
        setStale(true);
        return;
      }
      const then = new Date(iso);
      const mins = Math.round((Date.now() - then.getTime()) / 60_000);

      let phrase: string;
      if (mins < 1) phrase = "עודכן ממש עכשיו";
      else if (mins < 60) phrase = `עודכן לפני ${mins} דק׳`;
      else if (mins < 24 * 60) phrase = `עודכן לפני ${Math.round(mins / 60)} שע׳`;
      else {
        const date = then.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
        const time = then.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
        phrase = `עודכן ${date} ${time}`;
      }
      setText(phrase);
      // A day-old CSV is worth flagging — orders may have come in since.
      setStale(mins >= 24 * 60);
    }
    render();
    const t = setInterval(render, 60_000);
    return () => clearInterval(t);
  }, [iso]);

  if (!text) return null;

  return (
    <span
      className={`lastimport${stale ? " stale" : ""}`}
      title={iso ? new Date(iso).toLocaleString("he-IL") : undefined}
    >
      {text}
    </span>
  );
}
