import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PLAY_INTERVAL_MS, REPLAY_DATES } from "@/lib/coach/replay";

interface ReplayState {
  dates: string[];
  date: string;
  index: number;
  playing: boolean;
  setDate: (date: string) => void;
  step: (delta: number) => void;
  togglePlay: () => void;
}

const ReplayContext = createContext<ReplayState | null>(null);
const STORAGE_KEY = "store-coach:replay-date";
const LAST = REPLAY_DATES[REPLAY_DATES.length - 1] ?? "2026-10-31";

export function ReplayProvider({ children }: { children: ReactNode }) {
  const dates = REPLAY_DATES;
  const [date, setDateState] = useState<string>(LAST);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved && dates.includes(saved)) setDateState(saved);
  }, [dates]);

  const setDate = useCallback(
    (next: string) => {
      if (!dates.includes(next)) return;
      setDateState(next);
      window.sessionStorage.setItem(STORAGE_KEY, next);
    },
    [dates],
  );

  const index = dates.indexOf(date);

  const step = useCallback(
    (delta: number) => {
      const next = dates[Math.min(dates.length - 1, Math.max(0, index + delta))];
      if (next) setDate(next);
    },
    [dates, index, setDate],
  );

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && index >= dates.length - 1) {
        // Restart from the first run when pressing Play at the end.
        const first = dates[0];
        if (first) setDate(first);
      }
      return !p;
    });
  }, [dates, index, setDate]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setDateState((current) => {
        const i = dates.indexOf(current);
        const next = dates[i + 1];
        if (!next) {
          setPlaying(false);
          return current;
        }
        window.sessionStorage.setItem(STORAGE_KEY, next);
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, dates]);

  const value = useMemo(
    () => ({ dates, date, index, playing, setDate, step, togglePlay }),
    [dates, date, index, playing, setDate, step, togglePlay],
  );
  return <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>;
}

export function useReplay(): ReplayState {
  const ctx = useContext(ReplayContext);
  if (!ctx) throw new Error("useReplay must be used inside ReplayProvider");
  return ctx;
}
