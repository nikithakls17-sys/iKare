import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import type { TableName, Tables } from "@/lib/types";

// Server-side storage for the single demo user.
// Supabase when configured; otherwise a JSON file on disk (local dev only).
// On Vercel without Supabase, mode is "none" and the browser keeps data in localStorage.

export type DbMode = "supabase" | "file" | "none";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const dbMode: DbMode = supabase ? "supabase" : process.env.VERCEL ? "none" : "file";

type FileDb = { [K in TableName]: Tables[K][] };
const FILE = path.join(process.cwd(), ".data", "db.json");
const g = globalThis as unknown as { __icareDb?: FileDb };

function fileDb(): FileDb {
  if (!g.__icareDb) {
    try {
      g.__icareDb = { people: [], moments: [], outbox: [], ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch {
      g.__icareDb = { people: [], moments: [], outbox: [] };
    }
  }
  return g.__icareDb!;
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(g.__icareDb, null, 2));
}

function requireMode() {
  if (dbMode === "none") throw new Error("No server database configured");
}

export async function list<T extends TableName>(table: T): Promise<Tables[T][]> {
  requireMode();
  if (supabase) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;
    return data as Tables[T][];
  }
  return [...fileDb()[table]] as Tables[T][];
}

export async function insert<T extends TableName>(
  table: T,
  rows: Omit<Tables[T], "id" | "created_at">[],
): Promise<Tables[T][]> {
  requireMode();
  if (rows.length === 0) return [];
  if (supabase) {
    const { data, error } = await supabase.from(table).insert(rows as never).select();
    if (error) throw error;
    return data as Tables[T][];
  }
  const created = rows.map(
    (r) => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }) as Tables[T],
  );
  (fileDb()[table] as Tables[T][]).push(...created);
  persist();
  return created;
}

export async function update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
  requireMode();
  if (supabase) {
    const { error } = await supabase.from(table).update(patch as never).eq("id", id);
    if (error) throw error;
    return;
  }
  const rows = fileDb()[table] as Tables[T][];
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows[i] = { ...rows[i], ...patch };
  persist();
}

export async function remove(table: TableName, id: string) {
  requireMode();
  if (supabase) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const db = fileDb();
  (db[table] as { id: string }[]) = (db[table] as { id: string }[]).filter((r) => r.id !== id);
  if (table === "people") {
    db.moments = db.moments.filter((m) => m.person_id !== id);
    db.outbox = db.outbox.filter((o) => o.person_id !== id);
  }
  persist();
}

export async function clearAll() {
  requireMode();
  if (supabase) {
    // moments and outbox cascade from people
    const { error } = await supabase.from("people").delete().not("id", "is", null);
    if (error) throw error;
    return;
  }
  g.__icareDb = { people: [], moments: [], outbox: [] };
  persist();
}

export async function get<T extends TableName>(table: T, id: string): Promise<Tables[T] | undefined> {
  return (await list(table)).find((r) => r.id === id);
}
