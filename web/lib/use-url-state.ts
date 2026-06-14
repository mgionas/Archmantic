"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A single URL search-param as state, without a full navigation: reads on mount
 * (client-only, so no SSR hydration mismatch), writes via history.replaceState,
 * and syncs on back/forward. Use for shareable, refresh-safe view state.
 */
export function useUrlState(key: string, initial = ""): [string, (v: string) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const read = () => setValue(new URLSearchParams(window.location.search).get(key) ?? initial);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [key, initial]);

  const set = useCallback(
    (v: string) => {
      setValue(v);
      const params = new URLSearchParams(window.location.search);
      if (v) params.set(key, v);
      else params.delete(key);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [key],
  );

  return [value, set];
}
