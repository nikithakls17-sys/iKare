"use client";

// Browser notifications for iKare. Runs while the app is open or installed and
// recently used. (Push while fully closed needs the deployed https version.)

export type NotifyKind = "due" | "drift" | "whatsapp" | "morning" | "digest";

export type NotifySettings = {
  enabled: boolean;
  kinds: Record<NotifyKind, boolean>;
  digestTime: string; // "HH:mm" in the viewer's time zone
  style: "each" | "digest"; // individual alerts, or only the daily summary (+ live WhatsApp)
};

export const DEFAULT_SETTINGS: NotifySettings = {
  enabled: false,
  kinds: { due: true, drift: true, whatsapp: true, morning: true, digest: true },
  digestTime: "09:00",
  style: "each",
};

export const KIND_LABELS: Record<NotifyKind, { title: string; example: string }> = {
  due: { title: "Check-ins due", example: "💼 Ask Priya how the interview went" },
  drift: { title: "Drifting apart", example: "🌱 You haven't talked to Kenji in 34 days" },
  whatsapp: { title: "New from WhatsApp", example: "🆕 Lavanya mentioned a health update" },
  morning: { title: "Their morning", example: "🌅 It's 9 AM in London, a good time to message Priya" },
  digest: { title: "Daily summary", example: "☀️ 3 people to show up for today" },
};

const SETTINGS_KEY = "icare.notify";
const SENT_KEY = "icare.notified";

export function loadSettings(): NotifySettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (raw) return { ...DEFAULT_SETTINGS, ...raw, kinds: { ...DEFAULT_SETTINGS.kinds, ...raw.kinds } };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: NotifySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new Event("icare:notify-settings"));
}

export function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permission(): NotificationPermission | "unsupported" {
  return supported() ? Notification.permission : "unsupported";
}

export async function requestPermission() {
  if (!supported()) return "unsupported" as const;
  return Notification.requestPermission();
}

// ---- de-duplication: remember what we've already shown ----
function sentMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function alreadySent(key: string) {
  return key in sentMap();
}

export function markSent(key: string) {
  const map = sentMap();
  map[key] = Date.now();
  // keep the last ~300 entries
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 300);
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function clearSent() {
  try {
    localStorage.removeItem(SENT_KEY);
  } catch {}
}

export async function showNotification(title: string, body: string, url = "/", tag?: string) {
  if (permission() !== "granted") return false;
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-any-192.png",
    badge: "/icons/icon-any-192.png",
    tag,
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {}
  const n = new Notification(title, options);
  n.onclick = () => {
    window.focus();
    window.location.href = url;
  };
  return true;
}
