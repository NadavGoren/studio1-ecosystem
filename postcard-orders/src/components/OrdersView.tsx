"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CsvNag from "./CsvNag";
import ImportDialog from "./ImportDialog";
import LastImport from "./LastImport";
import OrderDetail from "./OrderDetail";
import OrdersTable from "./OrdersTable";
import ShipDateChoice from "./ShipDateChoice";
import { statusLabel, statusOptions, type Status } from "@/lib/domain";
import type { Order } from "@/types";

type Sort = "order" | "city" | "status" | "qty";
type MailFilter = "all" | "post24" | "post72";

/** Anything not yet handed over still needs work — including stuck orders. */
function isOpen(o: Order): boolean {
  return o.status !== "delivered";
}

export default function OrdersView({
  initialOrders,
  initialLastImportAt,
  loadError,
  store,
  authOff,
}: {
  initialOrders: Order[];
  initialLastImportAt: string | null;
  loadError: string | null;
  store: "postgres" | "file";
  authOff: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [lastImportAt, setLastImportAt] = useState(initialLastImportAt);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | Status>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("order");
  const [mailFilter, setMailFilter] = useState<MailFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [bulkShipAsk, setBulkShipAsk] = useState(false);
  const [error, setError] = useState<string | null>(loadError);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setOrders(body.orders as Order[]);
      setLastImportAt(body.lastImportAt as string | null);
      setChecked(new Set());
      setError(null);
    } catch {
      setError("לא ניתן לרענן את הרשימה");
    }
  }, []);

  /** Optimistic write across one or many orders; rolls back if the server says no. */
  const setStatuses = useCallback(
    async (ids: string[], status: Status, shippedOn: string | null = null) => {
      if (!ids.length) return;
      const before = orders;
      const at = new Date().toISOString();
      const target = new Set(ids);
      setOrders((prev) =>
        prev.map((o) =>
          target.has(o.orderId)
            ? // Mirror the store's rule exactly: the ship date moves only on
              // the way into "shipped", so the optimistic row can't show a
              // date the server is about to leave alone.
              { ...o, status, statusAt: at, ...(status === "shipped" ? { shippedOn } : null) }
            : o
        )
      );
      setChecked(new Set());
      try {
        // One request, whatever the count. Firing one per order races and loses
        // writes while still answering 200 for each.
        const res = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids, status, shippedOn }),
        });
        if (!res.ok) throw new Error();
        const { updated } = await res.json();
        // Trust the server's count, not the request succeeding.
        if (updated !== ids.length) throw new Error();
      } catch {
        setOrders(before); // never leave a status showing that didn't save
        setError("השינוי לא נשמר — בדקי חיבור ונסי שוב");
      }
    },
    [orders]
  );

  const setNote = useCallback(
    async (id: string, note: string) => {
      const before = orders;
      setOrders((prev) => prev.map((o) => (o.orderId === id ? { ...o, note } : o)));
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setOrders(before);
        setError("ההערה לא נשמרה");
      }
    },
    [orders]
  );

  /* ── Totals: the headline is how many postcards are spoken for ────────── */
  const stats = useMemo(() => {
    let cards = 0;
    let mailCards = 0;
    let pickupCards = 0;
    let open = 0;
    for (const o of orders) {
      cards += o.qty;
      if (o.kind === "mail") mailCards += o.qty;
      else pickupCards += o.qty;
      if (isOpen(o)) open++;
    }
    return { cards, mailCards, pickupCards, orders: orders.length, open };
  }, [orders]);

  /* ── Search + status filter, applied to both tables alike ─────────────── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orders;

    if (statusFilter === "open") list = list.filter(isOpen);
    else if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);

    if (q) {
      list = list.filter((o) =>
        [o.orderId, o.customer, o.city, o.phone, o.email, o.street, o.pickupPoint]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const collator = new Intl.Collator("he");
    const byOrder = (a: Order, b: Order) =>
      b.orderId.localeCompare(a.orderId, "en", { numeric: true });

    return [...list].sort((a, b) => {
      if (sort === "city") {
        const av = a.kind === "pickup" ? a.pickupPoint : a.city;
        const bv = b.kind === "pickup" ? b.pickupPoint : b.city;
        return collator.compare(av, bv) || byOrder(a, b);
      }
      if (sort === "qty") return b.qty - a.qty || byOrder(a, b);
      if (sort === "status") {
        const rank = (o: Order) => statusOptions(o.kind).indexOf(o.status);
        return rank(a) - rank(b) || byOrder(a, b);
      }
      return byOrder(a, b);
    });
  }, [orders, statusFilter, query, sort]);

  const mailRows = useMemo(() => {
    const all = filtered.filter((o) => o.kind === "mail");
    return mailFilter === "all" ? all : all.filter((o) => o.service === mailFilter);
  }, [filtered, mailFilter]);

  const pickupRows = useMemo(() => filtered.filter((o) => o.kind === "pickup"), [filtered]);

  const mailCards = useMemo(() => mailRows.reduce((n, o) => n + o.qty, 0), [mailRows]);
  const pickupCards = useMemo(() => pickupRows.reduce((n, o) => n + o.qty, 0), [pickupRows]);

  const selected = useMemo(
    () => orders.find((o) => o.orderId === selectedId) ?? null,
    [orders, selectedId]
  );

  /* Only ever act on rows that are actually on screen — a hidden row must never
     be swept up by a bulk change the user can't see. */
  const visible = useMemo(() => [...mailRows, ...pickupRows], [mailRows, pickupRows]);
  const chosen = useMemo(
    () => visible.filter((o) => checked.has(o.orderId)),
    [visible, checked]
  );

  // A pickup order's ladder is the shorter one, so a mixed selection offers
  // only the steps that are valid for every order in it.
  const bulkKind = chosen.every((o) => o.kind === "mail") ? "mail" : "pickup";

  // The bar vanishes when the selection empties. Make sure it comes back on
  // the status list rather than on a date question left over from last time.
  useEffect(() => {
    if (!chosen.length) setBulkShipAsk(false);
  }, [chosen.length]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setSelectedId(null); // bulk mode and single-order review don't mix
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[], on: boolean) => {
    if (on) setSelectedId(null);
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  // Arrow keys walk the combined list; Escape closes the panel or clears a selection.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "Escape") {
        if (checked.size) setChecked(new Set());
        else setSelectedId(null);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (!visible.length) return;
      e.preventDefault();
      const at = visible.findIndex((o) => o.orderId === selectedId);
      const next =
        e.key === "ArrowDown"
          ? Math.min(visible.length - 1, at + 1)
          : Math.max(0, at <= 0 ? 0 : at - 1);
      setSelectedId(visible[at === -1 ? 0 : next].orderId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selectedId, checked]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brandrow">
          <img className="brandmark" src="/logo.jpg" alt="עדי כפרי X נדב גורן" width={40} height={40} />
          <div className="brand">
            הזמנות גלויות
            <small>ראש השנה</small>
          </div>
        </div>
        {store === "file" && (
          <span className="devbadge" title="אין חיבור למסד נתונים — הנתונים נשמרים מקומית בלבד">
            מצב מקומי
          </span>
        )}
        {authOff && <span className="devbadge">ללא סיסמה</span>}
        <div className="spacer" />
        <button className="btn primary" onClick={() => setImportOpen(true)}>
          ייבוא CSV
        </button>
        {!authOff && (
          <button
            className="btn ghost"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              location.href = "/login";
            }}
          >
            יציאה
          </button>
        )}
      </header>

      <CsvNag onImport={() => setImportOpen(true)} />

      <div className="stats">
        <div className="stat hero">
          <div className="v">{stats.cards}</div>
          <div className="l">סה״כ גלויות</div>
        </div>
        <div className="stat mail">
          <div className="v">{stats.mailCards}</div>
          <div className="l">גלויות למשלוח</div>
        </div>
        <div className="stat pickup">
          <div className="v">{stats.pickupCards}</div>
          <div className="l">גלויות לאיסוף</div>
        </div>
        <div className="stat">
          <div className="v">{stats.orders}</div>
          <div className="l">הזמנות</div>
        </div>
        <div className="stat">
          <div className="v">{stats.open}</div>
          <div className="l">ממתינות לטיפול</div>
        </div>
        {/* Beside the totals rather than up in the header: these numbers are
            only as current as the CSV they came from, so the two belong in
            the same glance. */}
        <div className="statsmeta">
          <LastImport iso={lastImportAt} />
        </div>
      </div>

      <div className="filters">
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, מספר הזמנה, עיר או טלפון"
          aria-label="חיפוש"
        />
        <select
          className="control"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="open">רק פתוחות</option>
          <option value="new">חדש</option>
          <option value="packed">ארוז / מוכן לאיסוף</option>
          <option value="notified">הודעה נשלחה</option>
          <option value="label">מדבקה הודפסה</option>
          <option value="shipped">נשלח</option>
          <option value="delivered">נמסר / נאסף</option>
          <option value="issue">בעיה / תקוע</option>
        </select>
        <select
          className="control"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="מיון"
        >
          <option value="order">מיון: הזמנה אחרונה</option>
          <option value="city">מיון: עיר</option>
          <option value="qty">מיון: כמות</option>
          <option value="status">מיון: סטטוס</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: "0 20px 12px" }}>
          <div className="error">{error}</div>
        </div>
      )}

      <div className="main">
        <div className="tablewrap">
          <section className="section">
            <div className="sectionhead">
              <h2>משלוחים</h2>
              <span className="sub">
                {mailRows.length} הזמנות · {mailCards} גלויות
              </span>
              <div className="seg">
                {(
                  [
                    ["all", "הכל"],
                    ["post24", "דואר 24"],
                    ["post72", "דואר 72"],
                  ] as [MailFilter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    aria-pressed={mailFilter === k}
                    onClick={() => setMailFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <OrdersTable
              orders={mailRows}
              variant="mail"
              selectedId={selectedId}
              checked={checked}
              onSelect={setSelectedId}
              onToggleCheck={toggleCheck}
              onToggleAll={toggleAll}
              onStatus={(id, s, shippedOn) => setStatuses([id], s, shippedOn)}
              emptyText={
                orders.length === 0
                  ? "אין עדיין הזמנות. לחצי על ״ייבוא CSV״ כדי להעלות את הקובץ מ-Morning."
                  : "אין משלוחים שמתאימים לסינון."
              }
            />
          </section>

          <section className="section">
            <div className="sectionhead">
              <h2>איסוף עצמי</h2>
              <span className="sub">
                {pickupRows.length} הזמנות · {pickupCards} גלויות
              </span>
            </div>
            <OrdersTable
              orders={pickupRows}
              variant="pickup"
              selectedId={selectedId}
              checked={checked}
              onSelect={setSelectedId}
              onToggleCheck={toggleCheck}
              onToggleAll={toggleAll}
              onStatus={(id, s, shippedOn) => setStatuses([id], s, shippedOn)}
              emptyText={
                orders.length === 0 ? "—" : "אין הזמנות איסוף שמתאימות לסינון."
              }
            />
          </section>
        </div>

        {selected && (
          <OrderDetail
            order={selected}
            onStatus={(id, status, shippedOn) => setStatuses([id], status, shippedOn)}
            onNote={setNote}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {chosen.length > 0 && (
        <div className="bulkbar" role="region" aria-label="פעולות על הזמנות שנבחרו">
          <span className="n">{chosen.length} נבחרו</span>
          <span className="sep" />
          {bulkShipAsk ? (
            // One date for the whole batch — they went to the post office
            // together, so asking once per order would be busywork.
            <ShipDateChoice
              count={chosen.length}
              onPick={(day) => {
                setStatuses(chosen.map((o) => o.orderId), "shipped", day);
                setBulkShipAsk(false);
              }}
              onCancel={() => setBulkShipAsk(false)}
            />
          ) : (
            <>
              {statusOptions(bulkKind).map((s) => (
                <button
                  key={s}
                  className="btn sm"
                  onClick={() =>
                    s === "shipped"
                      ? setBulkShipAsk(true)
                      : setStatuses(chosen.map((o) => o.orderId), s)
                  }
                >
                  {statusLabel(s, bulkKind)}
                </button>
              ))}
              <span className="sep" />
              <button className="btn ghost sm" onClick={() => setChecked(new Set())}>
                ביטול
              </button>
            </>
          )}
        </div>
      )}

      {importOpen && (
        <ImportDialog onClose={() => setImportOpen(false)} onImported={refresh} />
      )}
    </div>
  );
}
