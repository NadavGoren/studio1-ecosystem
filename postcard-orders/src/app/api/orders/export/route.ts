import { NextResponse } from "next/server";
import { dayIso } from "@/lib/domain";
import { ordersToCsv } from "@/lib/exportCsv";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The current database as a CSV — as opposed to GET /api/orders/import, which
 * returns the exact file that was last uploaded. This one always works, even
 * when no upload has been stored, because it is built from the orders table.
 *
 * Behind the same session check as everything else: it is every customer's
 * address and phone number in one file.
 */
export async function GET() {
  try {
    const orders = await getStore().list();
    const filename = `הזמנות ${dayIso(0)}.csv`;
    return new NextResponse(ordersToCsv(orders), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="orders-${dayIso(0)}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ייצוא נכשל" },
      { status: 500 }
    );
  }
}
