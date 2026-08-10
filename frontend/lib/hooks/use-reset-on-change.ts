"use client";

import { useState } from "react";

/**
 * Detects that `key` changed since the previous render — the "adjust state
 * while rendering" pattern from react.dev/learn/you-might-not-need-an-effect
 * — used to reset dependent state (e.g. pagination) without an effect.
 * Uses state rather than a ref so the comparison stays safe to read during
 * render.
 */
export function useChangedSince(key: unknown): boolean {
  const [prevKey, setPrevKey] = useState(key);
  const changed = !Object.is(prevKey, key);
  if (changed) setPrevKey(key);
  return changed;
}
