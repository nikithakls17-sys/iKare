"use client";

import { addDays, format } from "date-fns";
import { supabase } from "./supabase";
import type { Moment, Person } from "./types";

// Data access for the single demo user. Uses Supabase when configured,
// otherwise falls back to localStorage so the app always works.

export const usingSupabase = Boolean(supabase);

type NewPerson = Pick<Person, "name"> & Partial<Omit<Person, "id" | "created_at">>;
type NewMoment = Omit<Moment, "id" | "created_at" | "completed_at" | "status"> &
  Partial<Pick<Moment, "status" | "completed_at">>;

const PEOPLE_KEY = "icare.people";
const MOMENTS_KEY = "icare.moments";

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // storage unavailable (private mode) - nothing to do
  }
}

const now = () => new Date().toISOString();

export async function listPeople(): Promise<Person[]> {
  if (supabase) {
    const { data, error } = await supabase.from("people").select("*").order("name");
    if (error) throw error;
    return data as Person[];
  }
  return readLocal<Person>(PEOPLE_KEY).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMoments(): Promise<Moment[]> {
  if (supabase) {
    const { data, error } = await supabase.from("moments").select("*").order("followup_date");
    if (error) throw error;
    return data as Moment[];
  }
  return readLocal<Moment>(MOMENTS_KEY).sort((a, b) => a.followup_date.localeCompare(b.followup_date));
}

export async function createPerson(p: NewPerson): Promise<Person> {
  const row = {
    name: p.name.trim(),
    phone: p.phone?.trim() || null,
    relationship: p.relationship?.trim() || null,
    emoji: p.emoji || "🙂",
  };
  if (supabase) {
    const { data, error } = await supabase.from("people").insert(row).select().single();
    if (error) throw error;
    return data as Person;
  }
  const person: Person = { ...row, id: crypto.randomUUID(), created_at: now() };
  writeLocal(PEOPLE_KEY, [...readLocal<Person>(PEOPLE_KEY), person]);
  return person;
}

export async function updatePerson(id: string, patch: Partial<Person>) {
  if (supabase) {
    const { error } = await supabase.from("people").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  writeLocal(
    PEOPLE_KEY,
    readLocal<Person>(PEOPLE_KEY).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

export async function deletePerson(id: string) {
  if (supabase) {
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  writeLocal(PEOPLE_KEY, readLocal<Person>(PEOPLE_KEY).filter((p) => p.id !== id));
  writeLocal(MOMENTS_KEY, readLocal<Moment>(MOMENTS_KEY).filter((m) => m.person_id !== id));
}

export async function createMoments(rows: NewMoment[]) {
  const full = rows.map((r) => ({ status: "pending" as const, completed_at: null, ...r }));
  if (supabase) {
    const { error } = await supabase.from("moments").insert(full);
    if (error) throw error;
    return;
  }
  const created: Moment[] = full.map((r) => ({ ...r, id: crypto.randomUUID(), created_at: now() }));
  writeLocal(MOMENTS_KEY, [...readLocal<Moment>(MOMENTS_KEY), ...created]);
}

export async function updateMoment(id: string, patch: Partial<Moment>) {
  if (supabase) {
    const { error } = await supabase.from("moments").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  writeLocal(
    MOMENTS_KEY,
    readLocal<Moment>(MOMENTS_KEY).map((m) => (m.id === id ? { ...m, ...patch } : m)),
  );
}

export async function clearAll() {
  if (supabase) {
    // cascades to moments
    const { error } = await supabase.from("people").delete().not("id", "is", null);
    if (error) throw error;
    return;
  }
  writeLocal(PEOPLE_KEY, []);
  writeLocal(MOMENTS_KEY, []);
}

/** Replace everything with realistic demo data, dated relative to `today`. */
export async function seedDemo(today: Date) {
  await clearAll();
  const d = (n: number) => format(addDays(today, n), "yyyy-MM-dd");

  const [priya, mom, sam, arjun, leah] = await Promise.all([
    createPerson({ name: "Priya", relationship: "best friend", emoji: "🌻", phone: "" }),
    createPerson({ name: "Mom", relationship: "mom", emoji: "💛", phone: "" }),
    createPerson({ name: "Sam", relationship: "brother", emoji: "🚗", phone: "" }),
    createPerson({ name: "Arjun", relationship: "college friend", emoji: "🎸", phone: "" }),
    createPerson({ name: "Leah", relationship: "coworker", emoji: "🌿", phone: "" }),
  ]);

  const doneAt = (n: number) => new Date(addDays(today, n)).toISOString();

  await createMoments([
    // due today
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
      detail: "Leah moved into her new place yesterday.",
      category: "celebration",
      event_date: d(-1),
      followup_date: d(0),
      suggested_message: "How's the new place?! Hope the move wasn't too brutal 🏡",
      source: "screenshot",
    },
    // coming up
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
    // history: show-ups for the People page
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
