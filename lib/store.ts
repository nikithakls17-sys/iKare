"use client";

import { addDays, format, subDays } from "date-fns";
import { guessTimezone } from "./tz";
import type { Moment, OutboxItem, Person, TableName, Tables } from "./types";

// Client data access. Talks to /api/db (Supabase or local file on the server) when
// available, otherwise falls back to localStorage so the deployed demo always works.

type Mode = "server" | "local";
let modePromise: Promise<Mode> | null = null;

export type Snapshot = { people: Person[]; moments: Moment[]; outbox: OutboxItem[] };

async function mode(): Promise<Mode> {
  modePromise ??= fetch("/api/db")
    .then((r) => r.json())
    .then((j) => (j.mode === "none" || j.error ? "local" : "server") as Mode)
    .catch(() => "local" as Mode);
  return modePromise;
}

export async function storageMode() {
  return mode();
}

// ---- localStorage backend ----
const key = (t: TableName) => `icare.${t}`;
function readLocal<T extends TableName>(t: T): Tables[T][] {
  try {
    return JSON.parse(localStorage.getItem(key(t)) ?? "[]");
  } catch {
    return [];
  }
}
function writeLocal<T extends TableName>(t: T, rows: Tables[T][]) {
  try {
    localStorage.setItem(key(t), JSON.stringify(rows));
  } catch {}
}

async function api(body: object) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Save failed");
  return json;
}

async function insertRows<T extends TableName>(
  table: T,
  rows: Omit<Tables[T], "id" | "created_at">[],
): Promise<Tables[T][]> {
  if ((await mode()) === "server") return (await api({ op: "insert", table, rows })).rows;
  const created = rows.map(
    (r) => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }) as Tables[T],
  );
  writeLocal(table, [...readLocal(table), ...created]);
  return created;
}

async function updateRow<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
  if ((await mode()) === "server") return void (await api({ op: "update", table, id, patch }));
  writeLocal(
    table,
    readLocal(table).map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );
}

export async function loadAll(): Promise<Snapshot> {
  if ((await mode()) === "server") {
    const j = await (await fetch("/api/db", { cache: "no-store" })).json();
    if (j.error) throw new Error(j.error);
    return { people: j.people, moments: j.moments, outbox: j.outbox };
  }
  return { people: readLocal("people"), moments: readLocal("moments"), outbox: readLocal("outbox") };
}

// ---- people ----
export type NewPerson = Pick<Person, "name"> & Partial<Omit<Person, "id" | "created_at">>;

export function personRow(p: NewPerson): Omit<Person, "id" | "created_at"> {
  const phone = p.phone?.trim() || null;
  return {
    name: p.name.trim() || "Friend",
    phone,
    relationship: p.relationship?.trim() || null,
    emoji: p.emoji || "🙂",
    timezone: p.timezone || guessTimezone(phone),
    whatsapp_id: p.whatsapp_id ?? null,
    last_contact_at: p.last_contact_at ?? null,
    contact_every_days: p.contact_every_days ?? 14,
    favorite: p.favorite ?? false,
  };
}

export async function createPerson(p: NewPerson): Promise<Person> {
  return (await insertRows("people", [personRow(p)]))[0];
}

export const updatePerson = (id: string, patch: Partial<Person>) => updateRow("people", id, patch);

export async function deletePerson(id: string) {
  if ((await mode()) === "server") return void (await api({ op: "remove", table: "people", id }));
  writeLocal("people", readLocal("people").filter((p) => p.id !== id));
  writeLocal("moments", readLocal("moments").filter((m) => m.person_id !== id));
  writeLocal("outbox", readLocal("outbox").filter((o) => o.person_id !== id));
}

// ---- moments ----
type NewMoment = Omit<Moment, "id" | "created_at" | "completed_at" | "status"> &
  Partial<Pick<Moment, "status" | "completed_at">>;

export async function createMoments(rows: NewMoment[]) {
  await insertRows(
    "moments",
    rows.map((r) => ({ status: "pending" as const, completed_at: null, ...r })),
  );
}

export const updateMoment = (id: string, patch: Partial<Moment>) => updateRow("moments", id, patch);
export const updateOutbox = (id: string, patch: Partial<OutboxItem>) => updateRow("outbox", id, patch);

export async function clearAll() {
  if ((await mode()) === "server") return void (await api({ op: "clear" }));
  (["people", "moments", "outbox"] as const).forEach((t) => writeLocal(t, []));
}

/** Replace everything with realistic demo data, dated relative to `today`. */
export async function seedDemo(today: Date) {
  await clearAll();
  const d = (n: number) => format(addDays(today, n), "yyyy-MM-dd");
  const ago = (n: number) => subDays(new Date(), n).toISOString();

  const [priya, mom, sam, arjun, leah, kenji] = await insertRows("people", [
    personRow({ name: "Priya", relationship: "best friend", emoji: "🌻", timezone: "Europe/London", favorite: true, last_contact_at: ago(2) }),
    personRow({ name: "Mom", relationship: "mom", emoji: "💛", timezone: "Asia/Kolkata", favorite: true, last_contact_at: ago(1), contact_every_days: 3 }),
    personRow({ name: "Sam", relationship: "brother", emoji: "🚗", timezone: "America/Toronto", last_contact_at: ago(6), contact_every_days: 7 }),
    personRow({ name: "Arjun", relationship: "college friend", emoji: "🎸", timezone: "America/Los_Angeles", last_contact_at: ago(4) }),
    personRow({ name: "Leah", relationship: "coworker", emoji: "🌿", timezone: "Australia/Sydney", last_contact_at: ago(3), contact_every_days: 21 }),
    personRow({ name: "Kenji", relationship: "old roommate", emoji: "🍜", timezone: "Asia/Tokyo", favorite: true, last_contact_at: ago(34), contact_every_days: 30 }),
  ]);
  void kenji;

  const doneAt = (n: number) => addDays(today, n).toISOString();

  await createMoments([
    {
      person_id: arjun.id,
      title: "Feeling sick",
      detail: "Arjun said he's had a bad fever since the weekend.",
      category: "health",
      event_date: null,
      followup_date: d(0),
      suggested_message: "Hey, how are you feeling today? Hope the fever's finally easing up 🤒",
      source: "note",
    },
    {
      person_id: leah.id,
      title: "Moving apartments",
      detail: "Leah moved into her new place in Sydney yesterday.",
      category: "celebration",
      event_date: d(-1),
      followup_date: d(0),
      suggested_message: "How's the new place?! Hope the move wasn't too brutal 🏡",
      source: "screenshot",
    },
    {
      person_id: sam.id,
      title: "Driving test",
      detail: "Sam's driving test is coming up.",
      category: "exam",
      event_date: d(2),
      followup_date: d(3),
      suggested_message: "Sooo... are you officially a licensed driver now?? 🚗",
      source: "note",
    },
    {
      person_id: leah.id,
      title: "Half marathon",
      detail: "Leah is running her first half marathon.",
      category: "celebration",
      event_date: d(5),
      followup_date: d(6),
      suggested_message: "You ran a HALF MARATHON?! So proud of you, how are the legs? 🏃‍♀️",
      source: "note",
    },
    ...[-30, -21, -12].map((n, i) => ({
      person_id: priya.id,
      title: ["Exam results", "Sister's wedding", "Apartment hunt"][i],
      detail: null,
      category: (["exam", "celebration", "other"] as const)[i],
      event_date: d(n - 1),
      followup_date: d(n),
      suggested_message: "Thinking of you!",
      source: "note" as const,
      status: "done" as const,
      completed_at: doneAt(n),
    })),
    {
      person_id: mom.id,
      title: "Garden show",
      detail: null,
      category: "celebration",
      event_date: d(-15),
      followup_date: d(-14),
      suggested_message: "How was the garden show?",
      source: "note",
      status: "done",
      completed_at: doneAt(-14),
    },
  ]);
}
