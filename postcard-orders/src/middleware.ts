import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, authConfigured, authDisabled, tokenValid } from "@/lib/auth";

/**
 * Paths reachable without a session — the login screen, the login endpoint,
 * and the logo image the login screen itself displays. An explicit allowlist
 * rather than "anything under /public" or "anything with an image extension":
 * this app's /public exists only for the logo, and a narrow list can't
 * accidentally expose some other file dropped in there later.
 */
const PUBLIC = ["/login", "/api/auth", "/logo.jpg"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // A deployment with no APP_PASSWORD would expose customer phone numbers and
  // addresses on a public URL, so refuse to serve rather than defaulting open.
  if (!authConfigured() && process.env.NODE_ENV === "production") {
    return new NextResponse(
      "APP_PASSWORD is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  if (authDisabled() || PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (await tokenValid(req.cookies.get(COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; browsers get the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
