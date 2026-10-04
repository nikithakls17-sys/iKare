"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";
import {
  alreadySent,
  loadSettings,
  markSent,
  permission,
  showNotification,
  type NotifySettings,
} from "@/lib/notify";
import { cityName, localDateStr, localTimeLabel, textWindow, tzOffsetMinutes, viewerTimezone } from "@/lib/tz";
import type { Moment, Person } from "@/lib/types";
import { useData } from "@/lib/use-data";
import { momentHeadline } from "./moment-card";
import { useToday } from "./today-provider";

const MAX_PER_ROUND = 3;
const LAST_SEEN_KEY = "icare.notify.lastSeen";

type Alert = { key: string; title: string; body: string; url: string };

/** Registers the service worker and fires reminders. Renders nothing. */
export function Notifier() {
  const { people, moments } = useData();
  const { today, todayStr } = useToday();
  const [settings, setSettings] = useState<NotifySettings | null>(null);
  const [tick, setTick] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const load = () => setSettings(loadSettings());
    load();
    window.addEventListener("icare:notify-settings", load);
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => {
      window.removeEventListener("icare:notify-settings", load);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!settings?.enabled || permission() !== "granted" || running.current) return;
    if (people.length === 0 && moments.length === 0) return;
    running.current = true;
    const alerts = buildAlerts(settings, people, moments, today, todayStr);
    (async () => {
      const fresh = alerts.filter((a) => !alreadySent(a.key));
      const now = fresh.slice(0, MAX_PER_ROUND);
      for (const a of now) {
        await showNotification(a.title, a.body, a.url, a.key);
        markSent(a.key);
      }
      const rest = fresh.slice(MAX_PER_ROUND);
      if (rest.length) {
        await showNotification(`iKare: ${rest.length} more to show up for`, rest.map((a) => a.title).join(" · "), "/");
        rest.forEach((a) => markSent(a.key));
      }
    })().finally(() => {
      running.current = false;
    });
  }, [settings, people, moments, today, todayStr, tick]);

  return null;
}

function buildAlerts(
  s: NotifySettings,
  people: Person[],
  moments: Moment[],
  today: Date,
  todayStr: string,
): Alert[] {
  const alerts: Alert[] = [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const pending = moments.filter((m) => m.status === "pending");
  const due = pending.filter((m) => m.followup_date <= todayStr);
  const quiet = (p: Person) =>
    p.last_contact_at ? differenceInCalendarDays(today, parseISO(p.last_contact_at)) : null;
  const drifting = people.filter((p) => {
    const q = quiet(p);
    return q !== null && q > p.contact_every_days && !due.some((m) => m.person_id === p.id);
  });
  const individual = s.style === "each";
  // Remember per real day, so time travel in demos does not repeat the same reminder.
  const realDay = localDateStr(viewerTimezone());

  // New moments spotted on WhatsApp since we last looked (never replays old history).
  if (s.kinds.whatsapp) {
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0);
    } catch {}
    const newest = moments.reduce((t, m) => Math.max(t, Date.parse(m.created_at) || 0), 0);
    if (lastSeen) {
      for (const m of moments) {
        if (m.source !== "whatsapp" || Date.parse(m.created_at) <= lastSeen) continue;
        const p = byId.get(m.person_id);
        alerts.push({
          key: `whatsapp:${m.id}`,
          title: `🆕 ${p?.name ?? "Someone"} mentioned: ${m.title}`,
          body: m.detail ?? "iKare will remind you to follow up.",
          url: p ? `/people/${p.id}` : "/",
        });
      }
    }
    try {
      if (newest > lastSeen) localStorage.setItem(LAST_SEEN_KEY, String(newest || Date.now()));
    } catch {}
  }

  if (individual && s.kinds.due) {
    for (const m of due) {
      const p = byId.get(m.person_id);
      alerts.push({
        key: `due:${m.id}:${realDay}`,
        title: `${emojiFor(m)} ${momentHeadline(m, p?.name ?? "them")}`,
        body: `${m.detail ? `${m.detail} ` : ""}Tap to send: “${m.suggested_message}”`,
        url: p ? `/people/${p.id}` : "/",
      });
    }
  }

  if (individual && s.kinds.drift) {
    for (const p of drifting) {
      const where = p.timezone ? ` It's ${localTimeLabel(p.timezone)} in ${cityName(p.timezone)}.` : "";
      alerts.push({
        key: `drift:${p.id}:${realDay}`,
        title: `🌱 You haven't talked to ${p.name} in ${quiet(p)} days`,
        body: `Say hi?${where}`,
        url: `/people/${p.id}`,
      });
    }
  }

  // Someone abroad just woke up and has something waiting.
  if (s.kinds.morning) {
    const viewerOffset = tzOffsetMinutes(viewerTimezone());
    for (const p of people) {
      if (!p.timezone || tzOffsetMinutes(p.timezone) === viewerOffset) continue;
      const hasReason = due.some((m) => m.person_id === p.id) || drifting.includes(p);
      const hour = Number(new Date().toLocaleString("en-US", { timeZone: p.timezone, hour: "numeric", hour12: false }));
      if (!hasReason || textWindow(p.timezone) !== "good" || hour !== 9) continue;
      alerts.push({
        key: `morning:${p.id}:${localDateStr(p.timezone)}`,
        title: `🌅 It's ${localTimeLabel(p.timezone)} in ${cityName(p.timezone)}`,
        body: `Good time to message ${p.name}. They're just starting their day.`,
        url: `/people/${p.id}`,
      });
    }
  }

  // One daily summary at the chosen time.
  if (s.kinds.digest) {
    const [hh, mm] = s.digestTime.split(":").map(Number);
    const now = new Date();
    const pastDigest = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
    const names = [...new Set([...due.map((m) => byId.get(m.person_id)?.name), ...drifting.map((p) => p.name)])].filter(
      Boolean,
    );
    if (pastDigest && names.length) {
      alerts.push({
        key: `digest:${todayStr}`,
        title: `☀️ ${names.length} ${names.length === 1 ? "person" : "people"} to show up for today`,
        body: names.slice(0, 5).join(", ") + (names.length > 5 ? ` and ${names.length - 5} more` : ""),
        url: "/",
      });
    }
  }

  // Favorites first, then the order above.
  const fav = (a: Alert) => (people.find((p) => a.url === `/people/${p.id}`)?.favorite ? 0 : 1);
  return alerts.map((a, i) => ({ a, i })).sort((x, y) => fav(x.a) - fav(y.a) || x.i - y.i).map(({ a }) => a);
}

function emojiFor(m: Moment) {
  return (
    { interview: "💼", exam: "📚", health: "🩺", travel: "✈️", celebration: "🎉", tough_time: "🫂", other: "✨", reply: "💬" }[
      m.category
    ] ?? "✨"
  );
}
