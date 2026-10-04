"use client";

import { Moon, Sun, Sunrise } from "lucide-react";
import { useEffect, useState } from "react";
import { cityName, localTimeLabel, offsetLabel, textWindow } from "@/lib/tz";

export type WAState = {
  enabled: boolean;
  status: "off" | "starting" | "qr" | "ready" | "error";
  qr: string | null;
  me: string | null;
  error: string | null;
  log: { at: string; text: string }[];
  scanning?: boolean;
};

/** Polls WhatsApp link status from the server. */
export function useWhatsApp(intervalMs = 8000) {
  const [wa, setWa] = useState<WAState | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/whatsapp", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => alive && setWa(j))
        .catch(() => alive && setWa(null));
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);
  return wa;
}

/** Re-renders periodically so clocks stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const WINDOW_STYLE = {
  good: { cls: "bg-moss text-ink", Icon: Sun, label: "good time to text" },
  late: { cls: "bg-ochre-tint text-warn", Icon: Sunrise, label: "" },
  sleeping: { cls: "bg-tint text-muted", Icon: Moon, label: "probably asleep" },
} as const;

export function LocalTime({ tz, compact = false }: { tz: string | null; compact?: boolean }) {
  const now = useNow();
  if (!tz) return null;
  const w = WINDOW_STYLE[textWindow(tz, now)];
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 px-2 py-1 text-xs font-semibold ${w.cls}`}
      title={`${cityName(tz)} · ${offsetLabel(tz, now)}`}
    >
      <w.Icon className="h-3 w-3" />
      {localTimeLabel(tz, now)} in {cityName(tz)}
      {!compact && (
        <span className="font-normal opacity-80">
          · {w.label || (Number(now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false })) < 12 ?"early morning there" : "late evening there")}
        </span>
      )}
    </span>
  );
}
