import { NextResponse } from "next/server";
import { isDayIso, isStatus } from "@/lib/domain";
import { NewOrderError, buildManualOrder, nextManualId, type NewOrderInput } from "@/lib/newOrder";
import { getStore, storeKind } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every order, for the table. */
export async function GET() {
  try {
    const store = getStore();
    const [orders, lastImportAt, importFile] = await Promise.all([
      store.list(),
      store.getLastImportAt(),
      store.getLastImportFileInfo(),
    ]);
    return NextResponse.json({ orders, store: storeKind(), lastImportAt, importFile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load orders" },
      { status: 500 }
    );
  }
}

/** Set one status across many orders at once, atomically. */
export async function PATCH(req: Request) {
  let body: { ids?: unknown; status?: unknown; shippedOn?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { ids, status, shippedOn } = body;
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: "רשימת הזמנות לא תקינה" }, { status: 400 });
  }
  if (!isStatus(status)) {
    return NextResponse.json({ error: "סטטוס לא מוכר" }, { status: 400 });
  }
  if (shippedOn !== undefined && shippedOn !== null && !isDayIso(shippedOn)) {
    return NextResponse.json({ error: "תאריך משלוח לא תקין" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ updated: 0 });

  try {
    const updated = await getStore().setStatusMany(
      ids as string[],
      status,
      (shippedOn as string | null | undefined) ?? null
    );
    return NextResponse.json({ updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "עדכון נכשל" },
      { status: 500 }
    );
  }
}

/** Create one hand-entered order — a phone order, a DM, a market sale. */
export async function POST(req: Request) {
  let body: NewOrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const store = getStore();
    const existing = await store.list();
    // A number the user typed wins; otherwise take the next free M-n.
    const id = (body.orderId ?? "").trim() || nextManualId(existing);

    const order = buildManualOrder(body, id);
    const created = await store.createOrder(order);
    if (!created) {
      return NextResponse.json(
        { error: `מספר הזמנה ${id} כבר קיים` },
        { status: 409 }
      );
    }
    return NextResponse.json({ order: created });
  } catch (e) {
    if (e instanceof NewOrderError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שמירת ההזמנה נכשלה" },
      { status: 500 }
    );
  }
}
