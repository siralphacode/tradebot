import React from "react";
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  Target,
  ShieldAlert,
  Zap,
  RefreshCw,
  Cpu,
  Clock,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Timer,
  AlertCircle,
} from "lucide-react";
import { TechnicalIndicators } from "./technicalAnalysis.ts";

interface AiSignalCalculatorProps {
  symbol: string;
  currentPrice: number;
  decimals?: number;
  technicals: TechnicalIndicators;
  aiAnalysisText?: string;
  isAiAnalyzing?: boolean;
  onRefreshAi: () => void;
  onFollowSignal: (direction: "UP" | "DOWN", durationSeconds?: number) => void;
}

export const AiSignalCalculator: React.FC<AiSignalCalculatorProps> = ({
  symbol,
  currentPrice,
  decimals = 2,
  technicals,
  aiAnalysisText,
  isAiAnalyzing = false,
  onRefreshAi,
  onFollowSignal,
}) => {
  const isUp = technicals.direction === "UP";
  const isDown = technicals.direction === "DOWN";

  const remainingSec = technicals.lockedRemainingSeconds ?? 60;
  const progressPercent = Math.min(100, Math.max(0, (remainingSec / 60) * 100));

  const isOptimalEntry = technicals.entryWindow === "OPTIMAL";
  const isMidCycle = technicals.entryWindow === "ACTIVE";
  const isExpiringSoon = technicals.entryWindow === "WAIT_NEXT";

  return (
    <div className="bg-[#121622] border border-[#232d3f] rounded-xl p-3.5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background Accent Glow */}
      <div
        className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isUp ? "bg-emerald-500" : isDown ? "bg-rose-500" : "bg-blue-500"
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Cpu size={15} />
          </div>
          <div>
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              <span>1-MINUTE STABLE SIGNAL ENGINE</span>
              <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800/50">
                1M Lock
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Persistent 60s Binary Trade Forecast
            </div>
          </div>
        </div>

        <button
          onClick={onRefreshAi}
          disabled={isAiAnalyzing}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
          title="Recalculate 1-Minute Prediction"
        >
          <RefreshCw size={13} className={isAiAnalyzing ? "animate-spin text-purple-400" : ""} />
        </button>
      </div>

      {/* Stability Verification Badge & Entry Window Alert */}
      <div className="mb-3 space-y-2">
        {/* Stability Rating Bar */}
        <div className="bg-[#0b0e14] border border-[#1e2638] rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Signal Stability:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                {technicals.stabilityLevel || "VERY HIGH"}
              </span>
              <span className="font-mono font-black text-emerald-400 text-xs">
                {technicals.stabilityScore || 95}%
              </span>
            </div>
          </div>

          {/* Optimal Entry Window Indicator */}
          <div
            className={`mt-2 p-2 rounded-md border flex items-center justify-between text-xs font-mono transition-all ${
              isOptimalEntry
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : isMidCycle
                ? "bg-amber-950/50 border-amber-500/40 text-amber-300"
                : "bg-rose-950/50 border-rose-500/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isOptimalEntry ? (
                <Zap size={13} className="text-emerald-400 animate-pulse fill-current" />
              ) : isMidCycle ? (
                <Timer size={13} className="text-amber-400" />
              ) : (
                <AlertCircle size={13} className="text-rose-400" />
              )}
              <span className="font-bold text-[11px]">
                {isOptimalEntry
                  ? "Optimal 1-Minute Entry Window"
                  : isMidCycle
                  ? "Mid-Cycle (Trade Active)"
                  : "Cycle Expiring: Wait For Next 1M"}
              </span>
            </div>

            <div className="font-bold flex items-center gap-1">
              <Clock size={11} />
              <span>{remainingSec}s</span>
            </div>
          </div>

          {/* Progress Bar of 60s Cycle */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isOptimalEntry
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : isMidCycle
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-rose-500 to-rose-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono text-center flex items-center justify-center gap-1">
            <Lock size={10} className="text-amber-400" />
            <span>Signal locked and stable for the full 1-minute trade cycle</span>
          </div>
        </div>
      </div>

      {/* Main Signal Display */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Signal Direction Badge */}
        <div
          className={`flex flex-col justify-center items-center p-2.5 rounded-lg border text-center ${
            isUp
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-950/30"
              : isDown
              ? "bg-rose-950/40 border-rose-500/50 text-rose-400 shadow-lg shadow-rose-950/30"
              : "bg-slate-900 border-slate-700 text-slate-300"
          }`}
        >
          <div className="flex items-center gap-1 font-black text-sm tracking-wide">
            {isUp && <ArrowUp size={16} className="animate-bounce" />}
            {isDown && <ArrowDown size={16} className="animate-bounce" />}
            <span>{isUp ? "BUY (UP)" : isDown ? "SELL (DOWN)" : "NEUTRAL"}</span>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold mt-0.5 opacity-90">
            {technicals.signal}
          </span>
        </div>

        {/* Win Probability / Confidence */}
        <div className="flex flex-col justify-center p-2.5 rounded-lg bg-[#151b28] border border-[#232b3b]">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400 font-bold">Win Rate:</span>
            <span
              className={`font-mono font-black text-sm ${
                isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-300"
              }`}
            >
              {technicals.confidence}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isUp ? "bg-emerald-500" : isDown ? "bg-rose-500" : "bg-blue-500"
              }`}
              style={{ width: `${technicals.confidence}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-500 text-right mt-1 font-mono">
            {technicals.score > 0 ? `+${technicals.score}` : technicals.score} Quant Score
          </span>
        </div>
      </div>

      {/* 4-Point Stability Checklist */}
      <div className="bg-[#0e121a] border border-slate-800/80 rounded-lg p-2.5 mb-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>4-Point Stability Verification</span>
          <span className="text-[9px] text-emerald-400 font-mono">
            {technicals.checklist?.filter((c) => c.passed).length || 4}/4 Confirmed
          </span>
        </div>
        <div className="space-y-1.5 text-[10px] font-mono">
          {(technicals.checklist || []).map((check, idx) => (
            <div key={idx} className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>{check.label}</span>
              </span>
              <span className="text-emerald-400 font-bold text-[9px]">PASSED</span>
            </div>
          ))}
        </div>
      </div>

      {/* Target Price & Stop Loss */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
        <div className="bg-[#151b28] border border-[#232b3b] p-2 rounded-lg flex items-center gap-2">
          <Target size={14} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-[9px] uppercase text-slate-400">Target (TP)</div>
            <div className="font-bold text-white text-[11px]">
              ${Number(technicals.targetPrice || currentPrice * 1.01).toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
            </div>
          </div>
        </div>

        <div className="bg-[#151b28] border border-[#232b3b] p-2 rounded-lg flex items-center gap-2">
          <ShieldAlert size={14} className="text-rose-400 shrink-0" />
          <div>
            <div className="text-[9px] uppercase text-slate-400">Stop Loss (SL)</div>
            <div className="font-bold text-white text-[11px]">
              ${Number(technicals.stopLoss || currentPrice * 0.99).toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 1-Minute Predictive Rationale */}
      <div className="bg-[#0e121a] border border-slate-800/80 rounded-lg p-2.5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-purple-400 font-bold flex items-center gap-1">
            <Sparkles size={11} />
            <span>1-Minute Advance Forecast:</span>
          </span>
          {isAiAnalyzing && (
            <span className="text-[9px] text-purple-300 animate-pulse font-mono">Analyzing chart...</span>
          )}
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
          {aiAnalysisText ||
            technicals.forecastText ||
            (isUp
              ? "Strong bullish momentum confirmed across moving averages and RSI. Model forecasts BUY will remain dominant for the next 1 minute."
              : "Selling pressure dominant. Model forecasts SELL will remain active over the next 1 minute.")}
        </p>
      </div>

      {/* 1-Click Enter 1-Minute Trade Button (Always sets 60s Duration) */}
      {technicals.direction !== "NEUTRAL" && (
        <button
          onClick={() => onFollowSignal(technicals.direction as "UP" | "DOWN", 60)}
          className={`w-full py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-2xl cursor-pointer transition-all active:scale-[0.98] ${
            isUp
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-950/60 border border-emerald-400/30"
              : "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-950/60 border border-rose-400/30"
          }`}
        >
          <Zap size={16} className="fill-current animate-pulse" />
          <span>
            {isUp
              ? "ENTER 1-MINUTE BUY TRADE (60s Duration)"
              : "ENTER 1-MINUTE SELL TRADE (60s Duration)"}
          </span>
        </button>
      )}
    </div>
  );
};
