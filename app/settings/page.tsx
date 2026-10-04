"use client";

import { Bell, BellOff, BellRing, Download, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearSent,
  DEFAULT_SETTINGS,
  KIND_LABELS,
  loadSettings,
  permission,
  requestPermission,
  saveSettings,
  showNotification,
  type NotifyKind,
  type NotifySettings,
} from "@/lib/notify";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function SettingsPage() {
  const [s, setS] = useState<NotifySettings>(DEFAULT_SETTINGS);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [installEvt, setInstallEvt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read browser-only state after hydration */
    setS(loadSettings());
    setPerm(permission());
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const update = (next: NotifySettings) => {
    setS(next);
    saveSettings(next);
  };

  const enable = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p === "granted") {
      update({ ...s, enabled: true });
      await showNotification("💛 iKare notifications are on", "We'll nudge you when it's time to show up for someone.", "/");
    } else if (p === "denied") {
      setNote("Notifications are blocked. Allow them in your browser's site settings (the lock icon next to the address).");
    }
  };

  const test = async () => {
    const ok = await showNotification(
      "🌱 You haven't talked to Kenji in 34 days",
      "Say hi? It's 8:29 AM in Tokyo.",
      "/people",
      "test",
    );
    setNote(ok ? "Test sent. Check your notifications." : "Turn notifications on first.");
  };

  const on = s.enabled && perm === "granted";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">Reminders that help you show up, on your laptop or phone.</p>
      </div>

      {/* Notifications */}
      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${on ? "bg-sage text-emerald-700" : "bg-peach text-coral"}`}>
            {on ? <BellRing className="h-5 w-5" /> : perm === "denied" ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Notifications</h2>
            <p className="text-sm text-muted">
              {perm === "unsupported"
                ? "This browser doesn't support notifications. On iPhone, install iKare to your Home Screen first (below)."
                : on
                  ? "On. iKare checks every minute while it's open or installed."
                  : perm === "denied"
                    ? "Blocked in your browser settings."
                    : "Off. Turn on to get nudges like “You haven't talked to Kenji in 34 days”."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {on ? (
            <>
              <button onClick={test} className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-dark">
                Send a test
              </button>
              <button
                onClick={() => {
                  clearSent();
                  setNote("Done. Reminders you've already seen today can show again.");
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-bold hover:bg-peach"
              >
                Replay today&apos;s reminders
              </button>
              <button
                onClick={() => update({ ...s, enabled: false })}
                className="rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-peach"
              >
                Turn off
              </button>
            </>
          ) : (
            perm !== "unsupported" && (
              <button
                onClick={enable}
                className="flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-bold text-white shadow-sm hover:bg-coral-dark"
              >
                <Bell className="h-4 w-4" /> Turn on notifications
              </button>
            )
          )}
        </div>
        {note && <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-sm">{note}</p>}

        <div className={`mt-5 space-y-1 ${on ? "" : "pointer-events-none opacity-50"}`}>
          {(Object.keys(KIND_LABELS) as NotifyKind[]).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 hover:bg-cream">
              <input
                type="checkbox"
                checked={s.kinds[k]}
                onChange={(e) => update({ ...s, kinds: { ...s.kinds, [k]: e.target.checked } })}
                className="h-5 w-5 accent-[var(--coral)]"
              />
              <span className="flex-1">
                <span className="block font-semibold">{KIND_LABELS[k].title}</span>
                <span className="block text-sm text-muted">{KIND_LABELS[k].example}</span>
              </span>
              {k === "digest" && (
                <input
                  type="time"
                  value={s.digestTime}
                  onChange={(e) => update({ ...s, digestTime: e.target.value || "09:00" })}
                  className="rounded-xl border border-line bg-cream px-2 py-1 text-sm"
                />
              )}
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2 px-2 pt-3 text-sm">
            <span className="font-semibold">Style:</span>
            {(
              [
                ["each", "Every reminder"],
                ["digest", "Just the daily summary"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => update({ ...s, style: v })}
                className={`rounded-full px-3 py-1.5 font-bold ${s.style === v ? "bg-strong text-white" : "border border-line hover:bg-peach"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-peach text-coral">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Install the app</h2>
            <p className="text-sm text-muted">
              {installed
                ? "You're using the installed app. 🎉"
                : "Add iKare to your home screen. It opens full-screen like a normal app."}
            </p>
          </div>
        </div>
        {!installed && (
          <div className="mt-4 space-y-3 text-[15px]">
            {installEvt && (
              <button
                onClick={async () => {
                  await installEvt.prompt();
                  setInstallEvt(null);
                }}
                className="flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-bold text-white hover:bg-coral-dark"
              >
                <Download className="h-4 w-4" /> Install iKare
              </button>
            )}
            <div className={`rounded-2xl bg-cream p-4 ${isIOS ? "ring-2 ring-coral/40" : ""}`}>
              <p className="font-bold">iPhone / iPad (Safari)</p>
              <p className="text-muted">
                Tap <Share className="inline h-4 w-4" /> <b>Share</b> → <b>Add to Home Screen</b>. Then open iKare from the
                home screen and turn on notifications here (iOS 16.4+).
              </p>
            </div>
            <div className="rounded-2xl bg-cream p-4">
              <p className="font-bold">Android (Chrome) or laptop (Chrome / Edge)</p>
              <p className="text-muted">
                Tap the <b>⋮</b> menu → <b>Install app</b> (or the install icon in the address bar).
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
