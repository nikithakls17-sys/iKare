import fs from "node:fs";
import path from "node:path";
import { getStatus, logoutWhatsApp, rescan, startWhatsApp, whatsappEnabled } from "@/lib/server/whatsapp";

export async function GET() {
  // Resume a previously linked session automatically.
  if (whatsappEnabled() && getStatus().status === "off" && fs.existsSync(path.join(process.cwd(), ".wwebjs_auth"))) {
    await startWhatsApp();
  }
  return Response.json(getStatus());
}

export async function POST(request: Request) {
  const { action } = await request.json();
  if (!whatsappEnabled()) {
    return Response.json({ error: "WhatsApp linking only works when iKare runs on your computer." }, { status: 400 });
  }
  if (action === "connect") await startWhatsApp();
  if (action === "logout") await logoutWhatsApp();
  if (action === "scan") void rescan();
  return Response.json(getStatus());
}
