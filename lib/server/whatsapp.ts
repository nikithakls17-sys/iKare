import "server-only";
import QRCode from "qrcode";
import type { Client as WAClient, Message } from "whatsapp-web.js";
import { aiConfigured, extractMoments } from "@/lib/ai";
import { guessTimezone, localDateStr } from "@/lib/tz";
import type { Person } from "@/lib/types";
import * as db from "./db";

// Links the user's WhatsApp (like WhatsApp Web) so iKare can read incoming chats,
// detect moments, and send approved messages. Runs inside the Next.js server process.
// Local only: needs a long-running process + Chrome, so it is disabled on Vercel.

export type WAStatus = "off" | "starting" | "qr" | "ready" | "error";

type ChatBuffer = {
  title: string;
  lines: string[];
  people: Map<string, string>;
  timer?: ReturnType<typeof setTimeout>;
};

type State = {
  client: WAClient | null;
  status: WAStatus;
  qr: string | null;
  me: string | null;
  error: string | null;
  buffers: Map<string, ChatBuffer>;
  scheduler: ReturnType<typeof setInterval> | null;
  log: { at: string; text: string }[];
  scanning?: boolean;
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
    scanning: Boolean(state.scanning),
  };
}

export async function startWhatsApp(retried = false) {
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
    scanRecentChats().catch((e) => console.error("[whatsapp] scan failed", e));
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

  client.initialize().catch(async (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    state.client = null;
    // An old Chrome may still be holding the session folder; give it a moment and retry once.
    if (/already running/i.test(message) && !retried) {
      note("Waiting for the previous WhatsApp browser to close…");
      await new Promise((r) => setTimeout(r, 8_000));
      return startWhatsApp(true);
    }
    state.status = "error";
    state.error = message;
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

/** Real phone digits for a WhatsApp id. Private "@lid" ids hide the number, so look it up. */
async function phoneFor(waId: string, fallback?: string): Promise<string> {
  if (waId.endsWith("@c.us")) return waId.split("@")[0];
  if (waId.endsWith("@lid") && state.client) {
    try {
      const [hit] = await state.client.getContactLidAndPhone([waId]);
      if (hit?.pn) return hit.pn.split("@")[0];
    } catch {}
    return ""; // the lid digits are not a phone number
  }
  return fallback ?? "";
}

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
      favorite: false,
    },
  ]);
  note(`New person from WhatsApp: ${created.name}`);
  return created;
}

async function handleMessage(msg: Message) {
  const chatId = await ingest(msg);
  if (!chatId) return;
  if (!msg.fromMe) note(`Message in ${state.buffers.get(chatId)?.title ?? "a chat"}`);
  else await resolveReplies([...(state.buffers.get(chatId)?.people.values() ?? [])]);

  // Only analyse after the other person has spoken and the chat goes quiet for a moment.
  const buf = state.buffers.get(chatId)!;
  if (msg.fromMe || !aiConfigured() || buf.people.size === 0) return;
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => {
    analyseChat(chatId).catch((e) => {
      note(`AI error: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      console.error("[whatsapp] extraction failed", e);
    });
  }, EXTRACT_DEBOUNCE_MS);
}

/** Read recent chats once after linking so iKare is useful immediately. */
async function scanRecentChats() {
  if (!state.client || state.scanning) return;
  state.scanning = true;
  try {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const chats = (await state.client.getChats())
      .filter((c) => !c.archived && c.timestamp > cutoff && c.id.user !== state.me && c.id.server !== "broadcast")
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);
    note(`Reading your ${chats.length} most recent chats…`);
    let found = 0;
    let aiOk = aiConfigured();
    for (const chat of chats) {
      const messages = await chat.fetchMessages({ limit: 30 });
      for (const m of messages) await ingest(m, chat);
      const buf = state.buffers.get(chat.id._serialized);
      const recentIncoming = messages.some((m) => !m.fromMe && m.timestamp > Date.now() / 1000 - 14 * 86400);
      if (buf && buf.people.size > 0 && recentIncoming && aiOk) {
        try {
          found += await analyseChat(chat.id._serialized);
        } catch (e) {
          note(`AI error: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
          if (e && typeof e === "object" && "status" in e && (e.status === 429 || e.status === 401)) aiOk = false;
        }
      }
    }
    note(aiConfigured() ? `Scan done: ${found} new moment${found === 1 ? "" : "s"}` : "Scan done (add an AI key to detect moments)");
  } finally {
    state.scanning = false;
  }
}

export async function rescan() {
  await scanRecentChats();
}

/** Records a message into the person list and chat buffer. Returns the chat id, or null if skipped. */
async function ingest(msg: Message, knownChat?: Awaited<ReturnType<Message["getChat"]>>) {
  if (msg.type !== "chat" || !msg.body?.trim()) return null;
  if (msg.from === "status@broadcast" || msg.to === "status@broadcast") return null;

  const chat = knownChat ?? (await msg.getChat());
  const chatId = chat.id._serialized;
  let person: Person | null = null;
  let speaker = "Me";

  if (chat.isGroup) {
    if (!msg.fromMe) {
      const contact = await msg.getContact();
      const waId = msg.author ?? contact.id._serialized;
      person = await findOrCreatePerson(waId, await phoneFor(waId, contact.number), contact.name || contact.pushname || "");
      speaker = person.name;
    }
  } else {
    const contact = await chat.getContact();
    person = await findOrCreatePerson(chatId, await phoneFor(chatId, contact.number), contact.name || contact.pushname || chat.name);
    if (!msg.fromMe) speaker = person.name;
  }

  const sentAt = new Date(msg.timestamp * 1000);
  if (person && (!person.last_contact_at || new Date(person.last_contact_at) < sentAt)) {
    await db.update("people", person.id, { last_contact_at: sentAt.toISOString() });
  }

  const buf: ChatBuffer = state.buffers.get(chatId) ?? { lines: [], people: new Map(), title: chat.name };
  state.buffers.set(chatId, buf);
  // Date prefix lets the AI resolve "Monday" relative to when it was said.
  const stamp = sentAt.toISOString().slice(0, 16).replace("T", " ");
  buf.lines.push(`[${stamp} UTC] ${speaker}: ${msg.body.trim()}`);
  buf.lines = buf.lines.slice(-30);
  if (person && speaker !== "Me") buf.people.set(person.name, person.id);
  return chatId;
}

async function analyseChat(chatId: string): Promise<number> {
  const buf = state.buffers.get(chatId);
  if (!buf || buf.people.size === 0) return 0;
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
  if (found.length === 0) return 0;

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
    note(`Detected ${rows.map((r) => r.title).join(", ")} in ${buf.title}`);
  }
  return rows.length;
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

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);
}

/** Close a client and make sure its Chrome is gone, so a new one can reuse the session folder. */
async function closeClient(client: WAClient) {
  const browser = client.pupBrowser;
  await withTimeout(client.destroy(), 10_000, "Closing WhatsApp").catch(() => {});
  try {
    browser?.process()?.kill("SIGKILL");
  } catch {}
  await new Promise((r) => setTimeout(r, 2_000)); // let Chrome release its profile lock
}

/** Restart the client from the saved session (no QR needed). */
async function reconnect(reason: string) {
  note(`WhatsApp stopped responding (${reason.slice(0, 80)}). Reconnecting…`);
  const old = state.client;
  state.client = null;
  state.status = "off";
  if (old) await closeClient(old);
  await startWhatsApp();
}

let lastHealthy = 0;

/**
 * The background browser can go stale (e.g. after the laptop sleeps) while status still says
 * "ready". Ask WhatsApp Web for its real state; if it doesn't answer, reconnect.
 */
async function ensureAlive() {
  if (!whatsappReady()) throw new Error("WhatsApp isn't connected. Open Connect to link it.");
  let waState: string | null = null;
  try {
    waState = await withTimeout(state.client!.getState(), 8_000, "WhatsApp check");
  } catch (e) {
    waState = e instanceof Error ? e.message : String(e);
  }
  if (waState === "CONNECTED") {
    lastHealthy = Date.now();
    return;
  }
  await reconnect(waState ?? "no state");
  throw new Error("WhatsApp had gone to sleep, so iKare is reconnecting it. Try again in about a minute.");
}

export async function sendNow(person: Person, text: string) {
  try {
    await ensureAlive();
    const chatId = await chatIdFor(person);
    if (!chatId) throw new Error(`${person.name} isn't reachable on WhatsApp`);
    try {
      await withTimeout(state.client!.sendMessage(chatId, text), 30_000, "Sending");
    } catch (e) {
      // Private "@lid" ids occasionally fail; retry through the phone number.
      const digits = person.phone?.replace(/\D/g, "");
      if (!chatId.endsWith("@lid") || !digits) throw e;
      const byPhone = await state.client!.getNumberId(digits);
      if (!byPhone) throw e;
      await withTimeout(state.client!.sendMessage(byPhone._serialized, text), 30_000, "Sending");
    }
  } catch (e) {
    note(`Couldn't send to ${person.name}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    throw e;
  }
  await db.update("people", person.id, { last_contact_at: new Date().toISOString() });
  await resolveReplies([person.id]);
  note(`Sent to ${person.name}`);
}

/** The user answered: clear any "reply owed" cards for these people. */
async function resolveReplies(personIds: string[]) {
  if (personIds.length === 0) return;
  const open = (await db.list("moments")).filter(
    (m) => m.category === "reply" && m.status === "pending" && personIds.includes(m.person_id),
  );
  for (const m of open) await db.update("moments", m.id, { status: "done", completed_at: new Date().toISOString() });
  if (open.length) note(`Marked ${open.length} reply as answered`);
}

async function runScheduler() {
  if (!whatsappReady()) return;
  const now = Date.now();
  // Watchdog: catch a stale session before the user tries to send.
  if (now - lastHealthy > 2 * 60_000) {
    try {
      await ensureAlive();
    } catch {
      return;
    }
  }
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
