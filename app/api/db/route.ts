import { clearAll, dbMode, insert, list, remove, update } from "@/lib/server/db";
import type { TableName } from "@/lib/types";

// Generic data API for the single demo user (no auth in hackathon mode).

const TABLES: TableName[] = ["people", "moments", "outbox"];

export async function GET() {
  if (dbMode === "none") return Response.json({ mode: dbMode });
  try {
    const [people, moments, outbox] = await Promise.all(TABLES.map((t) => list(t)));
    return Response.json({ mode: dbMode, people, moments, outbox });
  } catch (e) {
    return Response.json({ mode: dbMode, error: errorText(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (dbMode === "none") return Response.json({ error: "No server database" }, { status: 501 });
  const body = await request.json();
  const table = body.table as TableName;
  if (body.op !== "clear" && !TABLES.includes(table)) {
    return Response.json({ error: "Unknown table" }, { status: 400 });
  }
  try {
    switch (body.op) {
      case "insert":
        return Response.json({ rows: await insert(table, body.rows) });
      case "update":
        await update(table, body.id, body.patch);
        return Response.json({ ok: true });
      case "remove":
        await remove(table, body.id);
        return Response.json({ ok: true });
      case "clear":
        await clearAll();
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "Unknown op" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: errorText(e) }, { status: 500 });
  }
}

function errorText(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Database error";
}
