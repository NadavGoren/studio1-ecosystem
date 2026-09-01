import { NextResponse } from "next/server";
import { COOKIE, cookieOptions, issueToken, passwordMatches } from "@/lib/auth";

export const runtime = "nodejs";

/** Log in: exchange the shared password for a signed session cookie. */
export async function POST(req: Request) {
  let password = "";
  try {
    ({ password = "" } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    // A uniform delay blunts rapid guessing without a rate-limit dependency.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await issueToken(), cookieOptions);
  return res;
}

/** Log out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
