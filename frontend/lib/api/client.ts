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

export function matchesSearch(haystacks: (string | undefined)[], term: string | undefined): boolean {
  if (!term) return true;
  const needle = term.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return true;
  return haystacks.some((h) => h?.toLocaleLowerCase("tr-TR").includes(needle));
}
