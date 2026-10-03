"use client";

import { Check, Clock, MessageCircle, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import { smsLink, whatsappLink } from "@/lib/links";
import { CATEGORY_META, type Moment, type Person } from "@/lib/types";

type Props = {
  moment: Moment;
  person?: Person;
  onSent: (message: string) => void;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
};

export function MomentCard({ moment, person, onSent, onDone, onSnooze, onDismiss }: Props) {
  const [message, setMessage] = useState(moment.suggested_message);
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.other;
  const name = person?.name ?? "them";

  const send = (href: string) => {
    window.open(href, "_blank", "noopener");
    onSent(message);
  };

  return (
    <article className="rise overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_2px_0_rgba(43,33,24,0.04)]">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach text-2xl">
          {person?.emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-snug">{headline(moment, name)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.tint}`}>
              {meta.emoji} {moment.title}
            </span>
            {person?.relationship && <span>{person.relationship}</span>}
          </div>
          {moment.detail && <p className="mt-2 text-sm text-muted">{moment.detail}</p>}
        </div>
      </div>

      <div className="px-5">
        <label className="sr-only" htmlFor={`msg-${moment.id}`}>
          Message to {name}
        </label>
        <textarea
          id={`msg-${moment.id}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-2xl border border-line bg-cream px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-coral"
        />
      </div>

      <div className="flex flex-wrap gap-2 p-5 pt-3">
        <button
          onClick={() => send(whatsappLink(message, person?.phone))}
          className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
        >
          <MessageCircle className="h-4 w-4" /> Send on WhatsApp
        </button>
        <button
          onClick={() => send(smsLink(message, person?.phone))}
          className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black"
        >
          <MessageSquareText className="h-4 w-4" /> SMS
        </button>
        <div className="ml-auto flex gap-1">
          <IconButton label="Mark done" onClick={onDone}>
            <Check className="h-4 w-4" />
          </IconButton>
          <IconButton label="Snooze 1 day" onClick={onSnooze}>
            <Clock className="h-4 w-4" />
          </IconButton>
          <IconButton label="Dismiss" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function headline(moment: Moment, name: string) {
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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
