export interface GlobalTradeRecord {
  id: string;
  timestamp: number;
  source: string; // e.g. "Satoshi Alpha Macro", "Manual Signal Scope", "Quantum L1"
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  sizeUsdt: number;
  leverage: number;
  pnlUsdt: number;
  pnlPct: number;
  exitReason: string;
  status: "FILLED" | "CLOSED";
}

const STORAGE_KEY = "tradenews_global_trade_history_v1";

export const INITIAL_SEED_TRADES: GlobalTradeRecord[] = [];

// Legacy seed trades removed: the UI must never display fabricated history.
// Real history is loaded from the TradeNews Cloudflare backend at runtime.
// localStorage entries written by older builds are treated as a local
// demo-trade journal only and are NOT presented as exchange history.

export function loadGlobalTradeHistory(): GlobalTradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveGlobalTradeHistory(history: GlobalTradeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

export function addGlobalTradeRecord(record: GlobalTradeRecord): GlobalTradeRecord[] {
  const current = loadGlobalTradeHistory();
  const updated = [record, ...current].slice(0, 200);
  saveGlobalTradeHistory(updated);
  return updated;
}
