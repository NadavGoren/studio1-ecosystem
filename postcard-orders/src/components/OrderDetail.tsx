"use client";

import { useEffect, useRef, useState } from "react";
import CopyButton from "./CopyButton";
import {
  postageIls,
  serviceLabel,
  statusLabel,
  statusOptions,
  weightG,
  type Status,
} from "@/lib/domain";
import type { Order } from "@/types";

/** The full address as Israel Post wants it read, one part per line. */
function addressLines(o: Order): string[] {
  const street = [o.street, o.house].filter(Boolean).join(" ");
  const extras = [
    o.entrance ? `כניסה ${o.entrance}` : "",
    o.apartment ? `דירה ${o.apartment}` : "",
  ].filter(Boolean);
  return [street, extras.join(", "), [o.city, o.zip].filter(Boolean).join(" ")].filter(Boolean);
}

/** Everything a shipment needs, ready to paste into דואר בקליק. */
function fullDetails(o: Order): string {
  return [o.customer, o.phone, ...addressLines(o)].filter(Boolean).join("\n");
}

export default function OrderDetail({
  order,
  onStatus,
  onNote,
  onClose,
}: {
  order: Order;
  onStatus: (id: string, status: Status) => void;
  onNote: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(order.note);
  const savedNote = useRef(order.note);

  // Switching order replaces the draft — the previous one is already persisted.
  useEffect(() => {
    setNote(order.note);
    savedNote.current = order.note;
  }, [order.orderId, order.note]);

  function commitNote() {
    if (note !== savedNote.current) {
      savedNote.current = note;
      onNote(order.orderId, note);
    }
  }

  const isMail = order.kind === "mail";
  const grams = weightG(order.qty);
  const postage = order.service ? postageIls(order.service, grams) : null;
  const lines = addressLines(order);

  return (
    <aside className="detail" aria-label={`פרטי הזמנה ${order.orderId}`}>
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{order.customer || "ללא שם"}</h2>
          <div className="sub">
            הזמנה <span className="ltr">{order.orderId}</span> · {order.orderDate} ·{" "}
            {order.qty} גלויות
          </div>
        </div>
        <button className="btn ghost sm" onClick={onClose} aria-label="סגירה">
          ✕
        </button>
      </div>

      <section>
        <h3>סטטוס</h3>
        <div className="statusgrid">
          {statusOptions(order.kind).map((s) => (
            <button
              key={s}
              type="button"
              className={`statusbtn${order.status === s ? ` st-${s}` : ""}`}
              aria-pressed={order.status === s}
              onClick={() => onStatus(order.orderId, s)}
            >
              {statusLabel(s, order.kind)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>יצירת קשר</h3>
        {order.phone && (
          <div className="field">
            <span className="val big ltr">
              <a href={`tel:${order.phone}`}>{order.phone}</a>
            </span>
            <CopyButton value={order.phone} />
          </div>
        )}
        {order.email && (
          <div className="field">
            <span className="val ltr">
              <a href={`mailto:${order.email}`}>{order.email}</a>
            </span>
            <CopyButton value={order.email} />
          </div>
        )}
        {!order.phone && !order.email && <div className="sub">אין פרטי קשר בקובץ</div>}
      </section>

      {isMail ? (
        <section>
          <h3>כתובת למשלוח</h3>
          {order.addrWarnings.length > 0 && (
            <div className="alert">
              {order.addrBlocking ? "הכתובת לא תקינה למשלוח" : "שימי לב"}
              <ul>
                {order.addrWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="field">
            <div className="val addr">
              {lines.map((l, i) => (
                <div key={l} className={i === lines.length - 1 ? "line2" : undefined}>
                  {l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <CopyButton value={lines.join("\n")} label="העתק כתובת" />
            <CopyButton
              value={fullDetails(order)}
              label="העתק הכל לדואר בקליק"
              title="שם, טלפון וכתובת מלאה"
            />
          </div>
          {order.addressRaw && (
            <details style={{ marginTop: 10, fontSize: 12, color: "var(--faint)" }}>
              <summary style={{ cursor: "pointer" }}>הכתובת כפי שהגיעה מ-Morning</summary>
              <div style={{ marginTop: 4 }}>{order.addressRaw}</div>
            </details>
          )}
        </section>
      ) : (
        <section>
          <h3>איסוף עצמי</h3>
          <div className="addr">{order.pickupPoint || order.methodRaw}</div>
        </section>
      )}

      {(order.noteShip || order.noteOrder) && (
        <section>
          <h3>הערות מהלקוח</h3>
          {order.noteShip && (
            <div className="note">
              <span className="lbl">הערה למשלוח</span>
              {order.noteShip}
            </div>
          )}
          {order.noteOrder && (
            <div className="note">
              <span className="lbl">הערה להזמנה</span>
              {order.noteOrder}
            </div>
          )}
        </section>
      )}

      <section>
        <h3>מה בהזמנה</h3>
        <ul className="items">
          {order.items.map((it) => (
            <li key={it.name}>
              <b>{it.qty}×</b>
              <span>{it.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>הערה שלנו</h3>
        <textarea
          className="mynote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          placeholder="למשל: התקשרתי, אין מענה"
        />
      </section>

      <section>
        <dl className="meta">
          <dt>שירות</dt>
          <dd>{order.service ? serviceLabel[order.service] : "איסוף עצמי"}</dd>
          <dt>משקל</dt>
          <dd>{grams} גרם</dd>
          {isMail && (
            <>
              <dt>דמי משלוח</dt>
              <dd>{postage === null ? "מעל המדרגות" : `${postage.toFixed(2)} ₪`}</dd>
            </>
          )}
          <dt>שולם</dt>
          <dd>{order.totalIls.toFixed(0)} ₪</dd>
          <dt>סטטוס ב-Morning</dt>
          <dd>{order.sourceStatus || "—"}</dd>
        </dl>
      </section>
    </aside>
  );
}
