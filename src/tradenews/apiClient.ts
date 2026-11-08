/**
 * Minimal typed HTTP client for the TradeNews Cloudflare backend.
 *
 * Rules:
 * - Never fabricate balances, positions, prices or history.
 * - Surface backend errors / disabled endpoints as typed failures.
 * - Attach Bearer auth token when present (AuthContext store).
 */
import { TRADENEWS_API_BASE, TRADENEWS_API_TIMEOUT_MS } from "./config.ts";

export type ApiFailureKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "disabled"
  | "validation"
  | "server"
  | "unknown";

export interface ApiFailure {
  ok: false;
  kind: ApiFailureKind;
  status: number;
  message: string;
  endpointDisabled: boolean;
  raw?: unknown;
}

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export function getStoredAuthToken(): string | null {
  try {
    return (
      localStorage.getItem("tradenews_auth_token") ||
      sessionStorage.getItem("tradenews_auth_token")
    );
  } catch {
    return null;
  }
}

export function endpointLooksDisabled(status: number, body: any): boolean {
  if (status === 404 || status === 501 || status === 405) return true;
  const msg = String(body?.error || body?.message || "").toLowerCase();
  return (
    msg.includes("not enabled") ||
    msg.includes("disabled") ||
    msg.includes("not implemented") ||
    msg.includes("not supported") ||
    msg.includes("financial_operations_disabled") ||
    msg.includes("financial operations are disabled")
  );
}

function failure(status: number, message: string, raw?: unknown): ApiFailure {
  let kind: ApiFailureKind = "unknown";
  if (status === 0) kind = "network";
  else if (status === 401) kind = "unauthorized";
  else if (status === 403) kind = "forbidden";
  else if (status === 404) kind = "not_found";
  else if (status === 408) kind = "timeout";
  else if (status === 422 || status === 400) kind = "validation";
  else if (status >= 500) kind = "server";
  const disabled = endpointLooksDisabled(status, raw);
  return {
    ok: false,
    kind: disabled ? "disabled" : kind,
    status,
    message,
    endpointDisabled: disabled,
    raw,
  };
}

async function parseBody(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 500) };
    }
  } catch {
    return null;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

function joinPath(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(b)) {
    // If base already ends with /api, keep it; otherwise append path as-is.
    return `${b}${p}`;
  }
  return `${b}${p}`;
}

export async function tradenewsFetch<T = any>(
  path: string,
  opts: RequestOptions = {}
): Promise<ApiResult<T>> {
  const url = joinPath(TRADENEWS_API_BASE, path);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TRADENEWS_API_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (opts.auth !== false) {
      const token = getStoredAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body,
      signal: opts.signal || controller.signal,
    });
    const parsed = await parseBody(res);
    if (!res.ok) {
      const message =
        String(parsed?.error || parsed?.message || `Request failed (${res.status})`) ||
        `Request failed (${res.status})`;
      return failure(res.status, message, parsed);
    }
    return { ok: true, data: (parsed?.data !== undefined ? parsed.data : parsed) as T };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return failure(408, "Request timed out. Backend did not respond in time.");
    }
    return failure(0, "Network error: cannot reach the TradeNews backend.");
  } finally {
    window.clearTimeout(timer);
  }
}

export function unavailableMessage(service: string): string {
  return `${service} is unavailable: the TradeNews backend endpoint is disabled or missing. No simulated data is shown.`;
}
