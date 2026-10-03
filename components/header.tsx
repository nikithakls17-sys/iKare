"use client";

import { addDays, format } from "date-fns";
import { Heart, Home, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { seedDemo } from "@/lib/store";
import { useWhatsApp } from "./live";
import { useToday } from "./today-provider";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/people", label: "People", icon: Users },
];

export function Header() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-coral text-white shadow-sm">
              <Heart className="h-5 w-5" fill="currentColor" />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight">iCare</span>
          </Link>
          <div className="flex items-center gap-2">
          <WhatsAppPill />
          <nav className="hidden gap-1 sm:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  pathname === href ? "bg-ink text-white" : "text-muted hover:bg-peach hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          </div>
        </div>
        <DemoBar />
      </header>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
              pathname === href ? "text-coral" : "text-muted"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function WhatsAppPill() {
  const wa = useWhatsApp();
  if (!wa?.enabled) return null;
  const ready = wa.status === "ready";
  return (
    <Link
      href="/connect"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
        ready ? "bg-emerald-50 text-emerald-800" : "bg-peach text-coral-dark"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ready ? "animate-pulse bg-emerald-500" : "bg-coral"}`} />
      {ready ? "WhatsApp live" : "Link WhatsApp"}
    </Link>
  );
}

function DemoBar() {
  const { demo, today, todayStr, overridden, setOverride } = useToday();
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  if (!demo) return null;

  const jump = (days: number) => setOverride(format(addDays(today, days), "yyyy-MM-dd"));

  return (
    <div className="border-t border-line bg-ink text-white">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="font-semibold">⏳ Time travel</span>
        <input
          type="date"
          value={todayStr}
          onChange={(e) => setOverride(e.target.value || null)}
          className="rounded-md bg-white/10 px-2 py-1 text-white [color-scheme:dark]"
        />
        <button onClick={() => jump(1)} className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20">
          +1 day
        </button>
        {overridden && (
          <button
            onClick={() => setOverride(null)}
            className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
          >
            Back to real today
          </button>
        )}
        <button
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              await seedDemo(new Date());
              setOverride(null);
              router.push("/");
              window.dispatchEvent(new Event("icare:refresh"));
            } finally {
              setSeeding(false);
            }
          }}
          className="ml-auto rounded-md bg-coral px-2 py-1 font-semibold hover:bg-coral-dark disabled:opacity-60"
        >
          {seeding ? "Loading…" : "Reset demo data"}
        </button>
      </div>
    </div>
  );
}
