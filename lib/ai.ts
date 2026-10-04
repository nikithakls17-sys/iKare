import "server-only";
import OpenAI from "openai";
import { CATEGORIES, type ExtractedMoment } from "./types";

// All AI logic lives here so the provider can be swapped in one place.
const MODEL = process.env.OPENAI_MODEL || "gpt-6-sol";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI());

export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY);

const EXTRACT_PROMPT = `You help someone stay present for the friends and family they already love, many of whom live in other countries and time zones.

You will be given a chat (screenshot, exported chat text, or live messages) and/or a short note written by the user. Find the moments where the OTHER person shared something happening in their life that deserves a follow-up: job interviews, exams, doctor appointments, feeling sick, trips, celebrations, big news, or tough times.

Rules:
- Ignore small talk, logistics ("see you at 7"), and news about the user themselves. In a chat screenshot, the user's own messages are usually on the right; the other person's are on the left. In text transcripts the user's lines start with "Me:".
- If someone mentions a third person ("my mom has surgery Friday"), the follow-up is still with the person who told you, so use the sender's name.
- In a note, the user names the person directly ("Sam has his driving test on Friday" is about Sam).
- Transcript lines may start with a [timestamp]: resolve relative dates against when that message was sent, then make sure followupDate is not in the past (if the event already happened and was never followed up, use today).
- Dates: resolve relative dates ("Monday", "tomorrow", "tonight") against TODAY IN THAT PERSON'S TIME ZONE when it is given, otherwise the user's today. A named weekday means the next occurrence on or after today.
- followupDate: usually the day after the event. For an event later the same day, the same day. For "feeling sick", stress, or tough times with no date, 2 days after today. For trips, the day after they return if known, otherwise the day after they leave.
- suggestedMessage: a short, warm, casual text (1-2 sentences, at most one emoji) the way a caring friend would actually text. Reference the specific thing. Match the language the person writes in. Never robotic or formal.
- title: 2-4 words, e.g. "Job interview", "Driving test", "Doctor visit". detail: one sentence of context.
- Match personName to one of the known people when it is clearly the same person, using their exact spelling. If no name is visible, use a sensible label like "Friend".
- REPLY OWED: if the other person asked the user a real question ("how are you?", "how did your hackathon go?", "are you free Sunday?", "did you get the job?") and the user has NOT answered it later in the chat, add a moment with category "reply". title: what they asked, short (e.g. "Asked about your hackathon"). detail: their question, quoted. eventDate: null. followupDate: today (the user's today). suggestedMessage: a warm reply STARTER the user will finish. Never invent facts about the user, including how things went, how they feel, whether they are free, their plans, or yes/no answers. Put anything only the user knows in square brackets (e.g. "[yes / no]", "[free or busy]"), e.g. "Thanks for asking! It went [how it went] 😊 How's your week been?". For invitations or plans, never accept or decline for the user, e.g. "Ooh Sunday lunch! I'm [free / busy] then. What were you thinking?". Always ask them something back. Skip rhetorical or already-answered questions, and skip questions in the screenshot/chat that the user clearly replied to.
- Only include moments that were not already handled. Return an empty moments array if nothing qualifies.`;

const nullableString = { type: ["string", "null"] };

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["moments"],
  properties: {
    moments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["personName", "title", "detail", "category", "eventDate", "followupDate", "suggestedMessage"],
        properties: {
          personName: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          eventDate: { ...nullableString, description: "YYYY-MM-DD or null" },
          followupDate: { type: "string", description: "YYYY-MM-DD" },
          suggestedMessage: { type: "string" },
        },
      },
    },
  },
};

export type ExtractInput = {
  image?: string;
  mediaType?: string;
  text?: string;
  today: string;
  knownPeople: string[];
  /** e.g. ["Priya: Europe/London, today is 2026-10-04"] */
  peopleContext?: string[];
};

async function jsonCompletion<T>(
  system: string,
  content: OpenAI.Chat.Completions.ChatCompletionContentPart[],
  name: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: { type: "json_schema", json_schema: { name, schema, strict: true } },
  });
  const choice = res.choices[0];
  if (choice?.message.refusal) throw new Error("The model declined this request.");
  return JSON.parse(choice?.message.content ?? "{}") as T;
}

export async function extractMoments(input: ExtractInput): Promise<ExtractedMoment[]> {
  const weekday = new Date(`${input.today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (input.image) {
    const type = input.mediaType || "image/jpeg";
    content.push({ type: "image_url", image_url: { url: `data:${type};base64,${input.image}` } });
  }
  content.push({
    type: "text",
    text: [
      `User's today: ${weekday}, ${input.today}.`,
      `Known people: ${input.knownPeople.length ? input.knownPeople.join(", ") : "(none yet)"}.`,
      input.peopleContext?.length ? `Time zones:\n${input.peopleContext.join("\n")}` : "",
      input.text?.trim() ? `Chat or note:\n${input.text.trim()}` : "Read the chat screenshot above.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const parsed = await jsonCompletion<{ moments?: ExtractedMoment[] }>(
    EXTRACT_PROMPT,
    content,
    "moments",
    EXTRACT_SCHEMA,
  );
  return (parsed.moments ?? []).filter((m) => m.personName && m.title && m.followupDate);
}

const DRAFT_PROMPT = `You help someone keep in touch with friends and family, often across countries and time zones.
Write ONE short, warm, casual text message (1-2 sentences, at most one emoji) to reconnect with someone they haven't talked to in a while.
Make it specific when context allows (shared history, something going on in their life, their city or local time of day). Never guilt-trip, never formal, no "I hope this message finds you well".`;

export async function draftReconnect(ctx: {
  name: string;
  relationship: string | null;
  daysSince: number | null;
  city: string | null;
  localTime: string | null;
  recent: string[];
}): Promise<string> {
  const text = [
    `Name: ${ctx.name}`,
    ctx.relationship && `Relationship: ${ctx.relationship}`,
    ctx.daysSince !== null && `Days since you last talked: ${ctx.daysSince}`,
    ctx.city && `They live in: ${ctx.city} (local time there: ${ctx.localTime})`,
    ctx.recent.length && `Things they shared before:\n- ${ctx.recent.join("\n- ")}`,
  ]
    .filter(Boolean)
    .join("\n");
  const parsed = await jsonCompletion<{ message: string }>(DRAFT_PROMPT, [{ type: "text", text }], "draft", {
    type: "object",
    additionalProperties: false,
    required: ["message"],
    properties: { message: { type: "string" } },
  });
  return parsed.message;
}
