import { Globe2, HeartHandshake, MessageCircleHeart, ScanSearch, ShieldCheck, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About · iKare" };

const STEPS = [
  {
    icon: ScanSearch,
    title: "Notice",
    body: "Link WhatsApp, drop in a screenshot or chat export, or jot a note. iKare picks out the moments friends share: interviews, exams, doctor visits, trips, rough weeks, big news.",
  },
  {
    icon: MessageCircleHeart,
    title: "Draft",
    body: "On the right day it writes a short, warm follow-up in a natural voice, like “How did the Deloitte interview go?!”. You can edit every word.",
  },
  {
    icon: Globe2,
    title: "Time it for them",
    body: "Everyone has a time zone, guessed from their phone number. If it’s 3 AM where they are, iKare waits until their morning instead of buzzing them awake.",
  },
  {
    icon: Sprout,
    title: "Keep in touch",
    body: "If you haven’t talked to someone in a while, iKare nudges you with a ready-to-send hello, so friendships don’t fade quietly.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-coral">About iKare</p>
        <h1 className="font-display mt-1 text-4xl font-bold leading-tight tracking-tight">
          Never miss the moments that matter to the people you love.
        </h1>
        <p className="mt-4 text-lg text-muted">
          We don&apos;t lose people all at once. We lose them by missing small moments. A friend says her interview
          is Monday, you care in the moment, then Monday comes and you forget to ask. iKare remembers the follow-up
          so you can be there.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-3xl border border-line bg-paper p-5">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-peach text-coral">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-[15px] text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-strong p-6 text-white">
        <HeartHandshake className="h-8 w-8 text-coral" />
        <h2 className="font-display mt-3 text-2xl font-bold">A bridge, not a replacement</h2>
        <p className="mt-2 opacity-85">
          iKare never talks to your friends on its own. Every message is yours: you read it, change it, and approve
          it. The AI only helps you remember and find the words.
        </p>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="h-5 w-5 text-emerald-600" /> Privacy
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
          <li>Screenshots and chat exports are processed and thrown away. Only the moments you save are kept.</li>
          <li>Linked WhatsApp runs on your own computer. Only short chat snippets go to the AI to spot moments.</li>
          <li>Nothing is sent to anyone without you tapping Approve.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold">Built with</h2>
        <p className="mt-2 text-muted">
          Next.js, TypeScript, Tailwind CSS, OpenAI (vision + structured outputs), whatsapp-web.js, Supabase,
          date-fns and the browser&apos;s built-in time zone data.
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-6 text-center">
        <p className="font-display text-xl font-bold">
          Staying connected isn&apos;t about remembering birthdays. It&apos;s about showing up.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-full bg-coral px-5 py-3 font-bold text-white hover:bg-coral-dark"
        >
          See who to show up for today
        </Link>
      </section>
    </div>
  );
}
