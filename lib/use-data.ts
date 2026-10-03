"use client";

import { useCallback, useEffect, useState } from "react";
import { listMoments, listPeople } from "./store";
import type { Moment, Person } from "./types";

export function useData() {
  const [people, setPeople] = useState<Person[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([listPeople(), listMoments()]);
      setPeople(p);
      setMoments(m);
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
    return () => window.removeEventListener("icare:refresh", onRefresh);
  }, [refresh]);

  return { people, moments, loading, error, refresh, setMoments };
}
