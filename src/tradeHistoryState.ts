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

export const INITIAL_SEED_TRADES: GlobalTradeRecord[] = [
  {
    id: "tr-seed-1",
    timestamp: Date.now() - 1000 * 60 * 18,
    source: "Satoshi Alpha Macro",
    symbol: "BTC/USDT",
    side: "LONG",
    entryPrice: 82950.0,
    exitPrice: 84120.0,
    sizeUsdt: 500.0,
    leverage: 10,
    pnlUsdt: 70.52,
    pnlPct: 14.1,
    exitReason: "Take Profit 2 Hit ($84,120.00)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-2",
    timestamp: Date.now() - 1000 * 60 * 42,
    source: "Apex Scalper 15M",
    symbol: "ETH/USDT",
    side: "LONG",
    entryPrice: 3385.5,
    exitPrice: 3432.0,
    sizeUsdt: 350.0,
    leverage: 12,
    pnlUsdt: 57.82,
    pnlPct: 16.5,
    exitReason: "Take Profit 1 Hit ($3,432.00)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-3",
    timestamp: Date.now() - 1000 * 60 * 75,
    source: "Quantum L1 Momentum",
    symbol: "SOL/USDT",
    side: "LONG",
    entryPrice: 114.2,
    exitPrice: 119.8,
    sizeUsdt: 400.0,
    leverage: 15,
    pnlUsdt: 294.22,
    pnlPct: 73.5,
    exitReason: "Take Profit 3 Hit ($119.80)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-4",
    timestamp: Date.now() - 1000 * 60 * 120,
    source: "Meme Velocity AI",
    symbol: "DOGE/USDT",
    side: "SHORT",
    entryPrice: 0.1695,
    exitPrice: 0.1624,
    sizeUsdt: 200.0,
    leverage: 10,
    pnlUsdt: 83.77,
    pnlPct: 41.8,
    exitReason: "Take Profit 2 Hit ($0.1624)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-5",
    timestamp: Date.now() - 1000 * 60 * 165,
    source: "DeFi Infrastructure Titan",
    symbol: "LINK/USDT",
    side: "LONG",
    entryPrice: 12.35,
    exitPrice: 12.92,
    sizeUsdt: 300.0,
    leverage: 10,
    pnlUsdt: 138.46,
    pnlPct: 46.1,
    exitReason: "Take Profit 4 Hit ($12.92)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-6",
    timestamp: Date.now() - 1000 * 60 * 210,
    source: "HyperWave Multi-Target",
    symbol: "SUI/USDT",
    side: "SHORT",
    entryPrice: 2.24,
    exitPrice: 2.27,
    sizeUsdt: 250.0,
    leverage: 10,
    pnlUsdt: -33.48,
    pnlPct: -13.3,
    exitReason: "Stop Loss Hit ($2.27)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-7",
    timestamp: Date.now() - 1000 * 60 * 280,
    source: "Solana Surge AI",
    symbol: "SOL/USDT",
    side: "LONG",
    entryPrice: 112.5,
    exitPrice: 117.4,
    sizeUsdt: 500.0,
    leverage: 12,
    pnlUsdt: 261.33,
    pnlPct: 52.2,
    exitReason: "Take Profit 2 Hit ($117.40)",
    status: "CLOSED",
  },
  {
    id: "tr-seed-8",
    timestamp: Date.now() - 1000 * 60 * 360,
    source: "Atlas Universal Crypto Basket",
    symbol: "BTC/USDT",
    side: "LONG",
    entryPrice: 81800.0,
    exitPrice: 83200.0,
    sizeUsdt: 1000.0,
    leverage: 10,
    pnlUsdt: 171.14,
    pnlPct: 17.1,
    exitReason: "Take Profit 1 Hit ($83,200.00)",
    status: "CLOSED",
  },
];

export function loadGlobalTradeHistory(): GlobalTradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_SEED_TRADES;
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
