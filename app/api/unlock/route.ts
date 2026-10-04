import { AUTH_COOKIE, passcodeToken } from "@/lib/passcode";

export async function POST(request: Request) {
  const passcode = process.env.APP_PASSCODE;
  const { code } = await request.json().catch(() => ({ code: "" }));
  if (!passcode) return Response.json({ ok: true });
  if (typeof code !== "string" || code.trim() !== passcode) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.json({ ok: false, error: "Wrong passcode" }, { status: 401 });
  }
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const cookie = [
    `${AUTH_COOKIE}=${await passcodeToken(passcode)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 90}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
