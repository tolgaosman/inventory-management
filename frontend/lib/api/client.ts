// A thin "network" simulation layer sitting in front of the in-memory mock
// data. Every page talks to this layer, never to lib/mock directly — when a
// real backend exists, only this file (and its per-entity siblings) change.
import type { PagedQuery, PagedResult } from "@/lib/types";

const LATENCY_MS = 380;

export function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "FORBIDDEN" | "UNKNOWN" = "UNKNOWN",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function paginate<T>(rows: T[], query: PagedQuery): PagedResult<T> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export function normalizeSearchString(str: string): string {
  return str
    .toLowerCase()
    .replace(/i/g, "i")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c");
}

export function matchesSearch(haystacks: (string | undefined)[], term: string | undefined): boolean {
  if (!term) return true;
  const rawNeedle = term.trim();
  if (!rawNeedle) return true;

  const needleLower = rawNeedle.toLowerCase();
  const needleNorm = normalizeSearchString(rawNeedle);

  return haystacks.some((h) => {
    if (!h) return false;
    const hLower = h.toLowerCase();
    const hNorm = normalizeSearchString(h);
    return hLower.includes(needleLower) || hNorm.includes(needleNorm);
  });
}
