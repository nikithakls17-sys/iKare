"use client";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatedBackground } from "@/components/core/animated-background";
import { EmptyArt, GeoRule, PageBanner } from "@/components/geo";
import { FavoritesToggle, useFavoritesOnly } from "@/components/favorites";
import { useWhatsApp } from "@/components/live";
import { NotifyBanner } from "@/components/notify-banner";
import { momentChip, momentHeadline, ShowUpCard, type SendResult } from "@/components/moment-card";
import { useToday } from "@/components/today-provider";
import { seedDemo, updateMoment, updateOutbox, updatePerson } from "@/lib/store";
import { cityName, localTimeLabel } from "@/lib/tz";
import { CATEGORY_META, type Moment, type Person } from "@/lib/types";
import { useData } from "@/lib/use-data";

const HIDDEN_NUDGES_KEY = "icare.hiddenNudges";

export default function TodayPage() {
  const { today, todayStr, overridden } = useToday();
  const data = useData();
  const { loading, error, refresh, setMoments } = data;
  const [favOnly, toggleFav] = useFavoritesOnly();
  const favIds = new Set(data.people.filter((p) => p.favorite).map((p) => p.id));
  const keep = (personId: string) => !favOnly || favIds.has(personId);
  const people = data.people.filter((p) => keep(p.id));
  const moments = data.moments.filter((m) => keep(m.person_id));
  const outbox = data.outbox.filter((o) => keep(o.person_id));
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

  const personById = new Map(data.people.map((p) => [p.id, p]));
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
      <PageBanner
        eyebrow={`${format(today, "EEEE · MMMM d")}${overridden ? " · time travel" : ""}`}
        title="Today"
      >
        {loading
          ? " "
          : peopleToday.size === 0
            ? "You're all caught up."
            : `${peopleToday.size} ${peopleToday.size === 1 ? "person" : "people"} to show up for.`}
      </PageBanner>

      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="eyebrow flex items-center gap-2 text-muted">
          <GeoRule /> Show up today
        </h2>
        <FavoritesToggle on={favOnly} onToggle={toggleFav} count={favIds.size} />
      </div>

      <NotifyBanner />

      {error && <p className="mb-4 bg-ochre-tint p-4 text-sm text-warn">{error}</p>}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse bg-paper" />
          ))}
        </div>
      ) : due.length > 0 ? (
        <div className="-mx-1 space-y-2">
          <AnimatedBackground
            className="bg-brand-ochre/70"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            enableHover
          >
            {due.map((m) => {
              const person = personById.get(m.person_id);
              return (
                <div key={m.id} data-id={m.id} className="block p-1">
                  <ShowUpCard
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
                </div>
              );
            })}
          </AnimatedBackground>
        </div>
      ) : drifting.length > 0 ? (
        <p className="geo-box border border-line bg-paper p-6 text-center text-muted">
          Nothing due today. Maybe say hi to someone below?
        </p>
      ) : favOnly && data.people.length > 0 ? (
        <p className="border border-dashed border-line bg-paper p-8 text-center text-muted">
          {favIds.size === 0
            ? "No favorites yet. Tap the ☆ next to someone on the People page."
            : "Nothing for your favorites today."}
        </p>
      ) : (
        <EmptyState hasAny={data.moments.length > 0 || data.people.length > 0} onSeed={refresh} />
      )}

      {!loading && drifting.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow mb-2 flex items-center gap-2 text-muted">
            <GeoRule /> Reconnect
          </h2>
          <p className="mb-4 font-display text-2xl font-semibold">
            People you haven&apos;t talked to <em className="font-medium">lately</em>
          </p>
          <div className="-mx-1 space-y-2">
            <AnimatedBackground
              className="bg-brand-moss/70"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              enableHover
            >
              {drifting.map((p) => {
                const quiet = daysQuiet(p) ?? 0;
                return (
                  <div key={p.id} data-id={p.id} className="block p-1">
                    <ShowUpCard
                      person={p}
                      headline={`Say hi to ${p.name}`}
                      chip={{ emoji: "🌱", label: `${quiet} days since you talked`, tint: "bg-moss text-ink" }}
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
                  </div>
                );
              })}
            </AnimatedBackground>
          </div>
        </section>
      )}

      {!loading && scheduled.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-4 flex items-center gap-2 text-muted">
            <GeoRule /> Waiting for their morning
          </h2>
          <ul className="geo-box divide-y divide-line border border-line bg-paper">
            {scheduled.map((o) => {
              const p = personById.get(o.person_id);
              const at = new Date(o.send_at);
              return (
                <li key={o.id} className="flex items-center gap-4 px-6 py-4">
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
                    className="grid h-12 w-12 place-items-center rounded-full text-muted hover:bg-tint"
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
          <h2 className="eyebrow mb-4 flex items-center gap-2 text-muted">
            <GeoRule /> Coming up
          </h2>
          <ul className="geo-box divide-y divide-line border border-line bg-paper">
            {upcoming.map((m) => {
              const p = personById.get(m.person_id);
              const days = differenceInCalendarDays(parseISO(m.followup_date), today);
              return (
                <li key={m.id} className="flex items-center gap-4 px-6 py-4">
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
        <div className="rise fixed inset-x-4 bottom-20 z-30 mx-auto w-fit max-w-md bg-strong px-6 py-4 text-center text-sm font-semibold text-white sm:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny, onSeed }: { hasAny: boolean; onSeed: () => void }) {
  const [seeding, setSeeding] = useState(false);
  return (
    <div className="rise geo-box border border-line bg-paper px-6 py-12 text-center">
      <EmptyArt className="mx-auto mb-6" />
      <h2 className="font-display text-3xl font-semibold [&_em]:font-medium">
        {hasAny ? <>Nothing due <em>today</em></> : <>Who&apos;s got something <em>coming up?</em></>}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        {hasAny
          ? "Enjoy the quiet. When a friend shares something big, iKare will remind you to ask."
          : "Link WhatsApp, drop in a chat screenshot, or write a quick note. iKare finds the moments worth following up on."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link
          href="/add"
          className="flex items-center gap-2 bg-accent px-6 py-4 font-bold text-on-accent transition hover:bg-accent-deep"
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
            className="flex items-center gap-2 border border-line px-6 py-4 font-bold transition hover:bg-tint disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {seeding ? "Loading…" : "Try with sample data"}
          </button>
        )}
      </div>
    </div>
  );
}
