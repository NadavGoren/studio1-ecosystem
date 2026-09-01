import { NextResponse } from "next/server";
import { isStatus } from "@/lib/domain";
import { getStore, storeKind } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every order, for the table. */
export async function GET() {
  try {
    const orders = await getStore().list();
    return NextResponse.json({ orders, store: storeKind() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load orders" },
      { status: 500 }
    );
  }
}

/** Set one status across many orders at once, atomically. */
export async function PATCH(req: Request) {
  let body: { ids?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { ids, status } = body;
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: "רשימת הזמנות לא תקינה" }, { status: 400 });
  }
  if (!isStatus(status)) {
    return NextResponse.json({ error: "סטטוס לא מוכר" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ updated: 0 });

  try {
    const updated = await getStore().setStatusMany(ids as string[], status);
    return NextResponse.json({ updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "עדכון נכשל" },
      { status: 500 }
    );
  }
}
