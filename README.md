# iKare

**Never miss the moments that matter to the people you love.**

People don't forget their friends exist. They forget the *follow-up*. A friend says "my interview is Monday", Mom mentions a doctor visit on Thursday, and life gets busy before you ever ask how it went.

iKare turns what people tell you into chances to show up for them:

1. **Capture**: link your WhatsApp, drop in a chat screenshot or export, or type a quick note.
2. **Detect**: AI finds the moments worth following up on (interviews, exams, appointments, feeling sick, trips, big news, tough times, questions you never answered) and picks the right day to check in.
3. **Remind**: on that day a card appears in **Today**: *"Ask Priya how the job interview went."*
4. **Show up**: the card has a warm message drafted. You edit it and approve it, and iKare sends it from your WhatsApp at a good time in *their* time zone.

> AI is a bridge, not a replacement. iKare never messages anyone without your approval.

## Features

- **Today**: cards for everyone to check in on today, each with a drafted message, the person's local time, and done / snooze / dismiss.
- **Reconnect**: a separate section for people you haven't talked to lately, with a ready-to-send hello.
- **Replies owed**: spots questions you left unanswered and drafts a reply with blanks for what only you know. Clears itself once you reply.
- **Live WhatsApp** (runs on your own computer): reads incoming chats, detects moments, and sends approved messages. If it's night where they are, it waits for their morning.
- **Add a moment**: from a chat screenshot, a WhatsApp chat export (.txt), or a quick note. Works in any language, and drafts reply in the friend's language.
- **People**: favorites, time zones with a world clock, contact reminders, and a "showed up" count for each person.
- **Reminders and install**: browser notifications when it's time to show up, and installable as an app (PWA).
- **Private by default**: a passcode lock, and data that stays on your machine unless you add Supabase.

## Tech stack

Next.js 16 (App Router) + TypeScript · Tailwind CSS 4 · Motion · OpenAI API (vision + structured JSON output) · whatsapp-web.js + Puppeteer · Supabase (optional) · PWA (manifest + service worker).

All AI logic is in `lib/ai.ts`, so the model or provider can be swapped in one place.

## Run it locally

Requirements: Node.js 20+, Google Chrome (for WhatsApp linking), and an OpenAI API key.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Moment detection and message drafts |
| `OPENAI_MODEL` | No | Override the model (must support images + structured output) |
| `APP_PASSCODE` | Recommended | Locks the app behind a passcode |
| `WHATSAPP_ENABLED` | No | Set to `0` to turn off WhatsApp linking |
| `CHROME_PATH` | No | Path to Chrome if it isn't in the default location |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Use Supabase instead of local storage |

Then start it:

```bash
npm run dev
```

Open http://localhost:3000 and enter your passcode.

**Storage:** locally, data is saved to `.data/db.json`, which is git-ignored. To use Supabase instead, create a project, run `supabase/schema.sql` in its SQL Editor, and add the two Supabase variables.

## Linking WhatsApp

Open **Connect** (the WhatsApp badge in the header) and scan the QR code with WhatsApp → **Linked devices**, just like WhatsApp Web. iKare then reads your most recent chats and keeps listening. The login is saved in `.wwebjs_auth/` (git-ignored), so you only scan once.

Keep the computer awake with the server running. If the session goes stale (for example after the laptop sleeps), iKare notices and reconnects on its own.

### A note on WhatsApp's rules

Live linking uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), an unofficial client that drives WhatsApp Web. WhatsApp's [Terms of Service](https://www.whatsapp.com/legal/terms-of-service) don't allow unofficial clients or automated access, so iKare is a **personal prototype**, not a commercial product. It keeps the risk low by design:

- Nothing is sent without your explicit approval, one message at a time.
- It only messages people you already talk to. No bulk messaging, no strangers.
- It only runs on your own computer, and is switched off on hosted deployments.

A production version would use WhatsApp's official Business Platform. Everything else (screenshots, chat exports, notes, and "open in WhatsApp" links) works without linking at all.

## Demo mode

Add `?demo=1` to the URL to show the **time travel** bar. It stays on until `?demo=0`.

- **Date picker / +1 day**: change what "today" means, so cards appear on their follow-up day.
- **Reset demo data**: ⚠️ deletes **all** data, then loads 6 sample people (Priya, Mom, Sam, Arjun, Leah, Kenji) with cards due today, coming up, and show-up history.
- Sample chat screenshots are in `public/demo/`. Load them from the Add page with one click (**Priya's chat**, **Family group**).

### 2-minute demo script

1. **Hook:** "Your friend tells you her interview is Monday. You care. Monday comes, and you forget to ask. She notices."
2. **Today**: show the cards, each with a drafted message and the friend's local time.
3. **Add → Priya's chat → Find moments**: it finds the job interview and ignores the coffee small talk. Save.
4. **Add → Family group**: it finds Mom's doctor visit and Sam feeling sick, and skips the dinner logistics.
5. **Time travel** to the day after the interview: "Ask Priya how the job interview went" appears.
6. **Approve & send**: the message goes out on WhatsApp, or waits for their morning if they're asleep.
7. **People**: Priya's "showed up" count goes up.
8. **Close:** "iKare doesn't text for you. It helps *you* be there."

## Deploy

```bash
npx vercel            # first time: log in and link the project
npx vercel env add OPENAI_API_KEY
npx vercel env add APP_PASSCODE
npx vercel --prod
```

To try a production build locally, stop `npm run dev` first: the linked WhatsApp browser keeps files locked that the build tries to read.

On Vercel, WhatsApp linking is switched off automatically (it needs a long-running process and Chrome). Add the Supabase variables to keep data on the server; without them, data is saved in each visitor's browser.
