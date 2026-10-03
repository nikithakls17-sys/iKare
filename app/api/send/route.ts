import * as db from "@/lib/server/db";
import { canReach, sendNow } from "@/lib/server/whatsapp";
import { localTimeLabel, nextGoodTime, textWindow } from "@/lib/tz";

// Approve & send. "auto" respects the recipient's local time: if they're likely asleep,
// the message is queued for their next good hour instead of buzzing them at 3 AM.
export async function POST(request: Request) {
  const { personId, momentId, text, when = "auto" } = await request.json();
  if (db.dbMode === "none") return Response.json({ status: "unavailable" }, { status: 409 });

  const person = await db.get("people", personId);
  if (!person || !text?.trim()) return Response.json({ error: "Missing person or message" }, { status: 400 });
  if (!(await canReach(person))) return Response.json({ status: "unavailable" }, { status: 409 });

  const now = new Date();
  const tz = person.timezone;
  const finishMoment = async (at: string) => {
    if (momentId) {
      await db.update("moments", momentId, { status: "done", completed_at: at, suggested_message: text });
    }
  };

  if (when === "auto" && tz && textWindow(tz, now) !== "good") {
    const sendAt = nextGoodTime(tz, now);
    await db.insert("outbox", [
      {
        person_id: person.id,
        moment_id: momentId ?? null,
        text,
        status: "scheduled",
        send_at: sendAt.toISOString(),
        sent_at: null,
        error: null,
      },
    ]);
    await finishMoment(sendAt.toISOString());
    return Response.json({
      status: "scheduled",
      sendAt: sendAt.toISOString(),
      theirTimeNow: localTimeLabel(tz, now),
      theirTimeAtSend: localTimeLabel(tz, sendAt),
    });
  }

  try {
    await sendNow(person, text);
    await db.insert("outbox", [
      {
        person_id: person.id,
        moment_id: momentId ?? null,
        text,
        status: "sent",
        send_at: now.toISOString(),
        sent_at: now.toISOString(),
        error: null,
      },
    ]);
    await finishMoment(now.toISOString());
    return Response.json({ status: "sent" });
  } catch (e) {
    return Response.json({ status: "failed", error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
