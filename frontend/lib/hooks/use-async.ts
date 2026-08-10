"use client";

import { useEffect, useState } from "react";

export type AsyncStatus = "loading" | "success" | "error";

interface AsyncState<T> {
  status: AsyncStatus;
  data?: T;
  error?: Error;
  /** Last successfully loaded data, kept around while a refetch is in flight. */
  staleData?: T;
}

/**
 * Runs `fn` whenever `deps` change and exposes loading/error/success state.
 * On refetch, the previous data is kept (as `staleData`) instead of flashing
 * a skeleton, per the "no skeleton flash on refetch" rule.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList): {
  status: AsyncStatus;
  data: T | undefined;
  staleData: T | undefined;
  error: Error | undefined;
  refetch: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Flagging "loading" the instant deps change (rather than only after the
    // fetch settles) is the standard data-fetching effect shape — see
    // https://react.dev/learn/synchronizing-with-effects#fetching-data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({
      status: "loading",
      staleData: prev.status === "success" ? prev.data : prev.staleData,
    }));
    fn()
      .then((data) => {
        if (cancelled) return;
        setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return {
    status: state.status,
    data: state.data,
    staleData: state.status === "loading" ? state.staleData : undefined,
    error: state.error,
    refetch: () => setTick((t) => t + 1),
  };
}
