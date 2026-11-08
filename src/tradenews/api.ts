/**
 * TradeNews backend API surface (Cloudflare Workers + D1).
 * Real backend endpoints only — never synthesize data here.
 */
import { tradenewsFetch, ApiResult } from "./apiClient.ts";

export interface BackendUser {
  id: string | number;
  email?: string;
  username?: string;
  wallet?: string | null;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  user: BackendUser;
}

export interface MarketTicker {
  symbol: string;
  base?: string;
  name?: string;
  decimals?: number;
  price: number;
  priceChangePercent?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  source?: string;
}

export interface MarketKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeHistoryRecord {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice?: number;
  sizeUsdt: number;
  leverage?: number;
  pnlUsdt?: number;
  pnlPct?: number;
  status: string;
  timestamp: number;
  source?: string;
  exitReason?: string;
  raw?: unknown;
}

export interface ReferralInfo {
  code: string;
  referredBy?: string | null;
  referralCount?: number;
  rewardsUsdt?: number;
  raw?: unknown;
}

export interface WalletRecord {
  address: string;
  chain?: string;
  verified?: boolean;
  raw?: unknown;
}

export function authRegister(input: {
  email: string;
  password: string;
  turnstileToken?: string;
  referralCode?: string;
}): Promise<ApiResult<AuthSession>> {
  return tradenewsFetch<AuthSession>("/auth/register", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export function authLogin(input: {
  email: string;
  password: string;
  turnstileToken?: string;
}): Promise<ApiResult<AuthSession>> {
  return tradenewsFetch<AuthSession>("/auth/login", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export function authMe(): Promise<ApiResult<BackendUser>> {
  return tradenewsFetch<BackendUser>("/auth/me", { method: "GET" });
}

export function getTickers(): Promise<ApiResult<MarketTicker[]>> {
  return tradenewsFetch<MarketTicker[]>("/market/tickers");
}

export function getKlines(
  symbol: string,
  interval: string,
  limit = 120
): Promise<ApiResult<MarketKline[]>> {
  return tradenewsFetch(
    `/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
      interval
    )}&limit=${limit}`
  );
}
