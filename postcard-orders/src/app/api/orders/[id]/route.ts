import { NextResponse } from "next/server";
import { ComplaintError, isDayIso, isStatus, parseComplaint } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update one order's workflow status, our own free-text note, and/or the
 *  complaint attached to it. Any combination in one request — reporting a
 *  problem sets the status and opens the complaint together, and two round
 *  trips could leave one of them applied and the other not. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { status?: unknown; note?: unknown; shippedOn?: unknown; complaint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  let order = null;

  try {
    const store = getStore();
    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return NextResponse.json({ error: "סטטוס לא מוכר" }, { status: 400 });
      }
      if (body.shippedOn !== undefined && body.shippedOn !== null && !isDayIso(body.shippedOn)) {
        return NextResponse.json({ error: "תאריך משלוח לא תקין" }, { status: 400 });
      }
      order = await store.setStatus(id, body.status, (body.shippedOn as string | null) ?? null);
    }
    // Before the note, so a request carrying both ends on the note's row —
    // which is what the client's optimistic copy already shows.
    if (body.complaint !== undefined) {
      order = await store.setComplaint(id, parseComplaint(body.complaint));
    }
    if (body.note !== undefined) {
      if (typeof body.note !== "string") {
        return NextResponse.json({ error: "הערה חייבת להיות טקסט" }, { status: 400 });
      }
      order = await store.setNote(id, body.note.slice(0, 2000));
    }
  } catch (e) {
    // A malformed complaint is the caller's mistake, not a server fault, and
    // its message is written to be read by the person who typed it.
    if (e instanceof ComplaintError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "עדכון נכשל" },
      { status: 500 }
    );
  }

  if (!order) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  return NextResponse.json({ order });
}

/** Delete a hand-entered order. Imported ones are refused — see the store. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const ok = await getStore().deleteManualOrder(id);
    if (!ok) {
      return NextResponse.json(
        { error: "אפשר למחוק רק הזמנות שהוזנו ידנית" },
        { status: 403 }
      );
    }
    return NextResponse.json({ deleted: id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "המחיקה נכשלה" },
      { status: 500 }
    );
  }
}
