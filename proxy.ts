import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, passcodeToken } from "@/lib/passcode";

// Passcode lock. Active only when APP_PASSCODE is set (e.g. when sharing a public tunnel
// or deploying), because the app can read and send WhatsApp messages.
export async function proxy(request: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await passcodeToken(passcode))) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the unlock flow and static assets needed to render/install it.
  matcher: ["/((?!unlock|api/unlock|_next/|icons/|manifest.webmanifest|sw.js|favicon).*)"],
};
