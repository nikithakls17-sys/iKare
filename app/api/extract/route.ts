import { extractMoments } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image && !body.text?.trim()) {
      return Response.json({ moments: [], error: "Add a screenshot or a note first." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { moments: [], error: "ANTHROPIC_API_KEY is not set on the server." },
        { status: 500 },
      );
    }
    const moments = await extractMoments({
      image: body.image,
      mediaType: body.mediaType,
      text: body.text,
      today: body.today,
      knownPeople: Array.isArray(body.knownPeople) ? body.knownPeople : [],
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
