import { NextResponse } from "next/server";
import { CsvFormatError } from "@/lib/parseOrders";
import { importCsv } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload an updated Morning export. Existing statuses are preserved. */
export async function POST(req: Request) {
  let csv = "";
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
    }
    csv = await file.text();
  } else {
    csv = await req.text();
  }

  if (!csv.trim()) return NextResponse.json({ error: "הקובץ ריק" }, { status: 400 });

  try {
    return NextResponse.json({ report: await importCsv(csv) });
  } catch (e) {
    if (e instanceof CsvFormatError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ייבוא נכשל" },
      { status: 500 }
    );
  }
}
