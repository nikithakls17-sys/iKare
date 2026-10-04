# 💛 iKare

**Never miss the moments that matter to the people you love.**

People don't forget their friends exist. They forget the *follow-up*. A friend says "my interview is Monday", Mom mentions a doctor visit Thursday, and life gets busy before you ever ask how it went.

iKare turns what people tell you into chances to show up for them:

1. **Capture**: drop in a chat screenshot or type a quick note.
2. **Detect**: Claude finds the moments (interview, exam, appointment, feeling sick, trip, big news) and picks the right day to check in.
3. **Remind**: on that day, a card appears in **Today**: *"Ask Priya how the job interview went."*
4. **Show up**: one tap opens WhatsApp or SMS with a warm message pre-typed. You edit it and send it yourself.

> AI is a bridge, not a replacement. iKare never texts anyone on its own.
> 🔒 Screenshots are processed and discarded. Only the extracted moments are saved.

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS · Claude API (`claude-sonnet-5-5`, vision + structured JSON output) · Supabase (Postgres) · `wa.me` / `sms:` deep links · Vercel.

All AI logic is in `lib/ai.ts`, so the model or provider can be swapped in one place.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000/?demo=1

**Supabase is optional.** Without Supabase keys, iKare saves data in the browser's localStorage, so the demo works out of the box. To use Supabase:

1. Create a project at supabase.com.
2. In the SQL Editor, run `supabase/schema.sql`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` (and to Vercel).

## Deploy

```bash
npx vercel            # first time: log in and link the project
npx vercel env add ANTHROPIC_API_KEY
npx vercel --prod
```

## Demo mode

Add `?demo=1` to any URL to show the **time travel** bar (it stays on until `?demo=0`):

- **Date picker / +1 day**: change what "today" means, so cards appear on their follow-up day.
- **Reset demo data**: loads 5 people, 2 cards due today, 2 coming up, and show-up history (Priya starts with 3).
- Sample screenshots are in `public/demo/`, and you can load them from the Add page with one click.

### 2-minute demo script

1. **Hook:** "Your friend tells you her interview is Monday. You care. Monday comes, and you forget to ask. She notices."
2. **Reset demo data** → Today shows Arjun (sick) and Leah (new apartment).
3. **Add → Priya's chat → Find moments** → it detects the Deloitte interview and ignores the coffee small talk. Save.
4. **Add → Family group** → it finds Mom's doctor visit and Sam feeling sick, and skips Dad's dinner logistics.
5. **Time travel** to the day after Monday → "Ask Priya how the job interview went" appears.
6. **Send on WhatsApp** → WhatsApp opens with the message pre-typed.
7. **People** → "Priya: 4 showed up."
8. **Close:** "iKare doesn't text for you. It helps *you* be there."
