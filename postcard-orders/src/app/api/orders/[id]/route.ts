import { NextResponse } from "next/server";
import { isStatus } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update one order's workflow status and/or our own free-text note. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { status?: unknown; note?: unknown };
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
      order = await store.setStatus(id, body.status);
    }
    if (body.note !== undefined) {
      if (typeof body.note !== "string") {
        return NextResponse.json({ error: "הערה חייבת להיות טקסט" }, { status: 400 });
      }
      order = await store.setNote(id, body.note.slice(0, 2000));
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "עדכון נכשל" },
      { status: 500 }
    );
  }

  if (!order) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  return NextResponse.json({ order });
}
