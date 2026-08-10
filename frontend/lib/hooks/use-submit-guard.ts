"use client";

import { useRef, useState } from "react";

/**
 * Prevents a double click / double submit from firing the handler twice
 * while a previous call is still in flight, and hands out a stable
 * idempotency key per in-flight attempt for the mock API's dedup logic.
 */
export function useSubmitGuard() {
  const [pending, setPending] = useState(false);
  const keyRef = useRef<string | null>(null);

  function nextIdempotencyKey() {
    if (!keyRef.current) {
      keyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return keyRef.current;
  }

  async function guard<T>(fn: (idempotencyKey: string) => Promise<T>): Promise<T | undefined> {
    if (pending) return undefined;
    setPending(true);
    try {
      const result = await fn(nextIdempotencyKey());
      keyRef.current = null;
      return result;
    } finally {
      setPending(false);
    }
  }

  return { pending, guard };
}
