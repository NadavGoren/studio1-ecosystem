/**
 * One shared password, held in a signed httpOnly cookie.
 *
 * Uses Web Crypto rather than node:crypto so the exact same code runs in the
 * Edge middleware and in the Node API routes.
 */

export const COOKIE = "po_session";
const MAX_AGE_DAYS = 30;

const enc = new TextEncoder();

export function appPassword(): string {
  return process.env.APP_PASSWORD ?? "";
}

/** In production a missing password is a misconfiguration, and we fail closed. */
export function authConfigured(): boolean {
  return appPassword() !== "";
}

/** Locally, with no password set, the app is open so it can be tried instantly. */
export function authDisabled(): boolean {
  return !authConfigured() && process.env.NODE_ENV !== "production";
}

function secret(): string {
  // Falling back to the password keeps a single-variable setup working; the
  // cookie is still unforgeable without knowing it.
  return process.env.AUTH_SECRET || appPassword() || "insecure-dev-secret";
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Length-independent comparison, so a wrong guess leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compare a submitted password against the configured one, in constant time. */
export async function passwordMatches(submitted: string): Promise<boolean> {
  const real = appPassword();
  if (!real) return false;
  // Hashing both sides first makes the comparison independent of their lengths.
  const [a, b] = await Promise.all([hmac(`pw:${submitted}`), hmac(`pw:${real}`)]);
  return safeEqual(a, b);
}

export async function issueToken(): Promise<string> {
  const exp = String(Date.now() + MAX_AGE_DAYS * 86_400_000);
  return `${exp}.${await hmac(exp)}`;
}

export async function tokenValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_DAYS * 86_400,
};
