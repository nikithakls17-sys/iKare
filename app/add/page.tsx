"use client";

import { PageBanner } from "@/components/geo";
import { FileText, ImageIcon, Loader2, NotebookPen, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useToday } from "@/components/today-provider";
import { createMoments, createPerson } from "@/lib/store";
import { localDateStr } from "@/lib/tz";
import { CATEGORY_META, type ExtractedMoment } from "@/lib/types";
import { useData } from "@/lib/use-data";

type Mode = "screenshot" | "export" | "note";
type Draft = ExtractedMoment & { keep: boolean; personId: string }; // personId "" = create new

const SAMPLES = [
  { src: "/demo/chat-priya.png", label: "Priya's chat" },
  { src: "/demo/chat-family.png", label: "Family group" },
];

const LOADING_LINES = ["Reading between the lines…", "Spotting what matters…", "Drafting something warm…"];

/** Downscale to keep uploads small and fast; returns base64 (no data: prefix). */
async function toBase64Image(file: Blob): Promise<{ data: string; mediaType: string; preview: string }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl };
}

export default function AddPage() {
  const router = useRouter();
  const { todayStr } = useToday();
  const { people } = useData();

  const [mode, setMode] = useState<Mode>("screenshot");
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [exportFile, setExportFile] = useState<{ name: string; withName: string | null; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    setError(null);
    setDrafts(null);
    try {
      setImage(await toBase64Image(files[0]));
    } catch {
      setError("That image couldn't be opened. Try a PNG or JPG.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const loadSample = async (src: string) => {
    setDrafts(null);
    setError(null);
    const blob = await (await fetch(src)).blob();
    setImage(await toBase64Image(blob));
  };

  const canExtract =
    mode === "screenshot" ? Boolean(image) : mode === "export" ? Boolean(exportFile) : note.trim().length > 0;

  const exportPrompt = () =>
    exportFile
      ? `This is an exported WhatsApp chat${
          exportFile.withName ? ` with ${exportFile.withName}. Every other speaker is the user ("Me")` : ""
        }. Only the most recent lines are included; focus on moments that are still upcoming or recent.\n\n${exportFile.text}`
      : "";

  const extract = async () => {
    setLoading(true);
    setError(null);
    setDrafts(null);
    setLineIdx(0);
    const timer = setInterval(() => setLineIdx((i) => (i + 1) % LOADING_LINES.length), 1800);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "screenshot"
            ? { image: image?.data, mediaType: image?.mediaType }
            : { text: mode === "export" ? exportPrompt() : note }),
          today: todayStr,
          knownPeople: people.map((p) => p.name),
          peopleContext: people
            .filter((p) => p.timezone)
            .map((p) => `${p.name}: lives in ${p.timezone}, today there is ${localDateStr(p.timezone!)}`),
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      const found: ExtractedMoment[] = json.moments ?? [];
      setDrafts(
        found.map((m) => ({
          ...m,
          keep: true,
          personId: people.find((p) => p.name.toLowerCase() === m.personName.toLowerCase())?.id ?? "",
        })),
      );
    } catch {
      setError("Couldn't reach iKare. Check your connection and try again.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds && ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = async () => {
    if (!drafts) return;
    setSaving(true);
    setError(null);
    try {
      const kept = drafts.filter((d) => d.keep);
      const created = new Map<string, string>(); // new person name -> id
      for (const d of kept) {
        const key = d.personName.trim().toLowerCase();
        if (!d.personId && !created.has(key)) {
          const person = await createPerson({ name: d.personName.trim() || "Friend" });
          created.set(key, person.id);
        }
      }
      await createMoments(
        kept.map((d) => ({
          person_id: d.personId || created.get(d.personName.trim().toLowerCase())!,
          title: d.title,
          detail: d.detail || null,
          category: d.category,
          event_date: d.eventDate,
          followup_date: d.followupDate,
          suggested_message: d.suggestedMessage,
          source: mode,
        })),
      );
      // Screenshot is discarded here: only the extracted moments are stored.
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  };

  const keptCount = drafts?.filter((d) => d.keep).length ?? 0;

  return (
    <div>
      <PageBanner eyebrow="Capture" title="Add a moment">
        Share what a friend told you. iKare finds what&apos;s worth following up on.
      </PageBanner>

      <div className="flex w-full max-w-md border border-line bg-paper p-1">
        {(
          [
            ["screenshot", "Screenshot", ImageIcon],
            ["export", "Chat export", FileText],
            ["note", "Quick note", NotebookPen],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setDrafts(null);
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 px-2 py-2 text-sm font-bold transition ${
              mode === key ? "bg-strong text-white" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "screenshot" ? (
          image ? (
            <div className="geo-box overflow-hidden border border-line bg-paper p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={image.preview} alt="Chat screenshot" className="mx-auto max-h-96 object-contain" />
              <button
                onClick={() => {
                  setImage(null);
                  setDrafts(null);
                }}
                aria-label="Remove screenshot"
                className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-strong/80 text-white hover:bg-strong"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div
                {...getRootProps()}
                className={`cursor-pointer border-2 border-dashed px-6 py-12 text-center transition ${
                  isDragActive ? "border-accent bg-tint" : "border-line bg-paper hover:border-accent"
                }`}
              >
                <input {...getInputProps()} />
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center bg-tint text-accent">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="font-bold">Drop a chat screenshot here</p>
                <p className="mt-1 text-sm text-muted">WhatsApp, iMessage, anything · or tap to choose</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">No screenshot handy? Try</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.src}
                    onClick={() => loadSample(s.src)}
                    className="border border-line bg-paper px-4 py-1 font-semibold hover:bg-tint"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )
        ) : mode === "export" ? (
          <label className="block cursor-pointer border-2 border-dashed border-line bg-paper px-6 py-10 text-center transition hover:border-accent">
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setDrafts(null);
                setError(null);
                const text = await file.text();
                // "WhatsApp Chat with Priya.txt" tells us who the other person is.
                const withName = file.name.match(/chat with (.+?)(\.txt)?$/i)?.[1]?.trim() ?? null;
                setExportFile({ name: file.name, withName, text: text.split(/\r?\n/).slice(-400).join("\n") });
              }}
            />
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center bg-tint text-accent">
              <FileText className="h-6 w-6" />
            </div>
            {exportFile ? (
              <>
                <p className="font-bold">{exportFile.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {exportFile.text.split("\n").length} recent lines ready · tap to pick another
                </p>
              </>
            ) : (
              <>
                <p className="font-bold">Upload a WhatsApp chat export (.txt)</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  In WhatsApp: open a chat → ⋮ / contact name → <b>Export chat</b> → <b>Without media</b>. On iPhone,
                  unzip it and pick <i>_chat.txt</i>.
                </p>
              </>
            )}
          </label>
        ) : (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Sam has his driving test on Friday. Mom's seeing the doctor Thursday."
            className="w-full border border-line bg-paper px-6 py-4 text-[15px] leading-relaxed outline-none focus:border-accent"
          />
        )}
      </div>

      {!drafts && (
        <button
          onClick={extract}
          disabled={!canExtract || loading}
          className="mt-4 flex w-full items-center justify-center gap-2 bg-accent px-6 py-4 text-base font-bold text-on-accent transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> {LOADING_LINES[lineIdx]}
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" /> Find moments
            </>
          )}
        </button>
      )}

      {error && <p className="mt-4 bg-ochre-tint p-4 text-sm text-warn">{error}</p>}

      {drafts && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">
            {drafts.length === 0
              ? "Nothing to follow up on here"
              : `Found ${drafts.length} moment${drafts.length === 1 ? "" : "s"}`}
          </h2>
          {drafts.length === 0 ? (
            <p className="mt-1 text-muted">Try another screenshot, or write a quick note instead.</p>
          ) : (
            <p className="mt-1 text-muted">Tweak anything, then save. Untick what you don&apos;t need.</p>
          )}

          <div className="mt-4 space-y-4">
            {drafts.map((d, i) => {
              const meta = CATEGORY_META[d.category] ?? CATEGORY_META.other;
              return (
                <div
                  key={i}
                  className={`rise border bg-paper p-6 transition ${
                    d.keep ? "border-line" : "border-line opacity-50"
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={d.keep}
                      onChange={(e) => update(i, { keep: e.target.checked })}
                      className="h-5 w-5 accent-[var(--accent)]"
                      aria-label="Keep this moment"
                    />
                    <span className={`px-2 py-1 text-xs font-bold ${meta.tint}`}>
                      {meta.emoji} {meta.label}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Person">
                      <select
                        value={d.personId}
                        onChange={(e) => update(i, { personId: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">➕ New: {d.personName}</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.emoji} {p.name}
                          </option>
                        ))}
                      </select>
                      {!d.personId && (
                        <input
                          value={d.personName}
                          onChange={(e) => update(i, { personName: e.target.value })}
                          className={`${inputCls} mt-2`}
                          placeholder="Name"
                        />
                      )}
                    </Field>
                    <Field label="What's happening">
                      <input
                        value={d.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Check in on">
                      <input
                        type="date"
                        value={d.followupDate}
                        onChange={(e) => update(i, { followupDate: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Context">
                      <input
                        value={d.detail}
                        onChange={(e) => update(i, { detail: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Message draft" className="mt-4">
                    <textarea
                      value={d.suggestedMessage}
                      onChange={(e) => update(i, { suggestedMessage: e.target.value })}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </Field>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {drafts.length > 0 && (
              <button
                onClick={save}
                disabled={saving || keptCount === 0}
                className="flex flex-1 items-center justify-center gap-2 bg-accent px-6 py-4 font-bold text-on-accent transition hover:bg-accent-deep disabled:opacity-50"
              >
                {saving && <Loader2 className="h-5 w-5 animate-spin" />}
                Save {keptCount} moment{keptCount === 1 ? "" : "s"}
              </button>
            )}
            <button
              onClick={() => setDrafts(null)}
              className="border border-line px-6 py-4 font-bold transition hover:bg-tint"
            >
              Start over
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            🔒 Your screenshot isn&apos;t stored, only the moments you save.
          </p>
        </section>
      )}
    </div>
  );
}

const inputCls =
  "w-full border border-line bg-cream px-4 py-2 text-[15px] outline-none focus:border-accent";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
