"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { FavoritesToggle, StarButton, useFavoritesOnly } from "@/components/favorites";
import { LocalTime, useNow } from "@/components/live";
import { createPerson, deletePerson, updatePerson } from "@/lib/store";
import { allTimezones, cityName, guessTimezone, localTimeLabel, offsetLabel, textWindow } from "@/lib/tz";
import type { Person } from "@/lib/types";
import { useData } from "@/lib/use-data";

const EMOJIS = ["🙂", "🌻", "💛", "🚗", "🎸", "🌿", "🍜", "🐶", "☕", "🌙", "🔥", "🎨", "⚽"];

type Form = {
  name: string;
  phone: string;
  relationship: string;
  emoji: string;
  timezone: string;
  contact_every_days: number;
};
const EMPTY: Form = { name: "", phone: "", relationship: "", emoji: "🙂", timezone: "", contact_every_days: 14 };

export default function PeoplePage() {
  const { people: everyone, moments, loading, refresh } = useData();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [favOnly, toggleFav] = useFavoritesOnly();
  const favCount = everyone.filter((p) => p.favorite).length;
  const people = everyone
    .filter((p) => !favOnly || p.favorite)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  const stats = (id: string) => ({
    pending: moments.filter((m) => m.person_id === id && m.status === "pending").length,
    showedUp: moments.filter((m) => m.person_id === id && m.status === "done").length,
  });
  const totalShowUps = moments.filter((m) => m.status === "done").length;

  const toPatch = (f: Form): Partial<Person> => ({
    name: f.name.trim(),
    phone: f.phone.trim() || null,
    relationship: f.relationship.trim() || null,
    emoji: f.emoji,
    timezone: f.timezone || guessTimezone(f.phone) || null,
    contact_every_days: Math.max(1, Number(f.contact_every_days) || 14),
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">People</h1>
          <p className="mt-1 text-muted">
            {totalShowUps > 0
              ? `You've shown up ${totalShowUps} time${totalShowUps === 1 ? "" : "s"}. Keep it going.`
              : "The people you want to be there for."}
          </p>
        </div>
        {editing !== "new" && (
          <button
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-coral-dark"
          >
            <Plus className="h-4 w-4" /> Add person
          </button>
        )}
      </div>

      <div className="mt-4">
        <FavoritesToggle on={favOnly} onToggle={toggleFav} count={favCount} />
      </div>

      <WorldClock people={people} />

      <div className="mt-6 space-y-3">
        {editing === "new" && (
          <PersonForm
            initial={EMPTY}
            onCancel={() => setEditing(null)}
            onSave={async (f) => {
              await createPerson({ ...toPatch(f), name: f.name });
              setEditing(null);
              refresh();
            }}
          />
        )}

        {loading && [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-paper" />)}

        {!loading && people.length === 0 && editing !== "new" && (
          <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">
            No one here yet. People are added automatically from WhatsApp or when you save moments.
          </p>
        )}

        {people.map((p) =>
          editing === p.id ? (
            <PersonForm
              key={p.id}
              initial={{
                name: p.name,
                phone: p.phone ?? "",
                relationship: p.relationship ?? "",
                emoji: p.emoji,
                timezone: p.timezone ?? "",
                contact_every_days: p.contact_every_days ?? 14,
              }}
              onCancel={() => setEditing(null)}
              onDelete={async () => {
                await deletePerson(p.id);
                setEditing(null);
                refresh();
              }}
              onSave={async (f) => {
                await updatePerson(p.id, toPatch(f));
                setEditing(null);
                refresh();
              }}
            />
          ) : (
            <PersonRow
              key={p.id}
              person={p}
              {...stats(p.id)}
              onEdit={() => setEditing(p.id)}
              onStar={() => updatePerson(p.id, { favorite: !p.favorite }).then(refresh)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function WorldClock({ people }: { people: Person[] }) {
  const now = useNow();
  const zones = useMemo(() => {
    const byZone = new Map<string, Person[]>();
    for (const p of people) if (p.timezone) byZone.set(p.timezone, [...(byZone.get(p.timezone) ?? []), p]);
    return [...byZone.entries()];
  }, [people]);
  if (zones.length < 2) return null;
  const dot = { good: "bg-emerald-400", late: "bg-amber-400", sleeping: "bg-indigo-400" };
  return (
    <div className="mt-6 -mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {zones.map(([tz, ps]) => (
          <div key={tz} className="min-w-[8.5rem] shrink-0 rounded-2xl bg-strong px-4 py-3 text-white">
            <div className="flex items-center gap-1.5 text-xs opacity-70">
              <span className={`h-2 w-2 rounded-full ${dot[textWindow(tz, now)]}`} />
              {cityName(tz)}
            </div>
            <div className="font-display text-2xl font-bold">{localTimeLabel(tz, now)}</div>
            <div className="truncate text-xs opacity-80">
              {ps.map((p) => p.emoji).join(" ")} {ps.map((p) => p.name).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  pending,
  showedUp,
  onEdit,
  onStar,
}: {
  person: Person;
  pending: number;
  showedUp: number;
  onEdit: () => void;
  onStar: () => void;
}) {
  return (
    <div className="rise flex items-center gap-3 rounded-3xl border border-line bg-paper p-4 transition hover:border-coral/50">
      <Link href={`/people/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach text-2xl">{person.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">
          {person.name}
          {person.whatsapp_id && <span className="ml-1.5 text-xs font-semibold text-emerald-600">● WhatsApp</span>}
        </p>
        <p className="text-sm text-muted">
          {person.relationship ?? "Contact"}
          {person.last_contact_at && ` · talked ${formatDistanceToNowStrict(parseISO(person.last_contact_at))} ago`}
          {pending > 0 && ` · ${pending} coming up`}
        </p>
        {person.timezone && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <LocalTime tz={person.timezone} compact />
            <span className="hidden text-xs text-muted sm:inline">{offsetLabel(person.timezone)}</span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-2xl font-bold leading-none text-coral">{showedUp}</p>
        <p className="mt-1 text-xs font-semibold text-muted">showed up</p>
      </div>
      </Link>
      <div className="flex shrink-0 flex-col">
        <StarButton on={person.favorite} onClick={onStar} name={person.name} />
        <button
          onClick={onEdit}
          aria-label={`Edit ${person.name}`}
          className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-peach hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PersonForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Form;
  onSave: (f: Form) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => allTimezones(), []);
  const guessed = guessTimezone(f.phone);
  const input = "w-full rounded-xl border border-line bg-cream px-3 py-2 outline-none focus:border-coral";

  return (
    <form
      className="rise rounded-3xl border-2 border-coral/40 bg-paper p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return;
        setBusy(true);
        try {
          await onSave(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button
            type="button"
            key={e}
            onClick={() => setF({ ...f, emoji: e })}
            className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition ${
              f.emoji === e ? "bg-peach ring-2 ring-coral" : "hover:bg-cream"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          autoFocus
          required
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className={input}
        />
        <input
          placeholder="Relationship (friend, mom…)"
          value={f.relationship}
          onChange={(e) => setF({ ...f, relationship: e.target.value })}
          className={input}
        />
        <input
          type="tel"
          placeholder="Phone with country code, e.g. +44 7911 123456"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
          className={input}
        />
        <select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} className={input}>
          <option value="">
            {guessed ? `Auto: ${cityName(guessed)} (from phone)` : "Time zone (auto from phone)"}
          </option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
          Nudge me if we haven&apos;t talked in
          <input
            type="number"
            min={1}
            value={f.contact_every_days}
            onChange={(e) => setF({ ...f, contact_every_days: Number(e.target.value) })}
            className="w-20 rounded-xl border border-line bg-cream px-3 py-1.5 text-ink outline-none focus:border-coral"
          />
          days
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={busy}
          className="rounded-full bg-coral px-5 py-2.5 font-bold text-white hover:bg-coral-dark disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 font-bold hover:bg-peach">
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
    </form>
  );
}
