import { NextResponse } from "next/server";
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
