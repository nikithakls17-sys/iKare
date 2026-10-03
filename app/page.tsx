"use client";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MomentCard } from "@/components/moment-card";
import { useToday } from "@/components/today-provider";
import { seedDemo, updateMoment } from "@/lib/store";
import { CATEGORY_META, type Moment } from "@/lib/types";
import { useData } from "@/lib/use-data";

export default function TodayPage() {
  const { today, todayStr, overridden } = useToday();
  const { people, moments, loading, error, refresh, setMoments } = useData();
  const [toast, setToast] = useState<string | null>(null);

  const personById = new Map(people.map((p) => [p.id, p]));
  const pending = moments.filter((m) => m.status === "pending");
  const due = pending.filter((m) => m.followup_date <= todayStr);
  const weekOut = format(addDays(today, 7), "yyyy-MM-dd");
  const upcoming = pending.filter((m) => m.followup_date > todayStr && m.followup_date <= weekOut);
  const dueNames = new Set(due.map((m) => m.person_id));

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  };

  const patch = async (m: Moment, change: Partial<Moment>) => {
    setMoments((all) => all.map((x) => (x.id === m.id ? { ...x, ...change } : x)));
    try {
      await updateMoment(m.id, change);
    } catch {
      flash("Couldn't save that — try again.");
      refresh();
    }
  };

  const markDone = (m: Moment, extra: Partial<Moment> = {}) => {
    patch(m, { ...extra, status: "done", completed_at: new Date().toISOString() });
    flash(`You showed up for ${personById.get(m.person_id)?.name ?? "them"} 💛`);
  };

  return (
    <div>
      <section className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-coral">
          {format(today, "EEEE, MMMM d")}
          {overridden && " · time travel"}
        </p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight">Today</h1>
        {!loading && (
          <p className="mt-1 text-muted">
            {due.length === 0
              ? "You're all caught up."
              : `${dueNames.size} ${dueNames.size === 1 ? "person" : "people"} to show up for today.`}
          </p>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
          {error} — check your Supabase keys and that you ran <code>supabase/schema.sql</code>.
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-paper" />
          ))}
        </div>
      ) : due.length > 0 ? (
        <div className="space-y-4">
          {due.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              person={personById.get(m.person_id)}
              onSent={(message) => markDone(m, { suggested_message: message })}
              onDone={() => markDone(m)}
              onSnooze={() => {
                patch(m, { followup_date: format(addDays(today, 1), "yyyy-MM-dd") });
                flash("Snoozed until tomorrow");
              }}
              onDismiss={() => patch(m, { status: "dismissed" })}
            />
          ))}
        </div>
      ) : (
        <EmptyState hasAny={moments.length > 0 || people.length > 0} onSeed={refresh} />
      )}

      {!loading && upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
            <CalendarDays className="h-4 w-4" /> Coming up
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
            {upcoming.map((m) => {
              const p = personById.get(m.person_id);
              const days = differenceInCalendarDays(parseISO(m.followup_date), today);
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-xl">{p?.emoji ?? "🙂"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p?.name ?? "Someone"} · {m.title}
                    </p>
                    <p className="text-sm text-muted">
                      Check in {days === 1 ? "tomorrow" : `${format(parseISO(m.followup_date), "EEEE")}`}
                    </p>
                  </div>
                  <span className="text-lg">{(CATEGORY_META[m.category] ?? CATEGORY_META.other).emoji}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {toast && (
        <div className="rise fixed inset-x-0 bottom-20 z-30 mx-auto w-fit rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg sm:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny, onSeed }: { hasAny: boolean; onSeed: () => void }) {
  const [seeding, setSeeding] = useState(false);
  return (
    <div className="rise rounded-3xl border border-dashed border-line bg-paper px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-sage text-3xl">🌱</div>
      <h2 className="font-display text-2xl font-bold">
        {hasAny ? "Nothing due today" : "Who's got something coming up?"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        {hasAny
          ? "Enjoy the quiet. When a friend shares something big, drop it in and iCare will remind you to ask."
          : "Drop in a chat screenshot or a quick note — iCare finds the moments worth following up on."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/add"
          className="flex items-center gap-2 rounded-full bg-coral px-5 py-3 font-bold text-white shadow-sm transition hover:bg-coral-dark"
        >
          <Plus className="h-4 w-4" /> Add a moment
        </Link>
        {!hasAny && (
          <button
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              await seedDemo(new Date());
              onSeed();
            }}
            className="flex items-center gap-2 rounded-full border border-line px-5 py-3 font-bold transition hover:bg-peach disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {seeding ? "Loading…" : "Try with sample data"}
          </button>
        )}
      </div>
    </div>
  );
}
