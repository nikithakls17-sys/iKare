import "server-only";
import QRCode from "qrcode";
import type { Client as WAClient, Message } from "whatsapp-web.js";
import { aiConfigured, extractMoments } from "@/lib/ai";
import { guessTimezone, localDateStr } from "@/lib/tz";
import type { Person } from "@/lib/types";
import * as db from "./db";

// Links the user's WhatsApp (like WhatsApp Web) so iCare can read incoming chats,
// detect moments, and send approved messages. Runs inside the Next.js server process.
// Local only: needs a long-running process + Chrome, so it is disabled on Vercel.

export type WAStatus = "off" | "starting" | "qr" | "ready" | "error";

type ChatBuffer = { lines: string[]; people: Map<string, string>; timer?: ReturnType<typeof setTimeout> };

type State = {
  client: WAClient | null;
  status: WAStatus;
  qr: string | null;
  me: string | null;
  error: string | null;
  buffers: Map<string, ChatBuffer>;
  scheduler: ReturnType<typeof setInterval> | null;
  log: { at: string; text: string }[];
};

const g = globalThis as unknown as { __icareWA?: State };
const state: State = (g.__icareWA ??= {
  client: null,
  status: "off",
  qr: null,
  me: null,
  error: null,
  buffers: new Map(),
  scheduler: null,
  log: [],
});

export const whatsappEnabled = () =>
  !process.env.VERCEL && process.env.WHATSAPP_ENABLED !== "0" && db.dbMode !== "none";

const EXTRACT_DEBOUNCE_MS = 6000;
const CHROME =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

function note(text: string) {
  state.log.unshift({ at: new Date().toISOString(), text });
  state.log.length = Math.min(state.log.length, 30);
  console.log("[whatsapp]", text);
}

export function getStatus() {
  return {
    enabled: whatsappEnabled(),
    status: state.status,
    qr: state.status === "qr" ? state.qr : null,
    me: state.me,
    error: state.error,
    log: state.log.slice(0, 10),
  };
}

export async function startWhatsApp() {
  if (!whatsappEnabled() || state.client) return;
  state.status = "starting";
  state.error = null;
  const { Client, LocalAuth } = await import("whatsapp-web.js");
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: { executablePath: CHROME, headless: true, args: ["--no-sandbox"] },
  });
  state.client = client;

  client.on("qr", async (qr) => {
    state.status = "qr";
    state.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
  });
  client.on("ready", () => {
    state.status = "ready";
    state.qr = null;
    state.me = client.info?.wid?.user ?? null;
    note(`Connected as +${state.me}`);
  });
  client.on("auth_failure", (m) => {
    state.status = "error";
    state.error = `Auth failed: ${m}`;
  });
  client.on("disconnected", (reason) => {
    note(`Disconnected: ${reason}`);
    state.status = "off";
    state.client = null;
  });
  client.on("message_create", (msg) => {
    handleMessage(msg).catch((e) => console.error("[whatsapp] message handling failed", e));
  });

  state.scheduler ??= setInterval(() => {
    runScheduler().catch((e) => console.error("[whatsapp] scheduler failed", e));
  }, 20_000);

  client.initialize().catch((e: unknown) => {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
    state.client = null;
  });
}

export async function logoutWhatsApp() {
  const c = state.client;
  state.client = null;
  state.status = "off";
  state.me = null;
  if (c) {
    await c.logout().catch(() => {});
    await c.destroy().catch(() => {});
  }
}

// ---------- incoming messages ----------

async function findOrCreatePerson(waId: string, phone: string, displayName: string): Promise<Person> {
  const people = await db.list("people");
  const digits = phone.replace(/\D/g, "");
  const existing =
    people.find((p) => p.whatsapp_id === waId) ??
    (digits ? people.find((p) => p.phone && p.phone.replace(/\D/g, "") === digits) : undefined) ??
    people.find((p) => !p.whatsapp_id && !p.phone && p.name.toLowerCase() === displayName.toLowerCase());
  if (existing) {
    const patch: Partial<Person> = {};
    if (existing.whatsapp_id !== waId) patch.whatsapp_id = waId;
    if (!existing.phone && digits) patch.phone = digits;
    if (!existing.timezone && digits) patch.timezone = guessTimezone(digits);
    if (Object.keys(patch).length) {
      await db.update("people", existing.id, patch);
      Object.assign(existing, patch);
    }
    return existing;
  }
  const [created] = await db.insert("people", [
    {
      name: displayName || (digits ? `+${digits}` : "Friend"),
      phone: digits || null,
      relationship: null,
      emoji: "🙂",
      timezone: guessTimezone(digits),
      whatsapp_id: waId,
      last_contact_at: null,
      contact_every_days: 14,
    },
  ]);
  note(`New person from WhatsApp: ${created.name}`);
  return created;
}

async function handleMessage(msg: Message) {
  if (msg.type !== "chat" || !msg.body?.trim()) return;
  if (msg.from === "status@broadcast" || msg.to === "status@broadcast") return;

  const chat = await msg.getChat();
  const chatId = chat.id._serialized;
  let person: Person | null = null;
  let speaker = "Me";

  if (chat.isGroup) {
    if (!msg.fromMe) {
      const contact = await msg.getContact();
      const waId = msg.author ?? contact.id._serialized;
      person = await findOrCreatePerson(waId, contact.number ?? "", contact.name || contact.pushname || "");
      speaker = person.name;
    }
  } else {
    const contact = await chat.getContact();
    person = await findOrCreatePerson(chatId, contact.number ?? "", contact.name || contact.pushname || chat.name);
    if (!msg.fromMe) speaker = person.name;
  }

  if (person) await db.update("people", person.id, { last_contact_at: new Date(msg.timestamp * 1000).toISOString() });

  const buf: ChatBuffer = state.buffers.get(chatId) ?? { lines: [], people: new Map() };
  state.buffers.set(chatId, buf);
  buf.lines.push(`${speaker}: ${msg.body.trim()}`);
  buf.lines = buf.lines.slice(-20);
  if (person && speaker !== "Me") buf.people.set(person.name, person.id);

  // Only analyse after the other person has spoken and the chat goes quiet for a moment.
  if (msg.fromMe || !aiConfigured()) return;
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => {
    analyseChat(chatId).catch((e) => console.error("[whatsapp] extraction failed", e));
  }, EXTRACT_DEBOUNCE_MS);
}

async function analyseChat(chatId: string) {
  const buf = state.buffers.get(chatId);
  if (!buf || buf.people.size === 0) return;
  const transcript = buf.lines.join("\n");
  const people = await db.list("people");
  const inChat = people.filter((p) => [...buf.people.values()].includes(p.id));
  const viewerToday = localDateStr(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const found = await extractMoments({
    text: transcript,
    today: viewerToday,
    knownPeople: inChat.map((p) => p.name),
    peopleContext: inChat
      .filter((p) => p.timezone)
      .map((p) => `${p.name}: lives in ${p.timezone}, today there is ${localDateStr(p.timezone!)}`),
  });
  if (found.length === 0) return;

  const moments = await db.list("moments");
  const rows = found
    .map((m) => {
      const person = inChat.find((p) => p.name.toLowerCase() === m.personName.toLowerCase()) ?? inChat[0];
      const dupe = moments.some(
        (x) =>
          x.person_id === person.id &&
          (x.title.toLowerCase() === m.title.toLowerCase() ||
            (m.eventDate && x.event_date === m.eventDate && x.category === m.category)),
      );
      return dupe
        ? null
        : {
            person_id: person.id,
            title: m.title,
            detail: m.detail || null,
            category: m.category,
            event_date: m.eventDate,
            followup_date: m.followupDate,
            suggested_message: m.suggestedMessage,
            status: "pending" as const,
            source: "whatsapp" as const,
            completed_at: null,
          };
    })
    .filter((r) => r !== null);

  if (rows.length) {
    await db.insert("moments", rows);
    note(`Detected ${rows.map((r) => r.title).join(", ")}`);
  }
}

// ---------- sending ----------

export function whatsappReady() {
  return state.status === "ready" && state.client !== null;
}

async function chatIdFor(person: Person): Promise<string | null> {
  if (person.whatsapp_id) return person.whatsapp_id;
  const digits = person.phone?.replace(/\D/g, "");
  if (!digits || !state.client) return null;
  const id = await state.client.getNumberId(digits);
  if (!id) return null;
  await db.update("people", person.id, { whatsapp_id: id._serialized });
  return id._serialized;
}

export async function canReach(person: Person) {
  return whatsappReady() && Boolean(person.whatsapp_id || person.phone);
}

export async function sendNow(person: Person, text: string) {
  if (!whatsappReady()) throw new Error("WhatsApp isn't connected");
  const chatId = await chatIdFor(person);
  if (!chatId) throw new Error(`${person.name} isn't reachable on WhatsApp`);
  await state.client!.sendMessage(chatId, text);
  await db.update("people", person.id, { last_contact_at: new Date().toISOString() });
  note(`Sent to ${person.name}`);
}

async function runScheduler() {
  if (!whatsappReady()) return;
  const now = Date.now();
  const due = (await db.list("outbox")).filter(
    (o) => o.status === "scheduled" && new Date(o.send_at).getTime() <= now,
  );
  for (const item of due) {
    const person = await db.get("people", item.person_id);
    try {
      if (!person) throw new Error("Person was removed");
      await sendNow(person, item.text);
      await db.update("outbox", item.id, { status: "sent", sent_at: new Date().toISOString() });
    } catch (e) {
      await db.update("outbox", item.id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }
}
