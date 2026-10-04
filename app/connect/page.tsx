"use client";

import { PageBanner } from "@/components/geo";
import { CheckCircle2, Loader2, LogOut, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { useWhatsApp } from "@/components/live";

export default function ConnectPage() {
  const wa = useWhatsApp(2500);
  const [busy, setBusy] = useState(false);

  const act = async (action: "connect" | "logout" | "scan") => {
    setBusy(true);
    await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
  };

  return (
    <div>
      <PageBanner eyebrow="Live linking" title="Connect WhatsApp">
        iKare drafts a follow-up and sends it from your WhatsApp only when you approve.
      </PageBanner>

      <div className="geo-box border border-line bg-paper p-6">
        {!wa ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : !wa.enabled ? (
          <p className="text-muted">
            Live WhatsApp linking runs when iKare is on your own computer (it needs a browser session that
            stays open). On this deployed version, use the one-tap WhatsApp buttons, screenshots, or chat
            exports instead.
          </p>
        ) : wa.status === "ready" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
            <p className="mt-4 text-xl font-bold">Connected{wa.me ? ` as +${wa.me}` : ""}</p>
            <p className="mt-1 text-muted">New messages are being read for moments. Nothing sends without your OK.</p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => act("scan")}
                disabled={busy || wa.scanning}
                className="flex items-center gap-2 bg-accent px-6 py-2 font-bold text-on-accent hover:bg-accent-deep disabled:opacity-60"
              >
                {wa.scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {wa.scanning ? "Reading chats…" : "Scan recent chats"}
              </button>
              <button
                onClick={() => act("logout")}
                disabled={busy}
                className="flex items-center gap-2 border border-line px-6 py-2 font-bold hover:bg-tint"
              >
                <LogOut className="h-4 w-4" /> Unlink
              </button>
            </div>
          </div>
        ) : wa.status === "qr" && wa.qr ? (
          <div className="grid items-center gap-6 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={wa.qr} alt="WhatsApp link QR code" className="mx-auto w-64 border border-line" />
            <ol className="list-decimal space-y-2 pl-6 text-[15px]">
              <li>Open WhatsApp on your phone</li>
              <li>
                Tap <b>Settings → Linked devices</b>
              </li>
              <li>
                Tap <b>Link a device</b> and scan this code
              </li>
            </ol>
          </div>
        ) : wa.status === "starting" ? (
          <div className="flex items-center justify-center gap-4 py-6 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Starting WhatsApp… (first time takes ~20s)
          </div>
        ) : (
          <div className="text-center">
            <Smartphone className="mx-auto h-12 w-12 text-accent" />
            {wa.error && <p className="mt-4 text-sm text-warn">{wa.error}</p>}
            <button
              onClick={() => act("connect")}
              disabled={busy}
              className="mx-auto mt-4 flex items-center gap-2 bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-deep disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Link WhatsApp
            </button>
          </div>
        )}
      </div>

      {wa?.log && wa.log.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Activity</h2>
          <ul className="space-y-1 text-sm">
            {wa.log.map((l, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-20 shrink-0 text-muted">
                  {new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex gap-4 bg-moss p-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
        <p>
          Messages stay on this computer. Only short snippets are sent to the AI to spot moments, and nothing is
          ever sent to your friends without you tapping <b>Approve</b>.
        </p>
      </div>
    </div>
  );
}
