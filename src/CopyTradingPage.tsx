import React, { useState, useEffect, useMemo } from "react";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Sliders,
  TrendingUp,
  TrendingDown,
  Layers,
  Shield,
  Activity,
  Zap,
  Clock,
  DollarSign,
  PieChart,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";
import {
  BotTrader,
  CryptoBasketItem,
  StrategyCategory,
} from "./copyTradingTypes.ts";
import {
  loadStoredBots,
  saveStoredBots,
  formatSecondsToClock,
  INITIAL_20_BOTS,
  setLastActiveBotId,
} from "./copyTradingData.ts";
import {
  addGlobalTradeRecord as _addGlobalTradeRecord_Unused,
} from "./tradeHistoryState.ts";
import { loadStoredWallet as _loadStoredWallet_Unused } from "./walletState.ts";
import { FINANCIAL_OPERATIONS_ENABLED } from "./tradenews/config.ts";
import { CryptoLogo } from "./cryptoLogos.tsx";

interface CryptoTicker {
  symbol: string;
  base: string;
  name: string;
  decimals: number;
  price: number;
  priceChangePercent: number;
}

interface CopyTradingPageProps {
  tickers: CryptoTicker[];
  onSelectCoinForChart: (symbol: string) => void;
  onNotify: (msg: string) => void;
}

export function CopyTradingPage({
  tickers,
  onSelectCoinForChart,
  onNotify,
}: CopyTradingPageProps) {
  const [bots, setBots] = useState<BotTrader[]>(() => loadStoredBots());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"ROI" | "WIN_RATE" | "PNL" | "ACTIVE">("ROI");

  void tickers;
  // Selected bot for drawer modal
  const [inspectedBotId, setInspectedBotId] = useState<string | null>(null);

  // Price map lookup (reference only — simulation engine removed)
  const priceMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    tickers.forEach((t) => {
      map[t.symbol] = t.price;
    });
    return map;
  }, [tickers]);

  // Persist bots state whenever it updates
  useEffect(() => {
    saveStoredBots(bots);
  }, [bots]);


  // SAFETY: live simulation engine removed. Bots are a strategy directory only.
  // No fills are invented, no wallet is debited/credited here. Live copy
  // trading stays disabled until the backend supports it and the owner
  // enables financial operations.
  void priceMap;
  void FINANCIAL_OPERATIONS_ENABLED;

  // Start / Stop Bot Handler (display-only; never moves funds)
  const handleToggleBot = (botId: string) => {
    setLastActiveBotId(botId);
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        if (b.status === "RUNNING") {
          onNotify(`Bot "${b.name}" stopped (display only — no funds moved).`);
          return { ...b, status: "IDLE", openPositions: [] };
        } else {
          onNotify(
            `Bot "${b.name}" marked running (display only). Live copy trading is disabled in this build.`
          );
          return {
            ...b,
            status: "RUNNING",
            startedAt: b.startedAt || Date.now(),
          };
        }
      })
    );
  };

  // Pause Bot Handler
  const handlePauseBot = (botId: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        const newStatus = b.status === "PAUSED" ? "RUNNING" : "PAUSED";
        onNotify(`Bot "${b.name}" ${newStatus === "PAUSED" ? "paused" : "resumed"}.`);
        return { ...b, status: newStatus };
      })
    );
  };

  // Reset Bot Stats Handler
  const handleResetBot = (botId: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        onNotify(`Bot "${b.name}" counters reset.`);
        return {
          ...b,
          status: "IDLE",
          elapsedSeconds: 0,
          startedAt: null,
          totalTradesCount: 0,
          winningTradesCount: 0,
          losingTradesCount: 0,
          realizedPnlUsdt: 0,
          unrealizedPnlUsdt: 0,
          openPositions: [],
          recentTrades: [],
        };
      })
    );
  };

  // Update Bot Capital Allocation
  const handleUpdateCapital = (botId: string, amount: number) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        const clamped = Math.max(
          b.minInvestmentUsdt,
          Math.min(b.maxInvestmentUsdt, amount)
        );
        return { ...b, allocatedCapital: clamped };
      })
    );
  };

  // Update Bot Leverage
  const handleUpdateLeverage = (botId: string, lev: number) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        return { ...b, selectedLeverage: lev };
      })
    );
  };

  // Manually close an open position (display-only; no funds move)
  const handleClosePosition = (botId: string, posId: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== botId) return b;
        const targetPos = b.openPositions.find((p) => p.id === posId);
        if (!targetPos) return b;

        void _addGlobalTradeRecord_Unused;
        void _loadStoredWallet_Unused;
        onNotify(`Closed ${targetPos.symbol} display position. No funds moved.`);

        return {
          ...b,
          openPositions: b.openPositions.filter((p) => p.id !== posId),
        };
      })
    );
  };

  // Start All Top 5 Bots
  const handleStartAllTop = () => {
    setBots((prev) =>
      prev.map((b, idx) => {
        if (idx < 5) {
          return {
            ...b,
            status: "RUNNING",
            startedAt: b.startedAt || Date.now(),
          };
        }
        return b;
      })
    );
    onNotify("Started top 5 elite AI bots simultaneously.");
  };

  // Stop All Active Bots
  const handleStopAll = () => {
    setBots((prev) =>
      prev.map((b) => ({
        ...b,
        status: "IDLE",
      }))
    );
    onNotify("All active bots paused.");
  };

  // Reset Everything to Factory State
  const handleFactoryReset = () => {
    if (window.confirm("Reset all 20 AI copy trading bots to default state?")) {
      setBots(INITIAL_20_BOTS);
      saveStoredBots(INITIAL_20_BOTS);
      onNotify("All 20 bots reset to factory configuration.");
    }
  };

  // Top Global Metrics Calculation
  const globalMetrics = useMemo(() => {
    const runningBots = bots.filter((b) => b.status === "RUNNING");
    const totalAllocated = bots.reduce((sum, b) => sum + b.allocatedCapital, 0);
    const totalRealizedPnl = bots.reduce((sum, b) => sum + b.realizedPnlUsdt, 0);
    const totalUnrealizedPnl = bots.reduce((sum, b) => sum + b.unrealizedPnlUsdt, 0);
    const totalTrades = bots.reduce((sum, b) => sum + b.totalTradesCount, 0);
    const totalWins = bots.reduce((sum, b) => sum + b.winningTradesCount, 0);
    const globalWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 81.2;

    return {
      runningCount: runningBots.length,
      totalBots: bots.length,
      totalAllocated,
      totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
      totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      totalPnl: Math.round((totalRealizedPnl + totalUnrealizedPnl) * 100) / 100,
      totalTrades,
      globalWinRate: Math.round(globalWinRate * 10) / 10,
    };
  }, [bots]);

  // Filtering & Sorting
  const filteredBots = useMemo(() => {
    let result = bots.filter((bot) => {
      // Search query (bot name, alias, coins in basket)
      const q = searchQuery.toLowerCase().trim();
      const matchName = bot.name.toLowerCase().includes(q) || bot.alias.toLowerCase().includes(q);
      const matchCoin = bot.basket.some(
        (b) => b.symbol.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)
      );
      if (q && !matchName && !matchCoin) return false;

      // Category filter
      if (selectedCategory === "ACTIVE" && bot.status !== "RUNNING") return false;
      if (
        selectedCategory !== "ALL" &&
        selectedCategory !== "ACTIVE" &&
        bot.category !== selectedCategory
      ) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "ROI") return b.roi30d - a.roi30d;
      if (sortBy === "WIN_RATE") return b.winRate - a.winRate;
      if (sortBy === "PNL") return b.allTimePnlUsdt - a.allTimePnlUsdt;
      if (sortBy === "ACTIVE") {
        const order = { RUNNING: 0, PAUSED: 1, IDLE: 2 };
        return order[a.status] - order[b.status];
      }
      return 0;
    });

    return result;
  }, [bots, searchQuery, selectedCategory, sortBy]);

  const inspectedBot = useMemo(
    () => bots.find((b) => b.id === inspectedBotId) || null,
    [bots, inspectedBotId]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] text-[#f1f5f9] overflow-y-auto select-none">
      {/* 1. TOP PORTFOLIO OVERVIEW & LIVE AGGREGATE STRIP */}
      <section className="border-b border-[#161d2c] bg-[#090c13] px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Left: Summary Title & Live Counters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  AI Copy Traders & Bot Matrix
                </h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300">
                  20 Live Bots
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>Fed directly by TATS PRO v1.0 6-EMA Signals</span>
                <span aria-hidden="true">·</span>
                <span>Internal Execution Simulator</span>
                <span aria-hidden="true">·</span>
                <span>Zero-Latency Multi-Target Matching</span>
              </div>
            </div>

            {/* Quick Metrics KPIs */}
            <div className="flex items-center gap-5 border-l border-slate-800/80 pl-6 text-xs">
              <div>
                <div className="text-slate-400 font-medium">Active Bots</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  <span className={globalMetrics.runningCount > 0 ? "text-emerald-400 font-extrabold" : "text-slate-300"}>
                    {globalMetrics.runningCount}
                  </span>
                  <span className="text-slate-400 text-xs"> / {globalMetrics.totalBots} Running</span>
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium">Total Live PnL</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    globalMetrics.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {globalMetrics.totalPnl >= 0 ? "+" : ""}
                  ${globalMetrics.totalPnl.toLocaleString()} USDT
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium">Simulated Trades</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {globalMetrics.totalTrades}
                  <span className="text-emerald-400 text-xs font-medium ml-1">
                    ({globalMetrics.globalWinRate}% Win)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Quick Batch Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleStartAllTop}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer whitespace-nowrap"
            >
              <Play size={14} className="fill-current" />
              <span>Start Top 5 Bots</span>
            </button>

            {globalMetrics.runningCount > 0 && (
              <button
                onClick={handleStopAll}
                className="px-3.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Square size={13} className="fill-current" />
                <span>Stop All ({globalMetrics.runningCount})</span>
              </button>
            )}

            <button
              onClick={handleFactoryReset}
              className="p-2 rounded-lg bg-[#121622] hover:bg-[#1b2234] border border-[#222b3d] text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Reset All Bots"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* 2. FILTER & SEARCH CONTROLS */}
      <section className="bg-[#0b0e16] border-b border-[#161d2c] px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bot name, symbol (BTC, SOL, PEPE) or strategy..."
              className="w-full bg-[#10141e] border border-[#1e273a] rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Tabs (Segmented Buttons) */}
          <div className="flex items-center gap-1 bg-[#10141e] p-1 rounded-lg border border-[#1e273a] overflow-x-auto">
            {[
              { id: "ALL", label: "All 20 Bots" },
              { id: "ACTIVE", label: `Active (${globalMetrics.runningCount})` },
              { id: "Multi-Target Runner", label: "Multi-Target" },
              { id: "Trend Following", label: "Trend" },
              { id: "High-Frequency Scalp", label: "Scalping" },
              { id: "Meme & Volatility", label: "Meme Waves" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#10141e] border border-[#1e273a] text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ROI">Highest 30D ROI</option>
              <option value="WIN_RATE">Highest Win Rate</option>
              <option value="PNL">All-time Profit</option>
              <option value="ACTIVE">Running Status First</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3. 20 BOT CARDS GRID */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBots.map((bot) => {
            const isRunning = bot.status === "RUNNING";
            const isPaused = bot.status === "PAUSED";
            const currentWinRate =
              bot.totalTradesCount > 0
                ? Math.round((bot.winningTradesCount / bot.totalTradesCount) * 1000) / 10
                : bot.winRate;

            return (
              <div
                key={bot.id}
                className={`flex flex-col justify-between rounded-xl border-2 transition-all duration-200 bg-[#0c1017] ${
                  isRunning
                    ? "border-emerald-500/80 shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/30"
                    : isPaused
                    ? "border-amber-500/60 shadow-lg"
                    : "border-[#192231] hover:border-slate-700 hover:shadow-lg"
                }`}
              >
                {/* Bot Card Header */}
                <div className="p-4 border-b border-[#161d2c]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${bot.avatarColor} flex items-center justify-center text-white font-black text-sm shadow-md shrink-0`}
                      >
                        {bot.alias.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm tracking-tight truncate">
                            {bot.name}
                          </h3>
                        </div>
                        {/* Clean unboxed metadata (anti-slop) */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>{bot.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{bot.tradingDaysActive}d Active</span>
                          <span aria-hidden="true">·</span>
                          <span>{bot.followersCount} Copiers</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isRunning ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-mono font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>RUNNING</span>
                        </div>
                      ) : isPaused ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/70 border border-amber-500/60 text-amber-300 text-xs font-mono font-bold">
                          <span>PAUSED</span>
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                          IDLE
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2.5 line-clamp-2 leading-relaxed">
                    {bot.tagline}
                  </p>
                </div>

                {/* Key Stats Row */}
                <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-[#0a0d14] border-b border-[#161d2c] text-center font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-sans">30D ROI</div>
                    <div className="text-xs font-extrabold text-emerald-400 mt-0.5">
                      +{bot.roi30d}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Win Rate</div>
                    <div className="text-xs font-extrabold text-white mt-0.5">
                      {currentWinRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Max DD</div>
                    <div className="text-xs font-bold text-rose-400 mt-0.5">
                      -{bot.maxDrawdownPct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Profit</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                      ${(bot.allTimePnlUsdt / 1000).toFixed(1)}k
                    </div>
                  </div>
                </div>

                {/* Coin Basket Visualization */}
                <div className="px-4 py-3 border-b border-[#161d2c] bg-[#0c1017]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                      <PieChart size={13} className="text-blue-400" />
                      <span>Coin Basket ({bot.basket.length} Assets)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      TF: {bot.preferredTimeframe}
                    </span>
                  </div>

                  {/* Basket Coins List */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {bot.basket.map((item) => (
                      <button
                        key={item.symbol}
                        onClick={() => onSelectCoinForChart(item.symbol)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#101520] hover:bg-[#1a2336] border border-[#1d273a] text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                        title={`View ${item.symbol} chart & TATS PRO signals`}
                      >
                        <CryptoLogo symbol={item.symbol} size={15} />
                        <span className="font-mono font-bold">{item.symbol.split("/")[0]}</span>
                        <span className="text-blue-400 font-mono text-[10px]">{item.weightPct}%</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Investment Bounds: Min & Max */}
                <div className="px-4 py-2.5 border-b border-[#161d2c] bg-[#090c13] flex items-center justify-between text-xs">
                  <span className="text-slate-400">Copy Limits:</span>
                  <div className="font-mono text-slate-200 flex items-center gap-2">
                    <span>
                      Min: <strong className="text-white">${bot.minInvestmentUsdt}</strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      Max: <strong className="text-white">${bot.maxInvestmentUsdt.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>

                {/* LIVE TICKING COUNTER (کنتر انداختن زمان و سود و معاملات لایو) */}
                {isRunning && (
                  <div className="px-4 py-3 bg-emerald-950/30 border-b border-emerald-500/40">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Clock size={13} className="text-emerald-400 animate-spin" />
                        <span>Active Runtime Counter:</span>
                      </span>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {formatSecondsToClock(bot.elapsedSeconds)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                      <div className="bg-[#0b1016] p-2 rounded-lg border border-emerald-800/50">
                        <div className="text-[10px] text-slate-400">Floating + Realized PnL</div>
                        <div
                          className={`text-sm font-black mt-0.5 ${
                            bot.realizedPnlUsdt + bot.unrealizedPnlUsdt >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {bot.realizedPnlUsdt + bot.unrealizedPnlUsdt >= 0 ? "+" : ""}
                          ${(bot.realizedPnlUsdt + bot.unrealizedPnlUsdt).toFixed(2)} USDT
                        </div>
                      </div>

                      <div className="bg-[#0b1016] p-2 rounded-lg border border-emerald-800/50">
                        <div className="text-[10px] text-slate-400">Internal Trades</div>
                        <div className="text-sm font-black text-white mt-0.5">
                          {bot.totalTradesCount} executed
                          <span className="text-emerald-400 text-xs ml-1 font-semibold">
                            ({bot.winningTradesCount}W)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Open Positions Bar */}
                    {bot.openPositions.length > 0 && (
                      <div className="mt-2 text-xs">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                          <span>Open Positions ({bot.openPositions.length}):</span>
                          <button
                            onClick={() => {
                              setInspectedBotId(bot.id);
                              setLastActiveBotId(bot.id);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 underline font-bold"
                          >
                            Manage
                          </button>
                        </div>
                        <div className="space-y-1">
                          {bot.openPositions.slice(0, 2).map((pos) => (
                            <div
                              key={pos.id}
                              className="flex items-center justify-between bg-[#0e131d] px-2 py-1 rounded border border-slate-800 font-mono text-[11px]"
                            >
                              <span className="font-bold flex items-center gap-1">
                                <span
                                  className={pos.side === "LONG" ? "text-emerald-400" : "text-rose-400"}
                                >
                                  {pos.side}
                                </span>
                                <span className="text-white">{pos.symbol}</span>
                                <span className="text-slate-400 font-normal">({pos.leverage}x)</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-bold ${
                                    pos.pnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                >
                                  {pos.pnlUsdt >= 0 ? "+" : ""}${pos.pnlUsdt.toFixed(2)} ({pos.pnlPct}%)
                                </span>
                                <button
                                  onClick={() => handleClosePosition(bot.id, pos.id)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors cursor-pointer ${
                                    pos.pnlUsdt > 0
                                      ? "bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/50"
                                      : "bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800/40"
                                  }`}
                                  title={pos.pnlUsdt > 0 ? "Save profit and credit balance" : "Close position"}
                                >
                                  {pos.pnlUsdt > 0 ? "SAVE" : "CLOSE"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Capital Allocation & Leverage Inputs (when IDLE) */}
                {!isRunning && (
                  <div className="px-4 py-3 bg-[#0a0d14] border-b border-[#161d2c] space-y-2.5">
                    {/* Capital Input */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1 text-slate-400">
                        <span>Copy Capital:</span>
                        <span className="font-mono text-slate-300">
                          ${bot.allocatedCapital} USDT
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={bot.minInvestmentUsdt}
                          max={bot.maxInvestmentUsdt}
                          value={bot.allocatedCapital}
                          onChange={(e) =>
                            handleUpdateCapital(bot.id, parseFloat(e.target.value) || bot.minInvestmentUsdt)
                          }
                          className="w-full bg-[#10141e] border border-[#1e273a] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                        />
                        {[100, 500, 1000].map((quick) => (
                          <button
                            key={quick}
                            onClick={() => handleUpdateCapital(bot.id, quick)}
                            className="px-2 py-1 rounded bg-[#131824] hover:bg-[#1e2638] border border-[#212b3e] text-[10px] font-mono text-slate-300 font-bold transition-colors cursor-pointer"
                          >
                            ${quick}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Leverage Selector */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1 text-slate-400">
                        <span>Leverage:</span>
                        <span className="font-mono text-slate-300">{bot.selectedLeverage}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {bot.allowedLeverages.map((lev) => (
                          <button
                            key={lev}
                            onClick={() => handleUpdateLeverage(bot.id, lev)}
                            className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                              bot.selectedLeverage === lev
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-[#10141e] text-slate-400 hover:text-white border border-[#1e273a]"
                            }`}
                          >
                            {lev}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="p-4 bg-[#0a0d14] flex items-center gap-2">
                  {/* Big START / STOP BOT Button */}
                  <button
                    onClick={() => handleToggleBot(bot.id)}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                      isRunning
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <Square size={14} className="fill-current" />
                        <span>STOP BOT</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} className="fill-current" />
                        <span>START BOT</span>
                      </>
                    )}
                  </button>

                  {/* Pause / Resume Button (when running) */}
                  {isRunning && (
                    <button
                      onClick={() => handlePauseBot(bot.id)}
                      className="p-2.5 rounded-xl bg-[#141b29] hover:bg-[#1e273a] border border-[#232f46] text-amber-300 font-bold text-xs transition-colors cursor-pointer"
                      title={isPaused ? "Resume Bot" : "Pause Bot"}
                    >
                      <Pause size={14} />
                    </button>
                  )}

                  {/* Reset Counters */}
                  {(bot.elapsedSeconds > 0 || bot.totalTradesCount > 0) && (
                    <button
                      onClick={() => handleResetBot(bot.id)}
                      className="p-2.5 rounded-xl bg-[#141b29] hover:bg-[#1e273a] border border-[#232f46] text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Reset counters & trade history"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}

                  {/* Open Details / Positions Drawer */}
                  <button
                    onClick={() => {
                      setInspectedBotId(bot.id);
                      setLastActiveBotId(bot.id);
                    }}
                    className="p-2.5 rounded-xl bg-[#121622] hover:bg-[#1a2234] border border-[#20293d] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="View Positions & Trade History"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 4. BOT DETAIL / POSITIONS / LOGS DRAWER MODAL */}
      {inspectedBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#090c13] border-l border-[#1b2436] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#161d2c] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${inspectedBot.avatarColor} flex items-center justify-center text-white font-black text-base shadow-md`}
                >
                  {inspectedBot.alias.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {inspectedBot.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{inspectedBot.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Preferred TF: {inspectedBot.preferredTimeframe}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      +{inspectedBot.roi30d}% 30D ROI
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectedBotId(null)}
                className="p-2 rounded-lg bg-[#121622] hover:bg-[#1e273a] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Active Live Status Strip */}
              <div
                className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                  inspectedBot.status === "RUNNING"
                    ? "bg-emerald-950/40 border-emerald-500/70 text-emerald-200"
                    : "bg-[#0f1420] border-[#1d273a] text-slate-300"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-slate-400">Bot Execution Status</div>
                  <div className="text-lg font-black mt-0.5 flex items-center gap-2">
                    {inspectedBot.status === "RUNNING" ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>ACTIVE · Trading Confirmed Signals</span>
                      </>
                    ) : (
                      <span>STOPPED / IDLE</span>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs text-slate-400">Active Clock</div>
                  <div className="text-xl font-black text-white">
                    {formatSecondsToClock(inspectedBot.elapsedSeconds)}
                  </div>
                </div>
              </div>

              {/* Coin Basket Weight Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <PieChart size={14} className="text-blue-400" />
                  <span>Configured Crypto Basket</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inspectedBot.basket.map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0e131d] border border-[#1b2437]"
                    >
                      <div className="flex items-center gap-2.5">
                        <CryptoLogo symbol={item.symbol} size={22} />
                        <div>
                          <div className="font-bold text-white text-xs">{item.symbol}</div>
                          <div className="text-[10px] text-slate-400">{item.name}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-blue-400">{item.weightPct}%</div>
                        <div className="text-[10px] text-slate-400">
                          ${(priceMap[item.symbol] || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Open Positions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Activity size={14} className="text-emerald-400" />
                    <span>Live Simulated Positions ({inspectedBot.openPositions.length})</span>
                  </h4>
                </div>

                {inspectedBot.openPositions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#0e131d] border border-dashed border-[#1f2a3e] text-center text-xs text-slate-400">
                    No active positions currently.
                    {inspectedBot.status === "RUNNING"
                      ? " Waiting for next confirmed TATS PRO 6-EMA signal..."
                      : " Press Start Bot to begin automated trading."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {inspectedBot.openPositions.map((pos) => (
                      <div
                        key={pos.id}
                        className="p-3.5 rounded-xl bg-[#0e131d] border border-[#1f2a3e] flex flex-col gap-2 font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                pos.side === "LONG"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}
                            >
                              {pos.side} {pos.leverage}x
                            </span>
                            <span className="font-bold text-white text-sm">{pos.symbol}</span>
                            <span className="text-slate-400 text-xs">
                              Margin: ${pos.sizeUsdt} USDT
                            </span>
                          </div>

                          <div
                            className={`text-sm font-black ${
                              pos.pnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {pos.pnlUsdt >= 0 ? "+" : ""}${pos.pnlUsdt.toFixed(2)} ({pos.pnlPct}%)
                          </div>
                        </div>

                        {/* Price Details */}
                        <div className="grid grid-cols-5 gap-2 text-[11px] bg-[#07090e] p-2 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-slate-500 block">Entry Price</span>
                            <span className="text-slate-200 font-bold">${pos.entryPrice}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Current Price</span>
                            <span className="text-white font-bold">${pos.currentPrice}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Stop Loss</span>
                            <span className="text-rose-400 font-bold">${pos.stopLoss}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Take Profit</span>
                            <span className="text-emerald-400 font-bold">${pos.takeProfit}</span>
                          </div>
                          <div>
                            <span className="text-amber-500/90 block">Est. Liq Price</span>
                            <span className="text-amber-400 font-bold">
                              ${pos.liquidationPrice || (pos.side === "LONG" ? (pos.entryPrice * (1 - 1 / pos.leverage)).toFixed(2) : (pos.entryPrice * (1 + 1 / pos.leverage)).toFixed(2))}
                            </span>
                          </div>
                        </div>

                        {/* Save Profit / Close Position Button */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            {pos.pnlUsdt > 0 ? "Target secured: click to bank profit to wallet balance" : "Manual position closure"}
                          </span>
                          <button
                            onClick={() => handleClosePosition(inspectedBot.id, pos.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-md ${
                              pos.pnlUsdt > 0
                                ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/60"
                                : "bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200"
                            }`}
                          >
                            {pos.pnlUsdt > 0 ? `SAVE PROFIT (+$${pos.pnlUsdt.toFixed(2)} USDT)` : "Close Position Now"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trade History Ledger */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400" />
                  <span>Closed Trades History ({inspectedBot.recentTrades.length})</span>
                </h4>

                {inspectedBot.recentTrades.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0e131d] border border-[#1f2a3e] text-center text-xs text-slate-400">
                    No closed trades recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {inspectedBot.recentTrades.map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e131d] border border-slate-800 font-mono text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black ${
                              trade.side === "LONG" ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {trade.side}
                          </span>
                          <span className="text-white font-bold">{trade.symbol}</span>
                          <span className="text-slate-400 text-[10px] font-sans">
                            {trade.exitReason}
                          </span>
                        </div>

                        <div
                          className={`font-black ${
                            trade.pnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {trade.pnlUsdt >= 0 ? "+" : ""}${trade.pnlUsdt.toFixed(2)} ({trade.pnlPct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#161d2c] flex items-center justify-between">
              <button
                onClick={() => handleResetBot(inspectedBot.id)}
                className="px-3.5 py-2 rounded-lg bg-[#141b29] hover:bg-[#1e273a] border border-[#232f46] text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Reset Bot Stats</span>
              </button>

              <button
                onClick={() => handleToggleBot(inspectedBot.id)}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  inspectedBot.status === "RUNNING"
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {inspectedBot.status === "RUNNING" ? (
                  <>
                    <Square size={14} className="fill-current" />
                    <span>STOP BOT</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-current" />
                    <span>START BOT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
