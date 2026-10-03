export const CATEGORIES = [
  "interview",
  "exam",
  "health",
  "travel",
  "celebration",
  "tough_time",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type MomentStatus = "pending" | "done" | "snoozed" | "dismissed";
export type MomentSource = "screenshot" | "note" | "whatsapp" | "export";

export type Person = {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
  emoji: string;
  timezone: string | null; // IANA, e.g. "Europe/London"
  whatsapp_id: string | null; // e.g. "447911123456@c.us"
  last_contact_at: string | null;
  contact_every_days: number; // nudge if quiet longer than this
  created_at: string;
};

export type Moment = {
  id: string;
  person_id: string;
  title: string;
  detail: string | null;
  category: Category;
  event_date: string | null;
  followup_date: string;
  suggested_message: string;
  status: MomentStatus;
  source: MomentSource;
  created_at: string;
  completed_at: string | null;
};

export type OutboxStatus = "scheduled" | "sent" | "failed" | "cancelled";

export type OutboxItem = {
  id: string;
  person_id: string;
  moment_id: string | null;
  text: string;
  status: OutboxStatus;
  send_at: string; // UTC ISO
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

export type Tables = {
  people: Person;
  moments: Moment;
  outbox: OutboxItem;
};
export type TableName = keyof Tables;

export type ExtractedMoment = {
  personName: string;
  title: string;
  detail: string;
  category: Category;
  eventDate: string | null;
  followupDate: string;
  suggestedMessage: string;
};

export const CATEGORY_META: Record<Category, { label: string; emoji: string; tint: string }> = {
  interview: { label: "Interview", emoji: "💼", tint: "bg-sky-100 text-sky-800" },
  exam: { label: "Exam", emoji: "📚", tint: "bg-violet-100 text-violet-800" },
  health: { label: "Health", emoji: "🩺", tint: "bg-rose-100 text-rose-800" },
  travel: { label: "Travel", emoji: "✈️", tint: "bg-teal-100 text-teal-800" },
  celebration: { label: "Celebration", emoji: "🎉", tint: "bg-amber-100 text-amber-800" },
  tough_time: { label: "Tough time", emoji: "🫂", tint: "bg-orange-100 text-orange-800" },
  other: { label: "Moment", emoji: "✨", tint: "bg-stone-100 text-stone-700" },
};
