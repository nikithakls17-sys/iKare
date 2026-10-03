import { aiConfigured, draftReconnect } from "@/lib/ai";
import { cityName, localTimeLabel } from "@/lib/tz";

// Drafts a "haven't talked in a while" message. The client sends the context
// so this works with both server storage and localStorage.
export async function POST(request: Request) {
  const { name, relationship, daysSince, timezone, recent } = await request.json();
  if (!aiConfigured()) {
    return Response.json({ message: `Hey ${name}! It's been way too long, how have you been? 💛` });
  }
  try {
    const message = await draftReconnect({
      name,
      relationship: relationship ?? null,
      daysSince: typeof daysSince === "number" ? daysSince : null,
      city: timezone ? cityName(timezone) : null,
      localTime: timezone ? localTimeLabel(timezone) : null,
      recent: Array.isArray(recent) ? recent.slice(0, 5) : [],
    });
    return Response.json({ message });
  } catch (e) {
    console.error("draft failed", e);
    return Response.json({ message: `Hey ${name}! It's been way too long, how have you been? 💛` });
  }
}
