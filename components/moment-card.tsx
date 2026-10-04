"use client";

import { Check, Clock, Loader2, MessageCircle, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { smsLink, whatsappLink } from "@/lib/links";
import { localTimeLabel, nextGoodTime, textWindow } from "@/lib/tz";
import { CATEGORY_META, type Moment, type Person } from "@/lib/types";
import { CardMotif } from "./geo";
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
  // Reply drafts leave [blanks] for things only the user knows.
  const hasBlank = /\[[^\]]+\]/.test(message);

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
    // Same anatomy as a People row (avatar · name and meta · motif on the right), on the inverse surface.
    <article className="rise inverse geo-box w-full border border-line bg-paper">
      <div className="flex items-center gap-4 p-4 sm:p-6 sm:pb-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint text-xl ring-1 ring-line sm:h-12 sm:w-12 sm:text-2xl">
          {person?.emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate text-ochre">
            {chip.emoji} {chip.label}
          </p>
          <p className="mt-1 text-lg font-bold leading-snug">{headline}</p>
          {detail && <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>}
          {tz && (
            <div className="mt-2">
              <LocalTime tz={tz} />
            </div>
          )}
        </div>
        <CardMotif className="hidden shrink-0 self-start sm:block" />
      </div>

      <div className="relative px-4 sm:px-6">
        <textarea
          aria-label={`Message to ${name}`}
          value={props.messageLoading ? "" : message}
          placeholder={props.messageLoading ? "Drafting something warm…" : ""}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full resize-none border border-line bg-cream px-4 py-4 text-[15px] leading-relaxed outline-none focus:border-accent"
        />
        {props.messageLoading && <Loader2 className="absolute right-8 top-4 h-4 w-4 animate-spin text-muted" />}
      </div>

      {hasBlank && (
        <p className="mx-4 mt-2 bg-ochre-tint px-4 py-2 text-sm text-warn sm:mx-6">
          ✏️ Fill in the <b>[blank]</b> with your own words before sending.
        </p>
      )}
      {error && <p className="mx-4 mt-2 bg-ochre-tint px-4 py-2 text-sm text-warn sm:mx-6">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 p-4 sm:p-6 sm:pt-4">
        {reachable ? (
          <>
            <button
              onClick={() => approve("auto")}
              disabled={busy || props.messageLoading || !message.trim() || hasBlank}
              className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-bold text-on-accent transition hover:bg-accent-deep disabled:opacity-60"
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
              disabled={props.messageLoading || hasBlank}
              className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-bold text-on-accent transition hover:bg-accent-deep"
            >
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </button>
            <button
              onClick={() => openLink(smsLink(message, person?.phone))}
              disabled={props.messageLoading || hasBlank}
              className="flex items-center gap-2 bg-strong px-4 py-2 text-sm font-bold text-white transition hover:brightness-125"
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
    case "reply":
      return `Reply to ${name}`;
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
      className="grid h-12 w-12 place-items-center rounded-full border border-line text-muted transition hover:bg-tint hover:text-ink"
    >
      {children}
    </button>
  );
}
