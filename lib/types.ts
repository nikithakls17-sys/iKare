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

export type Person = {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
  emoji: string;
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
  source: "screenshot" | "note";
  created_at: string;
  completed_at: string | null;
};

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
