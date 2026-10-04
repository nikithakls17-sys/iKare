"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "icare.favoritesOnly";

/** Remembers the "favorites only" filter per browser. */
export function useFavoritesOnly() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved preference after hydration
      setOn(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  return [on, toggle] as const;
}

export function FavoritesToggle({ on, onToggle, count }: { on: boolean; onToggle: () => void; count: number }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap border px-4 py-2 text-sm font-bold transition ${
        on ? "border-ochre bg-ochre-tint text-warn" : "border-line bg-paper text-muted hover:text-ink"
      }`}
    >
      <Star className="h-4 w-4" fill={on ? "currentColor" : "none"} />
      Favorites{count ? ` · ${count}` : ""}
    </button>
  );
}

export function StarButton({ on, onClick, name }: { on: boolean; onClick: () => void; name: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition hover:bg-tint ${
        on ? "text-ochre" : "text-muted"
      }`}
    >
      <Star className="h-5 w-5" fill={on ? "currentColor" : "none"} />
    </button>
  );
}
