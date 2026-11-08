/**
 * TradeNews Platform Configuration — Cloudflare backend integration.
 *
 * Production:
 *   Website: https://tradenews.live
 *   API:     https://api.tradenews.live
 *
 * FINANCIAL SAFETY:
 *   FINANCIAL_OPERATIONS_ENABLED must remain false unless explicitly
 *   enabled by the owner through the deployment environment.
 *   Real-money deposit / withdraw / live trading endpoints stay disabled
 *   in the UI regardless of backend capability.
 */

export const TRADENEWS = {
  brand: "TradeNews",
  productionSite: "https://tradenews.live",
  productionApi: "https://api.tradenews.live",
} as const;

/** Global kill-switch for real-money financial operations. DO NOT ENABLE without owner approval. */
export const FINANCIAL_OPERATIONS_ENABLED: boolean =
  (import.meta as any)?.env?.VITE_FINANCIAL_OPERATIONS_ENABLED === "true"
    ? true
    : false;

function normalizeBase(raw: string | undefined | null): string {
  const v = (raw || "").trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

function resolveApiBase(): string {
  // Highest priority: explicit build-time env (Vite)
  const envBase =
    (import.meta as any)?.env?.VITE_TRADENEWS_API_BASE ||
    (import.meta as any)?.env?.VITE_API_BASE ||
    "";
  if (envBase) return normalizeBase(String(envBase));

  // Runtime override (injected by Cloudflare Pages / Worker / _headers / inline script)
  try {
    const w = window as any;
    if (w && typeof w.__TRADENEWS_API_BASE__ === "string" && w.__TRADENEWS_API_BASE__) {
      return normalizeBase(w.__TRADENEWS_API_BASE__);
    }
    if (w && typeof w.__API_BASE__ === "string" && w.__API_BASE__) {
      return normalizeBase(w.__API_BASE__);
    }
  } catch {
    /* noop */
  }

  // Sensible default: same-origin /api (Cloudflare Worker routes /api/* → backend).
  // In production this resolves to https://tradenews.live/api which the
  // Cloudflare Worker proxies to the D1 backend / api.tradenews.live.
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin.replace(/\/+$/, "")}/api`;
    }
  } catch {
    /* noop */
  }
  return "/api";
}

export const TRADENEWS_API_BASE: string = resolveApiBase();

/** True when the configured API base points at the production Cloudflare backend. */
export function isProductionApi(): boolean {
  const b = TRADENEWS_API_BASE.toLowerCase();
  return b.includes("api.tradenews.live") || b.includes("tradenews.live/api");
}

export const TRADENEWS_API_TIMEOUT_MS = 12000;

/** Cloudflare Turnstile site key (frontend). Backend verifies tokens server-side. */
export const TURNSTILE_SITE_KEY: string =
  String((import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY || "").trim();
