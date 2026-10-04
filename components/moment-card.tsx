"use client";

import { Check, Clock, Loader2, MessageCircle, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { smsLink, whatsappLink } from "@/lib/links";
import { localTimeLabel, nextGoodTime, textWindow } from "@/lib/tz";
import { CATEGORY_META, type Moment, type Person } from "@/lib/types";
import { LocalTime, useNow } from "./live";

export type SendResult =
  | { status: "sent" }
  | { status: "scheduled"; theirTimeAtSend: string; theirTimeNow: string }
  | { status: "unavailable" }
  | { status: "failed"; error?: string };

type Props = {
  person?: Person;
  headline: string;
  chip: { emoji: string; label: string; tint: string };
  detail?: string | null;
  message: string;
  messageLoading?: boolean;
  waLive: boolean;
  onApprove: (text: string, when: "auto" | "now") => Promise<SendResult>;
  onFallbackSent: (text: string) => void;
  onDone?: () => void;
  onSnooze?: () => void;
  onDismiss: () => void;
};

export function ShowUpCard(props: Props) {
  const { person, headline, chip, detail, waLive } = props;
  const [message, setMessage] = useState(props.message);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  // Late-arriving drafts (AI reconnect messages) fill the box once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft once it loads
    if (!props.messageLoading) setMessage(props.message);
  }, [props.message, props.messageLoading]);

  const name = person?.name ?? "them";
  const tz = person?.timezone ?? null;
  const asleep = tz ? textWindow(tz, now) !== "good" : false;
  const reachable = waLive && Boolean(person?.whatsapp_id || person?.phone);

  const approve = async (when: "auto" | "now") => {
    setBusy(true);
    setError(null);
    try {
      const res = await props.onApprove(message, when);
      if (res.status === "unavailable") setError("Couldn't reach them on WhatsApp. Use the buttons below.");
      if (res.status === "failed") setError(res.error ?? "Send failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const openLink = (href: string) => {
    window.open(href, "_blank", "noopener");
    props.onFallbackSent(message);
  };

  return (
    <article className="rise overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_2px_0_rgba(43,33,24,0.04)]">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach text-2xl">
          {person?.emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-snug">{headline}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.tint}`}>
              {chip.emoji} {chip.label}
            </span>
            <LocalTime tz={tz} />
          </div>
          {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
        </div>
      </div>

      <div className="relative px-5">
        <textarea
          aria-label={`Message to ${name}`}
          value={props.messageLoading ? "" : message}
          placeholder={props.messageLoading ? "Drafting something warm…" : ""}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-2xl border border-line bg-cream px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-coral"
        />
        {props.messageLoading && <Loader2 className="absolute right-8 top-4 h-4 w-4 animate-spin text-muted" />}
      </div>

      {error && <p className="mx-5 mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 p-5 pt-3">
        {reachable ? (
          <>
            <button
              onClick={() => approve("auto")}
              disabled={busy || props.messageLoading || !message.trim()}
              className="flex items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-coral-dark disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {asleep && tz ? `Approve · sends ${localTimeLabel(tz, nextGoodTime(tz, now))} their time` : "Approve & send"}
            </button>
            {asleep && (
              <button
                onClick={() => approve("now")}
                disabled={busy}
                className="text-sm font-semibold text-muted underline-offset-2 hover:underline"
              >
                send now anyway
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => openLink(whatsappLink(message, person?.phone))}
              disabled={props.messageLoading}
              className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
            >
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </button>
            <button
              onClick={() => openLink(smsLink(message, person?.phone))}
              disabled={props.messageLoading}
              className="flex items-center gap-2 rounded-full bg-strong px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-125"
            >
              <MessageSquareText className="h-4 w-4" /> SMS
            </button>
          </>
        )}
        <div className="ml-auto flex gap-1">
          {props.onDone && (
            <IconButton label="Mark done" onClick={props.onDone}>
              <Check className="h-4 w-4" />
            </IconButton>
          )}
          {props.onSnooze && (
            <IconButton label="Snooze 1 day" onClick={props.onSnooze}>
              <Clock className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label="Dismiss" onClick={props.onDismiss}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

export function momentHeadline(moment: Moment, name: string) {
  const thing = moment.title.toLowerCase();
  switch (moment.category) {
    case "health":
    case "tough_time":
      return `Check in on ${name}`;
    case "celebration":
      return `Celebrate with ${name}`;
    default:
      return `Ask ${name} how the ${thing} went`;
  }
}

export function momentChip(moment: Moment) {
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.other;
  return { emoji: meta.emoji, label: moment.title, tint: meta.tint };
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted transition hover:bg-peach hover:text-ink"
    >
      {children}
    </button>
  );
}
