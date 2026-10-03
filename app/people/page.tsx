"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createPerson, deletePerson, updatePerson } from "@/lib/store";
import type { Person } from "@/lib/types";
import { useData } from "@/lib/use-data";

const EMOJIS = ["🙂", "🌻", "💛", "🚗", "🎸", "🌿", "🐶", "☕", "🌙", "🔥", "🎨", "⚽"];

type Form = { name: string; phone: string; relationship: string; emoji: string };
const EMPTY: Form = { name: "", phone: "", relationship: "", emoji: "🙂" };

export default function PeoplePage() {
  const { people, moments, loading, refresh } = useData();
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const stats = (id: string) => ({
    pending: moments.filter((m) => m.person_id === id && m.status === "pending").length,
    showedUp: moments.filter((m) => m.person_id === id && m.status === "done").length,
  });
  const totalShowUps = moments.filter((m) => m.status === "done").length;

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

      <div className="mt-6 space-y-3">
        {editing === "new" && (
          <PersonForm
            initial={EMPTY}
            onCancel={() => setEditing(null)}
            onSave={async (f) => {
              await createPerson(f);
              setEditing(null);
              refresh();
            }}
          />
        )}

        {loading &&
          [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-paper" />)}

        {!loading && people.length === 0 && editing !== "new" && (
          <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">
            No one here yet. People are added automatically when you save moments.
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
              }}
              onCancel={() => setEditing(null)}
              onDelete={async () => {
                await deletePerson(p.id);
                setEditing(null);
                refresh();
              }}
              onSave={async (f) => {
                await updatePerson(p.id, {
                  name: f.name.trim(),
                  phone: f.phone.trim() || null,
                  relationship: f.relationship.trim() || null,
                  emoji: f.emoji,
                });
                setEditing(null);
                refresh();
              }}
            />
          ) : (
            <PersonRow key={p.id} person={p} {...stats(p.id)} onEdit={() => setEditing(p.id)} />
          ),
        )}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  pending,
  showedUp,
  onEdit,
}: {
  person: Person;
  pending: number;
  showedUp: number;
  onEdit: () => void;
}) {
  return (
    <div className="rise flex items-center gap-4 rounded-3xl border border-line bg-paper p-4">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-peach text-3xl">{person.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{person.name}</p>
        <p className="text-sm text-muted">
          {person.relationship ?? "—"}
          {pending > 0 && ` · ${pending} coming up`}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl font-bold text-coral">{showedUp}</p>
        <p className="text-xs font-semibold text-muted">showed up</p>
      </div>
      <button
        onClick={onEdit}
        aria-label={`Edit ${person.name}`}
        className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-peach hover:text-ink"
      >
        <Pencil className="h-4 w-4" />
      </button>
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
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          placeholder="Phone w/ country code"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
          className={input}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Phone is optional. Include the country code (e.g. 91 98765 43210) so WhatsApp opens the right chat.
      </p>
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
