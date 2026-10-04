"use client";

import { Loader2, Lock } from "lucide-react";
import { Mark } from "@/components/geo";
import { useState } from "react";

export default function UnlockPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next.startsWith("/") ? next : "/";
    } else {
      setError("That's not it. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-10 text-center">
      <Mark className="mx-auto h-16 w-16" />
      <h1 className="font-display mt-6 text-3xl font-semibold">Welcome to iKare</h1>
      <p className="mt-2 text-muted">This iKare is private. Enter the passcode to continue.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Passcode"
            className="w-full border border-line bg-paper py-4 pl-11 pr-4 text-center text-lg tracking-widest outline-none focus:border-accent"
          />
        </div>
        {error && <p className="text-sm text-warn">{error}</p>}
        <button
          disabled={busy || !code}
          className="flex w-full items-center justify-center gap-2 bg-accent py-4 font-bold text-on-accent hover:bg-accent-deep disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Unlock
        </button>
      </form>
    </div>
  );
}
