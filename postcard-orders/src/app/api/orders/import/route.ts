import { NextResponse } from "next/server";
import { CsvFormatError } from "@/lib/parseOrders";
import { getStore, importCsv } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload an updated Morning export. Existing statuses are preserved. */
export async function POST(req: Request) {
  let csv = "";
  let filename = "morning.csv";
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
    }
    // NOT file.text(): Blob decoding strips a UTF-8 BOM, and the stored copy
    // has to round-trip byte for byte. Excel on Windows reads a BOM-less CSV
    // as the local codepage, which turns every Hebrew name into mojibake.
    // The parser strips the BOM itself, so keeping it here costs nothing.
    csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await file.arrayBuffer());
    // Kept so the download hands back the file under the name it arrived with.
    // Basename only: a browser can send a path, and it must never steer where
    // anything is written or what the download is called.
    if (file.name) filename = file.name.split(/[\\/]/).pop() || filename;
  } else {
    csv = await req.text();
  }

  if (!csv.trim()) return NextResponse.json({ error: "הקובץ ריק" }, { status: 400 });

  try {
    return NextResponse.json({ report: await importCsv(csv, filename) });
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

/**
 * Hand back the exact file that was last imported — not a CSV regenerated from
 * the orders table, which would have different columns and a different shape.
 * Behind the same session check as everything else: it holds every customer's
 * address and phone number.
 */
export async function GET() {
  let file;
  try {
    file = await getStore().getLastImportFile();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "הורדה נכשלה" },
      { status: 500 }
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: "לא נשמר קובץ. הקובץ נשמר החל מהייבוא הבא." },
      { status: 404 }
    );
  }

  // A Hebrew filename can't ride in the plain `filename=` parameter, so send an
  // ASCII fallback alongside the RFC 5987 encoded real one.
  const ascii = file.filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new NextResponse(file.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "cache-control": "no-store",
    },
  });
}
