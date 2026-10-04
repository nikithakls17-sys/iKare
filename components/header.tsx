"use client";

import { addDays, format } from "date-fns";
import { Bell, Home, Info, Monitor, Moon, Plus, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { seedDemo } from "@/lib/store";
import { AnimatedBackground } from "./core/animated-background";
import { Mark } from "./geo";
import { useWhatsApp } from "./live";
import { useToday } from "./today-provider";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/people", label: "People", icon: Users },
];

export function Header() {
  const pathname = usePathname();
  const activeHref = NAV.find(({ href }) => isActive(pathname, href))?.href;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 justify-self-start">
            <Mark />
            <span className="font-display text-2xl font-semibold tracking-tight">iKare</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            <AnimatedBackground
              defaultValue={activeHref}
              className="bg-strong"
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              enableHover
            >
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  data-id={href}
                  className="inline-flex h-12 items-center gap-2 px-4 text-sm font-bold text-ink transition-colors duration-300 hover:text-white data-[checked=true]:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </AnimatedBackground>
          </nav>
          <div className="flex items-center gap-1 justify-self-end sm:gap-2">
          <WhatsAppPill />
          <span className="mx-2 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <Link
            href="/about"
            aria-label="About iKare"
            className={`grid h-12 w-12 place-items-center rounded-full transition hover:bg-tint ${pathname === "/about" ? "text-accent" : "text-muted"}`}
          >
            <Info className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            aria-label="Notifications and settings"
            className={`grid h-12 w-12 place-items-center rounded-full transition hover:bg-tint ${pathname === "/settings" ? "text-accent" : "text-muted"}`}
          >
            <Bell className="h-5 w-5" />
          </Link>
          <ThemeToggle />
          </div>
        </div>
        <DemoBar />
      </header>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-line bg-cream/85 px-2 pt-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <AnimatedBackground
          defaultValue={activeHref}
          className="bg-strong"
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        >
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-id={href}
              className="flex flex-1 flex-col items-center justify-center min-h-14 gap-1 py-2 text-xs font-bold text-ink transition-colors duration-300 data-[checked=true]:text-white"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </AnimatedBackground>
      </nav>
    </>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

type Theme = "system" | "light" | "dark";
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("icare.theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved preference after hydration
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const cycle = () => {
    const next = NEXT_THEME[theme];
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem("icare.theme");
      else localStorage.setItem("icare.theme", next);
    } catch {}
  };
  const Icon = THEME_ICON[theme];
  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="grid h-12 w-12 place-items-center rounded-full text-muted transition hover:bg-tint hover:text-ink"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function WhatsAppPill() {
  const wa = useWhatsApp();
  if (!wa?.enabled) return null;
  const ready = wa.status === "ready";
  return (
    <Link
      href="/connect"
      aria-label={ready ? "WhatsApp live" : "Link WhatsApp"}
      className={`flex h-12 min-w-12 items-center justify-center gap-2 whitespace-nowrap text-xs font-bold sm:px-4 ${
        ready ? "bg-moss text-ink" : "bg-tint text-accent-deep"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ready ? "animate-pulse bg-accent" : "bg-accent"}`} />
      <span className="hidden sm:inline">{ready ? "WhatsApp live" : "Link WhatsApp"}</span>
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
    <div className="border-t border-line bg-strong text-white">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="font-semibold">⏳ Time travel</span>
        <input
          type="date"
          value={todayStr}
          onChange={(e) => setOverride(e.target.value || null)}
          className="bg-white/10 px-2 py-1 text-white [color-scheme:dark]"
        />
        <button onClick={() => jump(1)} className="bg-white/10 px-2 py-1 hover:bg-white/20">
          +1 day
        </button>
        {overridden && (
          <button
            onClick={() => setOverride(null)}
            className="bg-white/10 px-2 py-1 hover:bg-white/20"
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
          className="ml-auto bg-accent px-2 py-1 font-semibold text-on-accent hover:bg-accent-deep disabled:opacity-60"
        >
          {seeding ? "Loading…" : "Reset demo data"}
        </button>
      </div>
    </div>
  );
}
