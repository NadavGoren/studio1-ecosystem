"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "כניסה נכשלה");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("אין חיבור לשרת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <img className="loginmark" src="/logo.jpg" alt="עדי כפרי X נדב גורן" width={72} height={72} />
        <h1>הזמנות גלויות</h1>
        <p>ראש השנה</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          autoFocus
          autoComplete="current-password"
          aria-label="סיסמה"
        />
        <button className="btn primary" disabled={busy || !password}>
          {busy ? "רגע…" : "כניסה"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
