import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type ExtractedMoment } from "./types";

// All AI logic lives here so the provider can be swapped in one place.
const MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You help someone stay present for the friends and family they already love.

You will be given a chat screenshot and/or a short note written by the user. Find the moments where the OTHER person shared something happening in their life that deserves a follow-up: job interviews, exams, doctor appointments, feeling sick, trips, celebrations, big news, or tough times.

Rules:
- Ignore small talk, logistics ("see you at 7"), and anything about the user themselves. In a chat screenshot, the user's own messages are usually on the right side; the other person's are on the left. The chat header usually shows the other person's name.
- If someone mentions a third person (e.g. "my mom has surgery Friday"), the follow-up is still with the person who told you, so use the sender's name.
- In a note, the user names the person directly (e.g. "Sam has his driving test on Friday" is about Sam).
- Resolve relative dates ("Monday", "next week", "tomorrow", "tonight") against the provided today date. If a weekday is named, use the next occurrence on or after today.
- followupDate: usually the day after the event. For an event later the same day, use the same day. For "feeling sick", stress, or tough times with no date, use 2 days after today. For trips, the day after they return if known, otherwise the day after they leave.
- suggestedMessage: a short, warm, casual text (1-2 sentences, at most one emoji), written the way a caring friend would actually text. Reference the specific thing. Never robotic or formal.
- title: 2-4 words, e.g. "Job interview", "Driving test", "Doctor visit".
- detail: one sentence of context.
- Match personName to one of the known people when it is clearly the same person, using their exact spelling. If no name is visible, use a sensible label like "Friend".
- Return an empty moments array if nothing qualifies.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["moments"],
  properties: {
    moments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "personName",
          "title",
          "detail",
          "category",
          "eventDate",
          "followupDate",
          "suggestedMessage",
        ],
        properties: {
          personName: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          eventDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
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
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

let client: Anthropic | null = null;

export async function extractMoments(input: ExtractInput): Promise<ExtractedMoment[]> {
  client ??= new Anthropic();
  const weekday = new Date(`${input.today}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    const mediaType = (IMAGE_TYPES as readonly string[]).includes(input.mediaType ?? "")
      ? (input.mediaType as ImageType)
      : "image/png";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: input.image },
    });
  }
  content.push({
    type: "text",
    text: [
      `Today is ${weekday}, ${input.today}.`,
      `Known people: ${input.knownPeople.length ? input.knownPeople.join(", ") : "(none yet)"}.`,
      input.text?.trim() ? `Note from the user:\n${input.text.trim()}` : "Read the chat screenshot above.",
    ].join("\n"),
  });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    // Server-side fallback: if a safety classifier declines, the API retries on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");

  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = JSON.parse(text) as { moments?: ExtractedMoment[] };
  return (parsed.moments ?? []).filter((m) => m.personName && m.title && m.followupDate);
}
