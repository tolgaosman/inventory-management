// The HTTP layer in front of the Laravel API. Every page talks to lib/api/*,
// never to fetch directly — so the base URL, auth header, and error mapping all
// live here.
export const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "");

const TOKEN_KEY = "net_auth_token";
/** Mirrored into a cookie so middleware.ts can gate routes before React runs. */
const TOKEN_COOKIE = "net_auth_token";

export type ApiErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "FORBIDDEN" | "PASSWORD_CHANGE_REQUIRED" | "UNKNOWN";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode = "UNKNOWN",
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/** Adding ";Secure" on plain http would make browsers refuse to store the cookie at all — only send it once the page is actually served over https. */
function secureAttr(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  // Session-length cookie; the API token itself is what actually authorizes.
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax${secureAttr()}`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_COOKIE}=; path=/; Max-Age=0; SameSite=Lax${secureAttr()}`;
}

/** Laravel returns {message, code}; anything else falls back to a status-derived code. */
function codeForStatus(status: number): ApiErrorCode {
  if (status === 404) return "NOT_FOUND";
  if (status === 422 || status === 429) return "VALIDATION";
  if (status === 409) return "CONFLICT";
  if (status === 401 || status === 403) return "FORBIDDEN";
  return "UNKNOWN";
}

export type QueryValue = string | number | boolean | undefined | null;

/** Drops undefined/null/"" so callers can pass optional filters straight through. */
export function buildQuery(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Sent through to the backend so a retried mutation doesn't post twice. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, query, idempotencyKey, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    if (body instanceof FormData) {
      // browser fetch sets multipart/form-data with the correct boundary automatically
    } else {
      headers["Content-Type"] = "application/json";
    }
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body)),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.", "UNKNOWN", 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = payload as { message?: string; code?: ApiErrorCode } | null;

    // An expired or revoked token should drop the session rather than leave the
    // user clicking through a UI that will 401 on every request.
    if (response.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (!window.location.pathname.startsWith("/giris")) {
        window.location.href = "/giris";
      }
    }

    throw new ApiError(
      data?.message || "Beklenmeyen bir hata oluştu.",
      data?.code ?? codeForStatus(response.status),
      response.status,
    );
  }

  return payload as T;
}

/** Generates the key used to make double-submitted mutations safe. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// --- Mock helpers for frontend-only data ---
export const delay = <T>(data: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export function paginate<T>(items: T[], query: { page?: number; pageSize?: number }) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 10;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

export function matchesSearch(fields: (string | undefined | null)[], query?: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(lower));
}

