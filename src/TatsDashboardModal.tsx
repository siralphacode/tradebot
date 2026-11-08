import React, { useState } from "react";
import { TatsProData } from "./technicalAnalysis.ts";
import {
  X,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";

interface TatsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  decimals?: number;
  tatsData: TatsProData;
  onSelectTpTarget?: (targetPrice: number, tpIndex: number) => void;
  onNotify?: (msg: string) => void;
}

export const TatsDashboardModal: React.FC<TatsDashboardModalProps> = ({
  isOpen,
  onClose,
  symbol,
  timeframe,
  currentPrice,
  decimals = 2,
  tatsData,
  onSelectTpTarget,
  onNotify,
}) => {
  if (!isOpen) return null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const formatUSD = (val: number) => {
    return Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    if (onNotify) onNotify(`Copied ${label} (${text}) to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isBull = tatsData.lastSide === 1;
  const isBear = tatsData.lastSide === -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b0e16] border-2 border-[#1e273a] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#111726] to-[#0c101c] px-5 py-4 border-b border-[#1c2438] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black">
              <Zap size={22} className="fill-current" />
            </div>
            <div>
              <div className="text-base font-black text-white flex items-center gap-2">
                <span>TradeNews TATS PRO v1.0</span>
                <span className="text-[11px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 font-bold uppercase">
                  {timeframe} Confirmed
                </span>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                6-EMA Trend Cloud • ATR Volatility Filter • Multi-Target Risk Engine
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-sans text-sm">
          {/* 1. Core Status Banner */}
          <div
            className={`p-4 rounded-xl border-2 flex items-center justify-between ${
              isBull
                ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                : isBear
                ? "bg-rose-950/60 border-rose-500/60 text-rose-300"
                : "bg-slate-900 border-slate-700 text-slate-300"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-xl ${
                  isBull ? "bg-emerald-500" : isBear ? "bg-rose-500" : "bg-slate-700"
                }`}
              >
                {isBull ? <TrendingUp size={28} /> : isBear ? <TrendingDown size={28} /> : <Layers size={24} />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Confirmed Signal State
                </div>
                <div className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                  <span>{isBull ? "TATS BUY SIGNAL ▲" : isBear ? "TATS SELL SIGNAL ▼" : "WAIT / NEUTRAL"}</span>
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-xs text-slate-400 font-bold uppercase">6-EMA Alignment</div>
              <div className="text-base font-black text-white mt-0.5">
                {tatsData.bullAligned ? (
                  <span className="text-emerald-400">Bullish (30 &gt; ... &gt; 60)</span>
                ) : tatsData.bearAligned ? (
                  <span className="text-rose-400">Bearish (30 &lt; ... &lt; 60)</span>
                ) : (
                  <span className="text-amber-400">Consolidating</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. ATR & Volatility Check */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#10141e] p-3.5 rounded-xl border border-[#1e273a]">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>ATR(14) Volatility:</span>
                <span className={tatsData.atrOK ? "text-emerald-400 font-mono font-black" : "text-amber-400 font-mono font-black"}>
                  {tatsData.atrPct}% of Price
                </span>
              </div>
              <div className="mt-2 text-xs flex items-center gap-2">
                {tatsData.atrOK ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-amber-400 shrink-0" />
                )}
                <span className="text-slate-300">
                  {tatsData.atrOK
                    ? `Passed minimum ATR filter (Threshold >= ${tatsData.minAtrPct}%)`
                    : `Below minimum ATR filter (< ${tatsData.minAtrPct}%)`}
                </span>
              </div>
            </div>

            <div className="bg-[#10141e] p-3.5 rounded-xl border border-[#1e273a]">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>Stop-Loss Distance Mode:</span>
                <span className="text-blue-400 font-mono font-black">
                  {tatsData.slMode} ({tatsData.slATR}x ATR)
                </span>
              </div>
              <div className="mt-2 text-xs flex items-center justify-between font-mono">
                <span className="text-slate-400">Risk Distance:</span>
                <span className="text-white font-bold">${formatUSD(tatsData.riskDistance)}</span>
              </div>
            </div>
          </div>

          {/* 3. TATS PRO Entry & SL Levels */}
          <div className="bg-[#10141e] p-4 rounded-xl border border-[#1e273a]">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Risk Management Base Levels</span>
              <span className="text-slate-400 font-normal">Active Signal Reference</span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              {/* Entry */}
              <div className="bg-[#0b0e14] p-3 rounded-lg border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-bold">ENTRY PRICE</div>
                  <div className="text-lg font-black text-white mt-0.5">${formatUSD(tatsData.entryPrice)}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(tatsData.entryPrice.toString(), "Entry")}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Entry Price"
                >
                  <Copy size={15} />
                </button>
              </div>

              {/* Stop Loss */}
              <div className="bg-[#0b0e14] p-3 rounded-lg border border-rose-900/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                    <ShieldAlert size={13} />
                    <span>STOP LOSS (SL)</span>
                  </div>
                  <div className="text-lg font-black text-rose-400 mt-0.5">${formatUSD(tatsData.stopLoss)}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(tatsData.stopLoss.toString(), "Stop Loss")}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Copy SL Price"
                >
                  <Copy size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Multi-Target Levels TP1 through TP7 (Pine Script exact 7 targets) */}
          <div className="bg-[#10141e] p-4 rounded-xl border border-[#1e273a]">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Target size={14} className="text-emerald-400" />
                <span>Multi-Target Profit Levels (TP1 to TP7)</span>
              </span>
              <span className="text-[11px] text-emerald-400 font-normal">Click any TP to set as Target</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
              {tatsData.tpTargets.map((tp, idx) => {
                const multiple = idx + 1;
                const gainPct =
                  tatsData.entryPrice > 0
                    ? ((Math.abs(tp - tatsData.entryPrice) / tatsData.entryPrice) * 100).toFixed(2)
                    : "0.00";

                return (
                  <div
                    key={idx}
                    className="bg-[#0a0d14] px-3 py-2 rounded-lg border border-emerald-900/40 hover:border-emerald-500/70 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                        TP{multiple}
                      </span>
                      <span className="text-sm font-black text-emerald-400">${formatUSD(tp)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({gainPct}%)</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {onSelectTpTarget && (
                        <button
                          onClick={() => {
                            onSelectTpTarget(tp, multiple);
                            if (onNotify) onNotify(`Selected TP${multiple} (${formatUSD(tp)}) for Trade Order`);
                          }}
                          className="text-[11px] font-sans font-bold bg-emerald-950/80 hover:bg-emerald-600 text-emerald-300 hover:text-white px-2 py-0.5 rounded transition-all cursor-pointer border border-emerald-700/60"
                        >
                          Select
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(tp.toString(), `TP${multiple}`)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                        title={`Copy TP${multiple}`}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Multi-Timeframe Trend Dashboard (Pine Script MTF Table) */}
          <div className="bg-[#10141e] p-4 rounded-xl border border-[#1e273a]">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
              Multi-Timeframe Trend Cloud Alignment
            </div>

            <div className="grid grid-cols-5 gap-2 text-center font-mono">
              {tatsData.htfTrends.map((htf, idx) => (
                <div
                  key={idx}
                  className="bg-[#0a0d14] p-2 rounded-lg border border-slate-800 flex flex-col items-center justify-center"
                >
                  <div className="text-xs font-black text-slate-300">{htf.timeframe}</div>
                  <div
                    className="text-[11px] font-extrabold mt-1 px-1.5 py-0.5 rounded"
                    style={{
                      color: htf.color,
                      backgroundColor:
                        htf.trend === "BULLISH"
                          ? "rgba(34, 197, 94, 0.15)"
                          : htf.trend === "BEARISH"
                          ? "rgba(239, 68, 68, 0.15)"
                          : "rgba(148, 163, 184, 0.15)",
                    }}
                  >
                    {htf.trend === "BULLISH" ? "BULL" : htf.trend === "BEARISH" ? "BEAR" : "NEUT"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0c101c] px-5 py-3 border-t border-[#1c2438] flex items-center justify-between text-xs text-slate-400">
          <span>Formula: 6-EMA (30,35,40,45,50,60) + ATR(14) 0.15% Filter</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer shadow-md"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
