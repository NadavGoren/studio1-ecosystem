"use client";

import { REMEDIES, remedyLabel, type Remedy } from "@/lib/domain";

/**
 * מה סיכמנו עם הלקוח? — [זיכוי מלא] [להמתין] [שליחה חוזרת]
 *
 * Appears the moment בעיה / תקוע is chosen, in the same slot the ship-date
 * question uses, because the two are the same kind of question: a status that
 * means nothing on its own until you say what it means. Asking here is what
 * makes the refund list trustworthy — a problem logged now and classified
 * "later" is a customer nobody comes back to.
 *
 * "אחר כך" is still offered, though: sometimes the order is visibly stuck
 * before anyone has spoken to the customer at all, and pretending otherwise
 * would just get a wrong answer clicked.
 */
export default function RemedyChoice({
  current,
  onPick,
  onCancel,
}: {
  /** The remedy already agreed, when this is reopened to change it. */
  current?: Remedy | null;
  onPick: (remedy: Remedy | null) => void;
  onCancel: () => void;
}) {
  return (
    <div className="remedypick" onClick={(e) => e.stopPropagation()}>
      <div className="remedypick-h">מה סיכמנו עם הלקוח?</div>

      <div className="remedypick-opts">
        {REMEDIES.map((r) => (
          <button
            key={r}
            type="button"
            className={`statusbtn rem-${r}`}
            aria-pressed={current === r}
            onClick={() => onPick(r)}
          >
            {remedyLabel[r]}
          </button>
        ))}
        <button type="button" className="statusbtn" onClick={() => onPick(null)}>
          נחליט אחר כך
        </button>
      </div>

      <button type="button" className="shipdate-cancel" onClick={onCancel}>
        ביטול
      </button>
    </div>
  );
}
