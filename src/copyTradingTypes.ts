export interface CryptoBasketItem {
  symbol: string;
  name: string;
  weightPct: number; // e.g. 40 for 40%
}

export interface CopyTradePosition {
  id: string;
  botId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  sizeUsdt: number; // Allocated Margin in USDT
  leverage: number;
  notionalUsdt: number; // sizeUsdt * leverage
  quantity: number; // Nominal crypto coins
  stopLoss: number;
  takeProfit: number;
  tpLevels: number[]; // TP1 to TP7
  highestTpReached: number; // 0 to 7
  pnlUsdt: number;
  pnlPct: number;
  openedAt: number;
  timeframe: string;
  signalReason: string;
  liquidationPrice?: number;
}

export interface CopyTradeRecord {
  id: string;
  botId: string;
  botName: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  sizeUsdt: number;
  leverage: number;
  pnlUsdt: number;
  pnlPct: number;
  exitReason: string; // e.g., "TP1 Reached (+12.4%)", "TP3 Reached", "Stop Loss Hit", "Manual Close"
  openedAt: number;
  closedAt: number;
  durationSeconds: number;
}

export type StrategyCategory =
  | "Trend Following"
  | "High-Frequency Scalp"
  | "Multi-Target Runner"
  | "Momentum Breakout"
  | "Meme & Volatility";

export interface BotTrader {
  id: string;
  name: string;
  alias: string;
  avatarColor: string;
  avatarIcon: string;
  tagline: string;
  description: string;
  category: StrategyCategory;
  // Historical Track Record
  winRate: number; // e.g., 82.4%
  roi30d: number; // e.g., +158.5%
  allTimePnlUsdt: number; // e.g., 64200
  maxDrawdownPct: number; // e.g., 5.4%
  followersCount: number;
  riskRating: number; // 1 (lowest) to 10 (highest)
  tradingDaysActive: number;
  // Configuration Limits
  minInvestmentUsdt: number; // e.g., 50
  maxInvestmentUsdt: number; // e.g., 25000
  defaultLeverage: number; // e.g., 10
  allowedLeverages: number[]; // [5, 10, 20, 30, 50]
  preferredTimeframe: "1m" | "5m" | "15m" | "1h" | "4h";
  basket: CryptoBasketItem[];
  // Active State & Real-time Live Counters ("کنتر انداختن")
  status: "IDLE" | "RUNNING" | "PAUSED";
  allocatedCapital: number;
  selectedLeverage: number;
  startedAt: number | null; // Timestamp when Start Bot was clicked
  elapsedSeconds: number; // Active runtime in seconds
  totalTradesCount: number;
  winningTradesCount: number;
  losingTradesCount: number;
  realizedPnlUsdt: number;
  unrealizedPnlUsdt: number;
  openPositions: CopyTradePosition[];
  recentTrades: CopyTradeRecord[];
}
