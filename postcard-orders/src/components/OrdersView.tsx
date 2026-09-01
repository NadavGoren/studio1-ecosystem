"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ImportDialog from "./ImportDialog";
import OrderDetail from "./OrderDetail";
import {
  serviceLabel,
  statusLabel,
  statusOptions,
  type Status,
} from "@/lib/domain";
import type { Order } from "@/types";

type Tab = "all" | "post24" | "post72" | "pickup";
type Sort = "order" | "city" | "status" | "qty";

const TABS: { key: Tab; label: string; cls: string }[] = [
  { key: "all", label: "הכל", cls: "" },
  { key: "post24", label: "דואר 24", cls: "t24" },
  { key: "post72", label: "דואר 72", cls: "t72" },
  { key: "pickup", label: "איסוף עצמי", cls: "tpickup" },
];

function inTab(o: Order, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "pickup") return o.kind === "pickup";
  return o.kind === "mail" && o.service === tab;
}

/** Anything not yet handed over still needs work — including stuck orders. */
function isOpen(o: Order): boolean {
  return o.status !== "delivered";
}

export default function OrdersView({
  initialOrders,
  loadError,
  store,
  authOff,
}: {
  initialOrders: Order[];
  loadError: string | null;
  store: "postgres" | "file";
  authOff: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | Status>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("order");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(loadError);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setOrders(body.orders as Order[]);
      setError(null);
    } catch {
      setError("לא ניתן לרענן את הרשימה");
    }
  }, []);

  /** Optimistic write — the row updates instantly, then the server confirms. */
  const patch = useCallback(
    async (id: string, body: { status?: Status; note?: string }) => {
      const before = orders;
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === id
            ? {
                ...o,
                ...(body.status !== undefined
                  ? { status: body.status, statusAt: new Date().toISOString() }
                  : {}),
                ...(body.note !== undefined ? { note: body.note } : {}),
              }
            : o
        )
      );
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      } catch {
        setOrders(before); // roll back rather than show a status that didn't save
        setError("השינוי לא נשמר — בדקי חיבור ונסי שוב");
      }
    },
    [orders]
  );

  const counts = useMemo(() => {
    const out = {} as Record<Tab, { total: number; open: number }>;
    for (const t of TABS) out[t.key] = { total: 0, open: 0 };
    for (const o of orders) {
      for (const t of TABS) {
        if (inTab(o, t.key)) {
          out[t.key].total++;
          if (isOpen(o)) out[t.key].open++;
        }
      }
    }
    return out;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orders.filter((o) => inTab(o, tab));

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
  }, [orders, tab, statusFilter, query, sort]);

  const selected = useMemo(
    () => orders.find((o) => o.orderId === selectedId) ?? null,
    [orders, selectedId]
  );

  // Arrow keys walk the list; Escape closes the panel. Typing in a field is exempt.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "Escape") {
        setSelectedId(null);
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
  }, [visible, selectedId]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          הזמנות גלויות
          <small>Studio 1 · ראש השנה</small>
        </div>
        {store === "file" && (
          <span className="devbadge" title="אין חיבור למסד נתונים — הנתונים נשמרים מקומית בלבד">
            מצב מקומי
          </span>
        )}
        {authOff && (
          <span className="devbadge" title="APP_PASSWORD לא מוגדר">
            ללא סיסמה
          </span>
        )}
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

      <div className="summary">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${t.cls}`}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            <span>{t.label}</span>
            <span className="n">{counts[t.key].total}</span>
            {/* Only worth saying when some are already done — otherwise it just
                repeats the total. */}
            {counts[t.key].open > 0 && counts[t.key].open < counts[t.key].total && (
              <span className="open">{counts[t.key].open} פתוחות</span>
            )}
            {counts[t.key].total > 0 && counts[t.key].open === 0 && (
              <span className="open">הושלם</span>
            )}
          </button>
        ))}
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
          <option value="packed">ארוז</option>
          <option value="label">מדבקה הודפסה</option>
          <option value="shipped">נשלח</option>
          <option value="delivered">נמסר</option>
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
        <span className="count">{visible.length} מתוך {orders.length}</span>
      </div>

      {error && (
        <div style={{ padding: "0 20px 12px" }}>
          <div className="error">{error}</div>
        </div>
      )}

      <div className="main">
        <div className="tablewrap">
          <div className="card">
            {visible.length === 0 ? (
              <div className="empty">
                {orders.length === 0
                  ? "אין עדיין הזמנות. לחצי על ״ייבוא CSV״ כדי להעלות את הקובץ מ-Morning."
                  : "אין הזמנות שמתאימות לסינון."}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>מס׳</th>
                    <th className="hide-sm">תאריך</th>
                    <th>לקוח</th>
                    <th>כמות</th>
                    <th>שירות</th>
                    <th className="hide-sm">יעד</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr
                      key={o.orderId}
                      aria-selected={o.orderId === selectedId}
                      className={o.status === "delivered" ? "done" : undefined}
                      onClick={() => setSelectedId(o.orderId)}
                    >
                      <td>
                        <span className="oid ltr">{o.orderId}</span>
                      </td>
                      <td className="hide-sm">
                        <span className="date ltr">{o.orderDate}</span>
                      </td>
                      <td>
                        <span className="name">{o.customer || "—"}</span>
                        {o.kind === "mail" && o.addrBlocking && (
                          <span className="warn" title={o.addrWarnings.join(" · ")}>
                            ⚠
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="qty">{o.qty}</span>
                      </td>
                      <td>
                        {o.kind === "pickup" ? (
                          <span className="pill ppickup">איסוף</span>
                        ) : (
                          <span className={`pill ${o.service === "post24" ? "p24" : "p72"}`}>
                            {serviceLabel[o.service!]}
                          </span>
                        )}
                      </td>
                      <td className="hide-sm">
                        <span className="city">
                          {o.kind === "pickup" ? o.pickupPoint : o.city || "—"}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className={`statuspick st-${o.status}`}
                          value={o.status}
                          onChange={(e) => patch(o.orderId, { status: e.target.value as Status })}
                          aria-label={`סטטוס להזמנה ${o.orderId}`}
                        >
                          {statusOptions(o.kind).map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s, o.kind)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && (
          <OrderDetail
            order={selected}
            onStatus={(id, status) => patch(id, { status })}
            onNote={(id, note) => patch(id, { note })}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {importOpen && (
        <ImportDialog onClose={() => setImportOpen(false)} onImported={refresh} />
      )}
    </div>
  );
}
