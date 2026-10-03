"use client";

import { format, parseISO } from "date-fns";
import { createContext, useContext, useEffect, useState } from "react";

type TodayContext = {
  today: Date;
  todayStr: string;
  demo: boolean;
  overridden: boolean;
  setOverride: (date: string | null) => void;
};

const Ctx = createContext<TodayContext | null>(null);
const OVERRIDE_KEY = "icare.today";
const DEMO_KEY = "icare.demo";

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function TodayProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1") safeSet(DEMO_KEY, "1");
    if (param === "0") {
      safeSet(DEMO_KEY, null);
      safeSet(OVERRIDE_KEY, null);
    }
    const isDemo = safeGet(DEMO_KEY) === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state after hydration
    setDemo(isDemo);
    setOverrideState(isDemo ? safeGet(OVERRIDE_KEY) : null);
  }, []);

  const setOverride = (date: string | null) => {
    safeSet(OVERRIDE_KEY, date);
    setOverrideState(date);
  };

  const today = override ? parseISO(override) : new Date();
  return (
    <Ctx.Provider
      value={{
        today,
        todayStr: format(today, "yyyy-MM-dd"),
        demo,
        overridden: Boolean(override),
        setOverride,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useToday() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToday must be used inside TodayProvider");
  return ctx;
}
