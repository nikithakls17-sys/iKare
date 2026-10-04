"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSettings, permission } from "@/lib/notify";

const DISMISS_KEY = "icare.notifyBannerDismissed";

/** Gentle prompt on Today to turn on reminders, until enabled or dismissed. */
export function NotifyBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    const p = permission();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state after hydration
    setShow(!dismissed && p !== "denied" && p !== "unsupported" && !(loadSettings().enabled && p === "granted"));
  }, []);
  if (!show) return null;
  return (
    <div className="rise mb-5 flex items-center gap-3 rounded-2xl border border-coral/30 bg-peach px-4 py-3">
      <BellRing className="h-5 w-5 shrink-0 text-coral" />
      <p className="flex-1 text-sm">
        <b>Never miss a check-in.</b> Get a nudge when it&apos;s time to show up for someone.
      </p>
      <Link href="/settings" className="shrink-0 rounded-full bg-coral px-3 py-1.5 text-sm font-bold text-white hover:bg-coral-dark">
        Turn on
      </Link>
      <button
        aria-label="Dismiss"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
        }}
        className="text-muted hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
