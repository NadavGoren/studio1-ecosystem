"use client";

import { useRef, useState } from "react";
import { serviceLabel } from "@/lib/domain";
import type { ImportReport } from "@/types";

export default function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/orders/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "הייבוא נכשל");
        return;
      }
      setReport(body.report as ImportReport);
      onImported();
    } catch {
      setError("אין חיבור לשרת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ייבוא קובץ הזמנות"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>ייבוא הזמנות</h2>
        <p className="lede">
          גררי לכאן את קובץ ה-CSV מ-Morning. אפשר להעלות את אותו קובץ שוב ושוב —
          הזמנות חדשות נוספות, קיימות מתעדכנות, <b>והסטטוסים שסימנת נשמרים</b>.
        </p>

        <div
          className={over ? "drop over" : "drop"}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <strong>{busy ? "מייבא…" : "גררי קובץ CSV לכאן"}</strong>
          <span>או לחצי לבחירת קובץ</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>

        {error && <div className="error">{error}</div>}

        {report && (
          <div className="report">
            <dl>
              <dt>הזמנות בקובץ</dt>
              <dd>{report.orders}</dd>
              <dt>חדשות</dt>
              <dd>{report.created}</dd>
              <dt>עודכנו</dt>
              <dd>{report.updated}</dd>
              <dt>ללא שינוי</dt>
              <dd>{report.unchanged}</dd>
            </dl>
            {/* State the guarantee outright — it is the thing Nadav relies on every
                time he re-uploads, and silence about it reads as risk. */}
            <div className="kept">
              {report.statusesKept > 0
                ? `${report.statusesKept} הזמנות שכבר סימנת שמרו על הסטטוס וההערות שלהן.`
                : "הסטטוסים וההערות שסימנת נשמרים תמיד — ייבוא לא מאפס אותם."}
            </div>
            {report.problems > 0 && (
              <div className="flag">
                {report.problems} הזמנות עם כתובת בעייתית — מסומנות ברשימה ב־⚠
              </div>
            )}
            {report.serviceChanges.length > 0 && (
              <div className="flag" style={{ marginTop: 8 }}>
                שינוי שירות בעקבות שינוי כמות:
                <ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>
                  {report.serviceChanges.map((c) => (
                    <li key={c.orderId}>
                      <span className="ltr">{c.orderId}</span>:{" "}
                      {c.from ? serviceLabel[c.from] : "איסוף עצמי"} →{" "}
                      {c.to ? serviceLabel[c.to] : "איסוף עצמי"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            {report ? "סיום" : "סגירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
