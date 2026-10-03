"use client";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays, Moon, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWhatsApp } from "@/components/live";
import { momentChip, momentHeadline, ShowUpCard, type SendResult } from "@/components/moment-card";
import { useToday } from "@/components/today-provider";
import { seedDemo, updateMoment, updateOutbox, updatePerson } from "@/lib/store";
import { cityName, localTimeLabel } from "@/lib/tz";
import { CATEGORY_META, type Moment, type Person } from "@/lib/types";
import { useData } from "@/lib/use-data";

const HIDDEN_NUDGES_KEY = "icare.hiddenNudges";

export default function TodayPage() {
  const { today, todayStr, overridden } = useToday();
  const { people, moments, outbox, loading, error, refresh, setMoments } = useData();
  const wa = useWhatsApp();
  const waLive = wa?.status === "ready";
  const [toast, setToast] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hiddenNudges, setHiddenNudges] = useState<string[]>([]);
  const requested = useRef(new Set<string>());

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference
      setHiddenNudges(JSON.parse(localStorage.getItem(HIDDEN_NUDGES_KEY) ?? "[]"));
    } catch {}
  }, []);

  const personById = new Map(people.map((p) => [p.id, p]));
  const pending = moments.filter((m) => m.status === "pending");
  const due = pending.filter((m) => m.followup_date <= todayStr);
  const weekOut = format(addDays(today, 7), "yyyy-MM-dd");
  const upcoming = pending.filter((m) => m.followup_date > todayStr && m.followup_date <= weekOut);
  const scheduled = outbox.filter((o) => o.status === "scheduled");

  const daysQuiet = (p: Person) =>
    p.last_contact_at ? differenceInCalendarDays(today, parseISO(p.last_contact_at)) : null;
  const drifting = people.filter((p) => {
    const quiet = daysQuiet(p);
    return (
      quiet !== null &&
      quiet > p.contact_every_days &&
      !hiddenNudges.includes(`${p.id}:${todayStr}`) &&
      !due.some((m) => m.person_id === p.id) &&
      !scheduled.some((o) => o.person_id === p.id)
    );
  });

  // Ask the AI for a reconnect draft once per drifting person.
  useEffect(() => {
    for (const p of drifting) {
      if (requested.current.has(p.id)) continue;
      requested.current.add(p.id);
      fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          relationship: p.relationship,
          daysSince: daysQuiet(p),
          timezone: p.timezone,
          recent: moments.filter((m) => m.person_id === p.id).map((m) => m.detail ?? m.title),
        }),
      })
        .then((r) => r.json())
        .then((j) => setDrafts((d) => ({ ...d, [p.id]: j.message })))
        .catch(() => setDrafts((d) => ({ ...d, [p.id]: `Hey ${p.name}! It's been too long, how are you? 💛` })));
    }
  });

  const peopleToday = new Set([...due.map((m) => m.person_id), ...drifting.map((p) => p.id)]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  const patch = async (m: Moment, change: Partial<Moment>) => {
    setMoments((all) => all.map((x) => (x.id === m.id ? { ...x, ...change } : x)));
    try {
      await updateMoment(m.id, change);
    } catch {
      flash("Couldn't save that, try again.");
      refresh();
    }
  };

  const markDone = (m: Moment, extra: Partial<Moment> = {}) => {
    patch(m, { ...extra, status: "done", completed_at: new Date().toISOString() });
    flash(`You showed up for ${personById.get(m.person_id)?.name ?? "them"} 💛`);
  };

  const send = async (person: Person | undefined, text: string, when: "auto" | "now", momentId?: string) => {
    if (!person) return { status: "unavailable" } as SendResult;
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: person.id, momentId, text, when }),
    });
    const json = (await res.json()) as SendResult;
    if (json.status === "sent") flash(`Sent to ${person.name} on WhatsApp 💛`);
    if (json.status === "scheduled")
      flash(`It's ${json.theirTimeNow} for ${person.name}. Sending at ${json.theirTimeAtSend} their time 🌙`);
    if (json.status === "sent" || json.status === "scheduled") refresh();
    return json;
  };

  const hideNudge = (p: Person) => {
    const next = [...hiddenNudges, `${p.id}:${todayStr}`];
    setHiddenNudges(next);
    try {
      localStorage.setItem(HIDDEN_NUDGES_KEY, JSON.stringify(next));
    } catch {}
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
            {peopleToday.size === 0
              ? "You're all caught up."
              : `${peopleToday.size} ${peopleToday.size === 1 ? "person" : "people"} to show up for today.`}
          </p>
        )}
      </section>

      {error && <p className="mb-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-paper" />
          ))}
        </div>
      ) : due.length + drifting.length > 0 ? (
        <div className="space-y-4">
          {due.map((m) => {
            const person = personById.get(m.person_id);
            return (
              <ShowUpCard
                key={m.id}
                person={person}
                headline={momentHeadline(m, person?.name ?? "them")}
                chip={momentChip(m)}
                detail={m.detail}
                message={m.suggested_message}
                waLive={waLive}
                onApprove={(text, when) => send(person, text, when, m.id)}
                onFallbackSent={(text) => {
                  markDone(m, { suggested_message: text });
                  if (person) updatePerson(person.id, { last_contact_at: new Date().toISOString() });
                }}
                onDone={() => markDone(m)}
                onSnooze={() => {
                  patch(m, { followup_date: format(addDays(today, 1), "yyyy-MM-dd") });
                  flash("Snoozed until tomorrow");
                }}
                onDismiss={() => patch(m, { status: "dismissed" })}
              />
            );
          })}

          {drifting.map((p) => {
            const quiet = daysQuiet(p) ?? 0;
            return (
              <ShowUpCard
                key={`drift-${p.id}`}
                person={p}
                headline={`It's been ${quiet} days since you talked to ${p.name}`}
                chip={{ emoji: "🌱", label: "Reconnect", tint: "bg-sage text-emerald-900" }}
                detail={p.relationship ? `Your ${p.relationship}${p.timezone ? ` in ${cityName(p.timezone)}` : ""}.` : null}
                message={drafts[p.id] ?? ""}
                messageLoading={!drafts[p.id]}
                waLive={waLive}
                onApprove={(text, when) => send(p, text, when)}
                onFallbackSent={() => {
                  updatePerson(p.id, { last_contact_at: new Date().toISOString() }).then(refresh);
                  flash(`You reached out to ${p.name} 💛`);
                }}
                onDismiss={() => hideNudge(p)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState hasAny={moments.length > 0 || people.length > 0} onSeed={refresh} />
      )}

      {!loading && scheduled.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
            <Moon className="h-4 w-4" /> Waiting for their morning
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
            {scheduled.map((o) => {
              const p = personById.get(o.person_id);
              const at = new Date(o.send_at);
              return (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-xl">{p?.emoji ?? "🙂"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">To {p?.name ?? "someone"}: “{o.text}”</p>
                    <p className="text-sm text-muted">
                      Sends {p?.timezone ? `${localTimeLabel(p.timezone, at)} in ${cityName(p.timezone)} · ` : ""}
                      {at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} your time
                    </p>
                  </div>
                  <button
                    onClick={() => updateOutbox(o.id, { status: "cancelled" }).then(refresh)}
                    aria-label="Cancel scheduled message"
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-peach"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
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
                      Check in {days === 1 ? "tomorrow" : format(parseISO(m.followup_date), "EEEE")}
                      {m.source === "whatsapp" && " · spotted on WhatsApp"}
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
        <div className="rise fixed inset-x-4 bottom-20 z-30 mx-auto w-fit max-w-md rounded-2xl bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-lg sm:bottom-8">
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
          ? "Enjoy the quiet. When a friend shares something big, iCare will remind you to ask."
          : "Link WhatsApp, drop in a chat screenshot, or write a quick note. iCare finds the moments worth following up on."}
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
