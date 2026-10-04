import { aiConfigured, extractMoments } from "@/lib/ai";
import { localDateStr, viewerTimezone } from "@/lib/tz";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image && !body.text?.trim()) {
      return Response.json({ moments: [], error: "Add a screenshot or a note first." }, { status: 400 });
    }
    if (!aiConfigured()) {
      return Response.json({ moments: [], error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
    }
    const moments = await extractMoments({
      image: body.image,
      mediaType: body.mediaType,
      text: typeof body.text === "string" ? body.text.slice(-30000) : undefined,
      today: /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today : localDateStr(viewerTimezone()),
      knownPeople: Array.isArray(body.knownPeople) ? body.knownPeople : [],
      peopleContext: Array.isArray(body.peopleContext) ? body.peopleContext : [],
    });
    return Response.json({ moments });
  } catch (err) {
    console.error("extract failed", err);
    return Response.json(
      { moments: [], error: "Couldn't read that one. Try again, or type a quick note instead." },
      { status: 500 },
    );
  }
}
