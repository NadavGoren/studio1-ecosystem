"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/types";

/**
 * Which designs are actually selling, and by how much.
 *
 * Counts postcards, not orders: an order of four rimonim contributes four.
 * Every product line Morning wrote is counted, so these totals add up to
 * exactly the סה״כ גלויות figure above — the two can't disagree.
 *
 * Deliberately reads from ALL orders, not the filtered view, for the same
 * reason the totals above it do: "what sold best" is a fact about the run,
 * not about whatever is on screen right now.
 */

/**
 * Morning's product names tend to share a long prefix — "גלויית שנה טובה — רימון",
 * "גלויית שנה טובה — דבש" — which is the least informative part of a ranked
 * list. Strip the shared run so the distinguishing word leads, but only at a
 * separator, so a name is never cut mid-word. The full name stays on hover.
 */
function sharedPrefix(names: string[]): string {
  if (names.length < 2) return "";
  let end = 0;
  const first = names[0];
  outer: for (let i = 0; i < first.length; i++) {
    for (const n of names) if (n[i] !== first[i]) break outer;
    end = i + 1;
  }
  const cut = first.slice(0, end);
  // Cut past the LAST separator in the shared run, and past the whitespace
  // around it — slicing at the dash alone leaves every name indented by the
  // space that followed it.
  const sep = [...cut.matchAll(/\s*[—–\-:·]\s*/g)].pop();
  if (!sep) return "";
  const prefix = first.slice(0, sep.index + sep[0].length);
  // Not worth the confusion of a renamed list to save a couple of characters.
  return prefix.trim().length >= 6 ? prefix : "";
}

export default function BestSellers({ orders }: { orders: Order[] }) {
  /**
   * Open on a desktop, closed on a phone — expanded it costs ~155px there, which
   * takes the order list from seven rows on screen down to three. The summary
   * still carries the headline while closed, so nothing is hidden, only folded.
   *
   * Starts open so the server HTML and the first client render agree; the phone
   * case collapses on mount rather than being guessed during render.
   */
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
  }, []);

  const { rows, top, prefix } = useMemo(() => {
    const byName = new Map<string, number>();
    for (const o of orders) {
      for (const it of o.items) {
        if (!it.name) continue;
        byName.set(it.name, (byName.get(it.name) ?? 0) + it.qty);
      }
    }
    const list = [...byName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      // Ties resolve by name so the order doesn't shuffle between renders.
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "he"));
    return {
      rows: list,
      top: list[0]?.qty ?? 0,
      prefix: sharedPrefix(list.map((r) => r.name)),
    };
  }, [orders]);

  if (!rows.length) return null;

  return (
    <details
      className="sellers"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="h">הנמכרות ביותר</span>
        <span className="lead" title={rows[0].name}>
          {prefix ? rows[0].name.slice(prefix.length) : rows[0].name} · {rows[0].qty}
        </span>
      </summary>
      <ol>
        {rows.map((r, i) => (
          <li key={r.name}>
            <span className="rank">{i + 1}</span>
            <span className="nm" title={r.name}>
              {prefix ? r.name.slice(prefix.length) : r.name}
            </span>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${top ? (r.qty / top) * 100 : 0}%` }} />
            </span>
            <span className="n">{r.qty}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
