"use client";

import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, MessageCircle, Send, Sparkles, Sunrise } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { StarButton } from "@/components/favorites";
import { LocalTime, useNow, useWhatsApp } from "@/components/live";
import { useToday } from "@/components/today-provider";
import { whatsappLink } from "@/lib/links";
import { createMoments, updateMoment, updatePerson } from "@/lib/store";
import { cityName, localDateStr, localTimeLabel, nextMorning, offsetLabel, textWindow, viewerTimezone } from "@/lib/tz";
import { CATEGORY_META, type Moment } from "@/lib/types";
import { useData } from "@/lib/use-data";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { people, moments, outbox, loading, refresh } = useData();
  const { today, todayStr } = useToday();
  const wa = useWhatsApp();
  const now = useNow();
  const [message, setMessage] = useState("");
  const [aboutMoment, setAboutMoment] = useState<string | null>(null);
  const [busy, setBusy] = useState<"now" | "morning" | "draft" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const person = people.find((p) => p.id === id);
  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-paper" />;
  if (!person) {
    return (
      <p className="text-muted">
        Person not found. <Link href="/people" className="font-bold text-coral">Back to People</Link>
      </p>
    );
  }

  const mine = moments.filter((m) => m.person_id === person.id);
  const goingOn = mine
    .filter((m) => m.status === "pending")
    .sort((a, b) => (a.event_date ?? a.followup_date).localeCompare(b.event_date ?? b.followup_date));
  const history = mine
    .filter((m) => m.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 5);
  const queued = outbox.filter((o) => o.person_id === person.id && o.status === "scheduled");

  const tz = person.timezone ?? viewerTimezone();
  const morning = nextMorning(tz, now);
  const morningIsToday = localDateStr(tz, morning) === localDateStr(tz, now);
  const win = textWindow(tz, now);
  const reachable = wa?.status === "ready" && Boolean(person.whatsapp_id || person.phone);
  const quiet = person.last_contact_at ? differenceInCalendarDays(today, parseISO(person.last_contact_at)) : null;

  const pick = (m: Moment) => {
    setAboutMoment(m.id);
    setMessage(m.suggested_message);
    setResult(null);
  };

  const draftHello = async () => {
    setBusy("draft");
    setAboutMoment(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: person.name,
          relationship: person.relationship,
          daysSince: quiet,
          timezone: person.timezone,
          recent: mine.map((m) => m.detail ?? m.title),
        }),
      });
      setMessage((await res.json()).message);
    } finally {
      setBusy(null);
    }
  };

  const send = async (when: "now" | "morning") => {
    if (!message.trim()) return;
    setBusy(when);
    setResult(null);
    try {
      if (reachable) {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId: person.id, momentId: aboutMoment, text: message, when }),
        });
        const json = await res.json();
        if (json.status === "sent") setResult(`Sent to ${person.name} 💛`);
        else if (json.status === "scheduled")
          setResult(`Scheduled for ${json.theirTimeAtSend} ${person.name}'s time. It's ${json.theirTimeNow} there now.`);
        else setResult(json.error ?? "Couldn't send. Try again.");
      } else if (when === "now") {
        window_open(whatsappLink(message, person.phone));
        if (aboutMoment) await updateMoment(aboutMoment, { status: "done", completed_at: new Date().toISOString() });
        await updatePerson(person.id, { last_contact_at: new Date().toISOString() });
        setResult(`Opened WhatsApp for ${person.name} 💛`);
      } else {
        // Without a linked WhatsApp, remind the user on the morning of the person's day.
        await createMoments([
          {
            person_id: person.id,
            title: aboutMoment ? (mine.find((m) => m.id === aboutMoment)?.title ?? "Check in") : "Say hi",
            detail: `You planned to message ${person.name} on their morning.`,
            category: "other",
            event_date: null,
            followup_date: format(morning, "yyyy-MM-dd"),
            suggested_message: message,
            source: "note",
          },
        ]);
        if (aboutMoment) await updateMoment(aboutMoment, { status: "done", completed_at: new Date().toISOString() });
        setResult(`I'll remind you on ${format(morning, "EEEE")} morning, ${person.name}'s time.`);
      }
      setMessage("");
      setAboutMoment(null);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link href="/people" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> People
      </Link>

      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-peach text-4xl">{person.emoji}</div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">{person.name}</h1>
          <p className="text-muted">
            {person.relationship ?? "—"}
            {person.last_contact_at && ` · talked ${formatDistanceToNowStrict(parseISO(person.last_contact_at))} ago`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LocalTime tz={person.timezone} />
            {person.timezone && <span className="text-xs text-muted">{offsetLabel(person.timezone, now)}</span>}
          </div>
        </div>
        <StarButton
          on={person.favorite}
          name={person.name}
          onClick={() => updatePerson(person.id, { favorite: !person.favorite }).then(refresh)}
        />
      </div>

      {/* What's going on */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
          <CalendarDays className="h-4 w-4" /> What&apos;s going on with {person.name}
        </h2>
        {goingOn.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-paper p-6 text-center text-muted">
            Nothing coming up that we know of. A quick hello is always nice.
          </p>
        ) : (
          <ul className="space-y-2">
            {goingOn.map((m) => {
              const meta = CATEGORY_META[m.category] ?? CATEGORY_META.other;
              const when = m.event_date ?? m.followup_date;
              const days = differenceInCalendarDays(parseISO(when), today);
              const label =
                days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days < 0 ? `${-days} days ago` : `in ${days} days`;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => pick(m)}
                    className={`flex w-full items-center gap-3 rounded-2xl border bg-paper px-4 py-3 text-left transition hover:border-coral ${
                      aboutMoment === m.id ? "border-coral ring-2 ring-coral/30" : "border-line"
                    }`}
                  >
                    <span className="text-2xl">{meta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {m.title} <span className="font-normal text-muted">· {label}</span>
                      </p>
                      {m.detail && <p className="truncate text-sm text-muted">{m.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-bold text-coral">
                      {m.followup_date <= todayStr ? "Ask now" : "Ask about it"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Composer */}
      <section className="mt-6 rounded-3xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Message {person.name}</h2>
          <button
            onClick={draftHello}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-full bg-sage px-3 py-1.5 text-sm font-bold text-emerald-900 hover:brightness-95 disabled:opacity-60"
          >
            {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Just say hi
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder={`Pick something above, tap “Just say hi”, or write your own…`}
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-cream px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-coral"
        />

        {win !== "good" && person.timezone && (
          <p className="mt-2 text-sm text-indigo-500">
            It&apos;s {localTimeLabel(tz, now)} in {cityName(tz)}.{" "}
            {win === "sleeping" ? `${person.name} is probably asleep, ` : ""}{morningIsToday ? "this" : "tomorrow"} morning might land better.
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => send("now")}
            disabled={busy !== null || !message.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-3 font-bold text-white shadow-sm transition hover:bg-coral-dark disabled:opacity-50"
          >
            {busy === "now" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : reachable ? (
              <Send className="h-4 w-4" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {reachable ? "Message now" : "Open in WhatsApp now"}
          </button>
          <button
            onClick={() => send("morning")}
            disabled={busy !== null || !message.trim()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-coral/40 px-4 py-2 font-bold text-coral transition hover:bg-peach disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              {busy === "morning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sunrise className="h-4 w-4" />}
              Ask {morningIsToday ? "this" : "tomorrow"} morning
            </span>
            <span className="text-xs font-semibold text-muted">
              {localTimeLabel(tz, morning)} in {cityName(tz)} ·{" "}
              {morning.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} your time
            </span>
          </button>
        </div>
        {!reachable && (
          <p className="mt-2 text-xs text-muted">
            {wa?.status === "ready"
              ? `Add ${person.name}’s phone number to send automatically. For now, “morning” sets a reminder for you.`
              : "WhatsApp isn’t linked, so “morning” sets a reminder for you instead of sending automatically."}
          </p>
        )}
        {result && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-sage px-3 py-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" /> {result}
          </p>
        )}
      </section>

      {queued.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Waiting to send</h2>
          <ul className="space-y-2 text-sm">
            {queued.map((o) => (
              <li key={o.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
                “{o.text}”
                <span className="block text-muted">
                  {localTimeLabel(tz, new Date(o.send_at))} {cityName(tz)} time
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Times you showed up</h2>
          <ul className="space-y-1.5 text-sm">
            {history.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{m.title}</span>
                {m.completed_at && <span className="text-muted">· {format(parseISO(m.completed_at), "MMM d")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function window_open(href: string) {
  window.open(href, "_blank", "noopener");
}
