"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { requestJson } from "@/lib/http";

/**
 * List state kept in the URL (so refresh, links and Back keep your place).
 * `defaults` lists the params and their default values; defaults are left
 * out of the URL.
 */
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = Object.fromEntries(
    (Object.keys(defaults) as K[]).map((k) => [k, searchParams.get(k) ?? defaults[k]]),
  ) as Record<K, string>;

  const defaultsRef = React.useRef(defaults);
  const update = React.useCallback(
    (next: Partial<Record<K, string | number>>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next) as [K, string | number | undefined][]) {
        if (v === undefined) continue;
        const value = String(v);
        if (value === "" || value === defaultsRef.current[k]) params.delete(k);
        else params.set(k, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [values, update] as const;
}

/** Search box text that commits to the URL after a short pause. */
export function useSearchBox(q: string, commit: (q: string) => void, delay = 300) {
  const [text, setText] = React.useState(q);
  // Follow outside changes (e.g. "Clear filters", Back button).
  const [lastQ, setLastQ] = React.useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    if (q !== text.trim()) setText(q);
  }

  const commitRef = React.useRef(commit);
  React.useEffect(() => {
    commitRef.current = commit;
  });

  React.useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => commitRef.current(text.trim()), delay);
    return () => clearTimeout(t);
  }, [text, q, delay]);

  return [text, setText] as const;
}

export function useSessionExpired() {
  const router = useRouter();
  return React.useCallback(() => {
    router.replace("/login?expired=1");
    router.refresh();
  }, [router]);
}

type Loaded<T> = { key: string; data: T } | { key: string; error: string };

/** Fetches a list endpoint whenever `url` changes (or `reload()` is called). */
export function useRemoteList<T>(url: string, onLoaded?: (data: T) => void) {
  const sessionExpired = useSessionExpired();
  const [reloadKey, setReloadKey] = React.useState(0);
  const [loaded, setLoaded] = React.useState<Loaded<T> | null>(null);
  const requestKey = `${url}#${reloadKey}`;

  const onLoadedRef = React.useRef(onLoaded);
  React.useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  React.useEffect(() => {
    const controller = new AbortController();
    requestJson<T & Record<string, unknown>>("GET", url, undefined, { signal: controller.signal })
      .then((res) => {
        if (res.ok) {
          setLoaded({ key: requestKey, data: res as T });
          onLoadedRef.current?.(res as T);
        } else if (res.code === "SESSION_EXPIRED") {
          sessionExpired();
        } else {
          setLoaded({ key: requestKey, error: res.error });
        }
      })
      .catch(() => {
        // Aborted by a newer request.
      });
    return () => controller.abort();
  }, [url, requestKey, sessionExpired]);

  const loading = loaded?.key !== requestKey;
  return {
    data: loaded && "data" in loaded ? loaded.data : null,
    error: loaded && "error" in loaded && !loading ? loaded.error : null,
    loading,
    reload: React.useCallback(() => setReloadKey((k) => k + 1), []),
  };
}
