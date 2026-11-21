import { useCallback, useEffect, useState } from "react";

/** A status chip persisted in localStorage (Mark done / Dismiss / Done / Not today). */
export function useLocalStatus<T extends string>(key: string) {
  const storageKey = `store-coach:status:${key}`;
  const [status, setStatusState] = useState<T | null>(null);

  useEffect(() => {
    setStatusState((window.localStorage.getItem(storageKey) as T | null) ?? null);
  }, [storageKey]);

  const setStatus = useCallback(
    (next: T | null) => {
      setStatusState(next);
      if (next) window.localStorage.setItem(storageKey, next);
      else window.localStorage.removeItem(storageKey);
    },
    [storageKey],
  );

  return [status, setStatus] as const;
}
