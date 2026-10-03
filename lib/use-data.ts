"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAll, storageMode, type Snapshot } from "./store";

const EMPTY: Snapshot = { people: [], moments: [], outbox: [] };

/** Loads all data; polls in server mode so WhatsApp-detected moments appear live. */
export function useData() {
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadAll());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client-side load
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("icare:refresh", onRefresh);
    let timer: ReturnType<typeof setInterval> | undefined;
    storageMode().then((m) => {
      if (m === "server") timer = setInterval(refresh, 4000);
    });
    return () => {
      window.removeEventListener("icare:refresh", onRefresh);
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

  const setMoments = (fn: (m: Snapshot["moments"]) => Snapshot["moments"]) =>
    setData((d) => ({ ...d, moments: fn(d.moments) }));

  return { ...data, loading, error, refresh, setMoments };
}
