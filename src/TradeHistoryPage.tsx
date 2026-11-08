import React, { useState, useMemo } from "react";
import {
  History,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
} from "lucide-react";
import { GlobalTradeRecord } from "./tradeHistoryState.ts";
import { CryptoLogo } from "./cryptoLogos.tsx";

interface TradeHistoryPageProps {
  tradeHistory: GlobalTradeRecord[];
  onClearHistory: () => void;
  onSelectCoinForChart: (symbol: string) => void;
  backendUnavailable?: string | null;
  signedIn?: boolean;
}

export function TradeHistoryPage({
  tradeHistory,
  onClearHistory,
  onSelectCoinForChart,
  backendUnavailable = null,
  signedIn = false,
}: TradeHistoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSide, setFilterSide] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [filterResult, setFilterResult] = useState<"ALL" | "WIN" | "LOSS">("ALL");

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return tradeHistory.filter((tr) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSymbol = tr.symbol.toLowerCase().includes(q);
      const matchSource = tr.source.toLowerCase().includes(q);
      if (q && !matchSymbol && !matchSource) return false;

      if (filterSide !== "ALL" && tr.side !== filterSide) return false;
      if (filterResult === "WIN" && tr.pnlUsdt < 0) return false;
      if (filterResult === "LOSS" && tr.pnlUsdt >= 0) return false;

      return true;
    });
  }, [tradeHistory, searchQuery, filterSide, filterResult]);

  // Aggregate metrics
  const stats = useMemo(() => {
    const totalTrades = tradeHistory.length;
    const wins = tradeHistory.filter((t) => t.pnlUsdt >= 0);
    const losses = tradeHistory.filter((t) => t.pnlUsdt < 0);
    const totalPnl = tradeHistory.reduce((sum, t) => sum + t.pnlUsdt, 0);
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const totalVolume = tradeHistory.reduce((sum, t) => sum + t.sizeUsdt * t.leverage, 0);

    return {
      totalTrades,
      winCount: wins.length,
      lossCount: losses.length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      winRate: Math.round(winRate * 10) / 10,
      totalVolume: Math.round(totalVolume),
    };
  }, [tradeHistory]);

  const handleExportCSV = () => {
    const headers = ["ID", "Time", "Source", "Symbol", "Side", "Leverage", "Entry Price", "Exit Price", "Margin USDT", "PnL USDT", "PnL %", "Exit Reason"];
    const rows = filteredTrades.map((t) => [
      t.id,
      new Date(t.timestamp).toISOString(),
      `"${t.source}"`,
      t.symbol,
      t.side,
      `${t.leverage}x`,
      t.entryPrice,
      t.exitPrice,
      t.sizeUsdt,
      t.pnlUsdt,
      `${t.pnlPct}%`,
      `"${t.exitReason}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `TradeNews_Trade_History_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#040706] text-[#f1f5f9] overflow-y-auto select-none">
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <section className="bg-[#070c09] border-b border-[#122018] px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <History size={16} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Global Trade History Ledger
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {signedIn
                ? "Trade and position history reported by the TradeNews backend. No simulated fills are shown."
                : "Sign in to load trade history from the TradeNews backend. Nothing here is simulated."}
            </p>
            {backendUnavailable && (
              <p className="text-xs text-amber-300 mt-2 bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-2">
                History unavailable: {backendUnavailable}
              </p>
            )}
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-6 border-l border-slate-800/80 pl-6">
            <div>
              <div className="text-xs text-slate-400 font-medium">Net Realized PnL</div>
              <div
                className={`text-lg font-black font-mono mt-0.5 tabular-nums ${
                  stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {stats.totalPnl >= 0 ? "+" : ""}
                ${stats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-medium">Win Rate</div>
              <div className="text-lg font-black font-mono text-white mt-0.5 tabular-nums">
                {stats.winRate}%
                <span className="text-xs text-slate-400 font-sans ml-1 font-normal">
                  ({stats.winCount}W / {stats.lossCount}L)
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-medium">Total Trades</div>
              <div className="text-lg font-black font-mono text-white mt-0.5 tabular-nums">
                {stats.totalTrades}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FILTER & SEARCH CONTROLS */}
      <section className="bg-[#060a08] border-b border-[#122018] px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by pair (BTC, SOL, ETH) or Bot name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b130e] border border-[#16271e] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            {/* Side Filter */}
            <div className="flex items-center bg-[#09110d] p-1 rounded-lg border border-[#15231b]">
              {(["ALL", "LONG", "SHORT"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setFilterSide(side)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    filterSide === side
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>

            {/* Result Filter */}
            <div className="flex items-center bg-[#09110d] p-1 rounded-lg border border-[#15231b]">
              {(["ALL", "WIN", "LOSS"] as const).map((res) => (
                <button
                  key={res}
                  onClick={() => setFilterResult(res)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    filterResult === res
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {res === "ALL" ? "All Results" : res === "WIN" ? "Wins Only" : "Losses Only"}
                </button>
              ))}
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-[#0e1713] hover:bg-[#15241d] border border-[#1b2f23] text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export filtered trades as CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. HIGH-DENSITY AUDIT TRADE TABLE */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
        <div className="rounded-xl border border-[#14241b] bg-[#070c09] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#14241b] bg-[#09110d] text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Trader / Bot Source</th>
                  <th className="py-3 px-4">Pair</th>
                  <th className="py-3 px-4">Side</th>
                  <th className="py-3 px-4 text-right">Entry Price</th>
                  <th className="py-3 px-4 text-right">Exit Price</th>
                  <th className="py-3 px-4 text-right">Margin & Lev</th>
                  <th className="py-3 px-4 text-right">Net PnL (USDT)</th>
                  <th className="py-3 px-4">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101b14] text-xs font-mono">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                      No matching trade records found.
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => {
                    const isWin = trade.pnlUsdt >= 0;
                    const dateObj = new Date(trade.timestamp);
                    const timeFormatted = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj
                      .getMinutes()
                      .toString()
                      .padStart(2, "0")}:${dateObj.getSeconds().toString().padStart(2, "0")}`;

                    return (
                      <tr
                        key={trade.id}
                        className="hover:bg-[#0c1611] transition-colors cursor-pointer"
                        onClick={() => onSelectCoinForChart(trade.symbol)}
                      >
                        {/* Time */}
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-xs">
                          {timeFormatted}
                        </td>

                        {/* Trader / Bot */}
                        <td className="py-3.5 px-4 font-sans font-bold text-white whitespace-nowrap">
                          {trade.source}
                        </td>

                        {/* Pair */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CryptoLogo symbol={trade.symbol} size={18} />
                            <span className="font-extrabold text-white text-xs">{trade.symbol}</span>
                          </div>
                        </td>

                        {/* Side */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-xs ${
                              trade.side === "LONG"
                                ? "bg-emerald-950/90 text-emerald-400 border border-emerald-800/70"
                                : "bg-rose-950/90 text-rose-400 border border-rose-800/70"
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>

                        {/* Entry Price */}
                        <td className="py-3.5 px-4 text-right text-slate-300 font-bold text-xs tabular-nums whitespace-nowrap">
                          ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Exit Price */}
                        <td className="py-3.5 px-4 text-right text-white font-bold text-xs tabular-nums whitespace-nowrap">
                          ${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Margin & Leverage */}
                        <td className="py-3.5 px-4 text-right text-slate-300 whitespace-nowrap text-xs tabular-nums">
                          ${trade.sizeUsdt} <span className="text-slate-500 font-sans">({trade.leverage}x)</span>
                        </td>

                        {/* Net PnL (Large & Prominent) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span
                            className={`text-sm font-black tabular-nums ${
                              isWin ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isWin ? "+" : ""}${trade.pnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span
                            className={`ml-1.5 text-xs font-bold tabular-nums ${
                              isWin ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            ({isWin ? "+" : ""}{trade.pnlPct}%)
                          </span>
                        </td>

                        {/* Exit Reason */}
                        <td className="py-3.5 px-4 text-slate-400 font-sans text-xs whitespace-nowrap truncate max-w-xs">
                          {trade.exitReason}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
