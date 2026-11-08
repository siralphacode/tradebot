import { tradenewsFetch, ApiResult } from "./apiClient.ts";
import type { TradeHistoryRecord, ReferralInfo, WalletRecord } from "./api.ts";

export interface PositionRecord {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  markPrice?: number;
  sizeUsdt: number;
  leverage: number;
  pnlUsdt?: number;
  status: string;
  createdAt?: string | number;
  raw?: unknown;
}

export interface TradingSignal {
  id?: string;
  symbol: string;
  direction: string;
  entry?: number;
  targets?: number[];
  stopLoss?: number;
  confidence?: number;
  timeframe?: string;
  createdAt?: string | number;
  raw?: unknown;
}

export function getSignals(symbol?: string): Promise<ApiResult<TradingSignal[]>> {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  return tradenewsFetch<TradingSignal[]>(`/signals${q}`);
}

export function getDemoBalance(): Promise<ApiResult<{ balance: number; raw?: unknown }>> {
  return tradenewsFetch("/demo/balance");
}

export function getDemoPositions(): Promise<ApiResult<PositionRecord[]>> {
  return tradenewsFetch<PositionRecord[]>("/demo/positions");
}

export function openDemoPosition(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  sizeUsdt: number;
  leverage: number;
}): Promise<ApiResult<PositionRecord>> {
  return tradenewsFetch<PositionRecord>("/demo/positions", {
    method: "POST",
    body: input,
  });
}

export function closeDemoPosition(
  positionId: string
): Promise<ApiResult<{ closed: boolean }>> {
  return tradenewsFetch(`/demo/positions/${encodeURIComponent(positionId)}/close`, {
    method: "POST",
  });
}

export function getPositionHistory(): Promise<ApiResult<TradeHistoryRecord[]>> {
  return tradenewsFetch<TradeHistoryRecord[]>("/positions/history");
}

export function getTradeHistory(): Promise<ApiResult<TradeHistoryRecord[]>> {
  return tradenewsFetch<TradeHistoryRecord[]>("/trades/history");
}

export function getReferralInfo(): Promise<ApiResult<ReferralInfo>> {
  return tradenewsFetch<ReferralInfo>("/referrals/me");
}

export function applyReferralCode(code: string): Promise<ApiResult<ReferralInfo>> {
  return tradenewsFetch<ReferralInfo>("/referrals/apply", {
    method: "POST",
    body: { code },
  });
}

export function listWallets(): Promise<ApiResult<WalletRecord[]>> {
  return tradenewsFetch<WalletRecord[]>("/wallets");
}

export function linkWallet(
  address: string,
  chain?: string
): Promise<ApiResult<WalletRecord>> {
  return tradenewsFetch<WalletRecord>("/wallets/link", {
    method: "POST",
    body: { address, chain },
  });
}

export function getTradingAccount(): Promise<ApiResult<{ balance: number; raw?: unknown }>> {
  return tradenewsFetch("/account/balance");
}
