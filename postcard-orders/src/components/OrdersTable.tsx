"use client";

import StatusControl from "./StatusControl";
import { serviceLabel, type Status } from "@/lib/domain";
import type { Order } from "@/types";

/**
 * One table. Shipments and self-pickup each get their own instance rather than
 * sharing one behind a filter — they are two different jobs on two different
 * days, and the columns that matter differ ("יעד" vs "נקודת איסוף").
 */
export default function OrdersTable({
  orders,
  variant,
  selectedId,
  checked,
  onSelect,
  onToggleCheck,
  onToggleAll,
  onStatus,
  emptyText,
}: {
  orders: Order[];
  variant: "mail" | "pickup";
  selectedId: string | null;
  checked: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  onStatus: (id: string, status: Status) => void;
  emptyText: string;
}) {
  if (orders.length === 0) {
    return (
      <div className="card">
        <div className="empty">{emptyText}</div>
      </div>
    );
  }

  const ids = orders.map((o) => o.orderId);
  const allChecked = ids.every((id) => checked.has(id));

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th className="selcol">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(ids, e.target.checked)}
                aria-label="בחירת הכל"
              />
            </th>
            <th>מס׳</th>
            <th className="hide-sm">תאריך</th>
            <th>לקוח</th>
            <th>כמות</th>
            {variant === "mail" && <th>שירות</th>}
            <th className="hide-sm">{variant === "mail" ? "יעד" : "נקודת איסוף"}</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.orderId}
              aria-selected={o.orderId === selectedId}
              className={o.status === "delivered" ? "done" : undefined}
              onClick={() => onSelect(o.orderId)}
            >
              <td className="selcol" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked.has(o.orderId)}
                  onChange={() => onToggleCheck(o.orderId)}
                  aria-label={`בחירת הזמנה ${o.orderId}`}
                />
              </td>
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
              {variant === "mail" && (
                <td>
                  <span className={`pill ${o.service === "post24" ? "p24" : "p72"}`}>
                    {o.service ? serviceLabel[o.service] : "—"}
                  </span>
                </td>
              )}
              <td className="hide-sm">
                <span className="city">
                  {variant === "mail" ? o.city || "—" : o.pickupPoint || "—"}
                </span>
              </td>
              <td>
                <StatusControl
                  status={o.status}
                  kind={o.kind}
                  onChange={(s) => onStatus(o.orderId, s)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
