import { getCountry } from "countries-and-timezones";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Time zone helpers shared by client and server.

// Countries with several zones: pick the one most people live in.
const PRIMARY_ZONE: Record<string, string> = {
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  RU: "Europe/Moscow",
  ID: "Asia/Jakarta",
  CN: "Asia/Shanghai",
  DE: "Europe/Berlin",
  GB: "Europe/London",
  GG: "Europe/London",
  JE: "Europe/London",
  IM: "Europe/London",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  NZ: "Pacific/Auckland",
  AR: "America/Argentina/Buenos_Aires",
  KZ: "Asia/Almaty",
};

/** Guess an IANA zone from a phone number with country code (digits or +digits). */
export function guessTimezone(phone?: string | null): string | null {
  const digits = phone?.replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  const parsed = parsePhoneNumberFromString(`+${digits}`);
  const country = parsed?.country;
  if (!country) return null;
  return PRIMARY_ZONE[country] ?? getCountry(country)?.timezones[0] ?? null;
}

export function countryFlag(phone?: string | null): string {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return "";
  const country = parsePhoneNumberFromString(`+${digits}`)?.country;
  if (!country) return "";
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function viewerTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Minutes east of UTC for `tz` at `date`. */
export function tzOffsetMinutes(tz: string, date = new Date()): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -mins : mins;
}

function localParts(tz: string, date: Date) {
  const shifted = new Date(date.getTime() + tzOffsetMinutes(tz, date) * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
  };
}

export function localDateStr(tz: string, date = new Date()): string {
  const p = localParts(tz, date);
  return `${p.y}-${String(p.mo + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function localTimeLabel(tz: string, date = new Date()): string {
  return date.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

export function cityName(tz: string): string {
  return tz.split("/").pop()!.replace(/_/g, " ");
}

export type TextWindow = "good" | "late" | "sleeping";
export const GOOD_START = 9;
export const GOOD_END = 21;

export function textWindow(tz: string, date = new Date()): TextWindow {
  const { h } = localParts(tz, date);
  if (h >= GOOD_START && h < GOOD_END) return "good";
  if (h >= 8 && h < 23) return "late";
  return "sleeping";
}

/** `date` if it's a good time to text in `tz`, otherwise the next 9:00 AM there. */
export function nextGoodTime(tz: string, date = new Date()): Date {
  if (textWindow(tz, date) === "good") return date;
  const p = localParts(tz, date);
  const dayOffset = p.h >= GOOD_END ? 1 : 0;
  // 9:00 local on the target day, converted back to UTC
  const localNine = Date.UTC(p.y, p.mo, p.d + dayOffset, GOOD_START, 0);
  const guess = new Date(localNine - tzOffsetMinutes(tz, date) * 60_000);
  return new Date(localNine - tzOffsetMinutes(tz, guess) * 60_000);
}

/** The next 9:00 AM in tz strictly after date (today if it is still early there, else tomorrow). */
export function nextMorning(tz: string, date = new Date()): Date {
  const p = localParts(tz, date);
  const dayOffset = p.h < GOOD_START ? 0 : 1;
  const localNine = Date.UTC(p.y, p.mo, p.d + dayOffset, GOOD_START, 0);
  const guess = new Date(localNine - tzOffsetMinutes(tz, date) * 60_000);
  return new Date(localNine - tzOffsetMinutes(tz, guess) * 60_000);
}

/** "3h ahead", "9h 30m behind", "same time" relative to the viewer. */
export function offsetLabel(tz: string, date = new Date()): string {
  const diff = tzOffsetMinutes(tz, date) - tzOffsetMinutes(viewerTimezone(), date);
  if (diff === 0) return "same time as you";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h ? `${h}h` : ""}${m ? ` ${m}m` : ""} ${diff > 0 ? "ahead" : "behind"}`.trim();
}

export function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}
