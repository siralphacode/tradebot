import React, { useState } from "react";
import {
  Activity,
  Bot,
  History,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  Layers,
  Sparkles,
  TrendingUp,
  Square,
  Play,
  AlertTriangle,
  X,
} from "lucide-react";
import { WalletState } from "./walletState.ts";
import { BotTrader } from "./copyTradingTypes.ts";

interface SidebarProps {
  activePage: "TERMINAL" | "COPY_TRADING" | "HISTORY";
  onSelectPage: (page: "TERMINAL" | "COPY_TRADING" | "HISTORY") => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  wallet: WalletState;
  onOpenWalletModal: (mode: "CONNECT" | "DEPOSIT" | "WITHDRAW") => void;
  activeBotsCount: number;
  totalTradesCount: number;
  activeBot?: BotTrader | null;
  onToggleBotStatus?: (botId: string) => void;
}

export function Sidebar({
  activePage,
  onSelectPage,
  isCollapsed,
  onToggleCollapse,
  wallet,
  onOpenWalletModal,
  activeBotsCount,
  totalTradesCount,
  activeBot,
  onToggleBotStatus,
}: SidebarProps) {
  const [showStopModal, setShowStopModal] = useState(false);

  const liveBotPnl = activeBot
    ? Math.round((activeBot.unrealizedPnlUsdt + activeBot.realizedPnlUsdt) * 100) / 100
    : 0;
  return (
    <aside
      className={`h-screen bg-[#040706] border-r border-[#122018] flex flex-col justify-between transition-all duration-300 z-30 shrink-0 select-none ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* 1. BRAND HEADER & TOGGLE */}
      <div>
        <div className="h-14 border-b border-[#122018] px-3.5 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-black font-black text-xs shadow-md shadow-emerald-950/60 shrink-0">
                TN
              </div>
              <div className="truncate">
                <div className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  <span>TradeNews</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    PRO
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Institutional Radar</div>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-black font-black text-xs mx-auto shadow-md">
              TN
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-lg bg-[#0b120e] hover:bg-[#14221a] border border-[#182b20] text-slate-400 hover:text-white transition-colors cursor-pointer ${
              isCollapsed ? "hidden" : "block"
            }`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* 2. WALLET & BALANCE CARD */}
        <div className="p-3 border-b border-[#122018]">
          {!isCollapsed ? (
            wallet.isConnected ? (
              <div className="p-3 rounded-xl bg-[#070d0a] border border-[#16271e] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Trading Balance</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {wallet.network}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-base font-extrabold font-mono text-white tracking-tight">
                    ${wallet.balanceUsdt.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-sans">USDT</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {wallet.address
                    ? "Backend-verified balance. Deposits/withdrawals are disabled in this build."
                    : "No verified wallet linked. Balances appear only after backend verification."}
                </div>

                {/* Wallet record actions (no real-money flows) */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() => onOpenWalletModal("DEPOSIT")}
                    className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                    title="Deposit USDT"
                  >
                    <ArrowDownLeft size={13} />
                    <span>Deposit</span>
                  </button>

                  <button
                    onClick={() => onOpenWalletModal("WITHDRAW")}
                    className="py-1.5 px-2 rounded-lg bg-[#0e1713] hover:bg-[#18261f] border border-[#1c3125] text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Withdraw USDT"
                  >
                    <ArrowUpRight size={13} />
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onOpenWalletModal("CONNECT")}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Wallet size={15} />
                <span>Connect Wallet</span>
              </button>
            )
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => onOpenWalletModal(wallet.isConnected ? "DEPOSIT" : "CONNECT")}
                className="w-10 h-10 rounded-xl bg-[#080e0b] hover:bg-[#111c16] border border-[#16271e] text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
                title={wallet.isConnected ? `Balance: $${wallet.balanceUsdt.toLocaleString()} USDT` : "Connect Wallet"}
              >
                <Wallet size={16} />
              </button>
              {wallet.isConnected && (
                <button
                  onClick={() => onOpenWalletModal("DEPOSIT")}
                  className="w-10 h-8 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white flex items-center justify-center text-[10px] font-mono font-bold transition-colors cursor-pointer"
                  title="Deposit"
                >
                  <ArrowDownLeft size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. PRIMARY NAVIGATION LINKS */}
        <nav className="p-2 space-y-1">
          {/* Signal Terminal */}
          <button
            onClick={() => onSelectPage("TERMINAL")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activePage === "TERMINAL"
                ? "bg-emerald-600/35 text-white border border-emerald-500/60 shadow-lg shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#09110d]"
            } ${isCollapsed ? "justify-center px-0" : ""}`}
            title="TATS PRO Signal Terminal"
          >
            <Activity size={18} className={activePage === "TERMINAL" ? "text-emerald-400" : "text-slate-400"} />
            {!isCollapsed && <span className="truncate">Signal Terminal</span>}
          </button>

          {/* AI Copy Trading (20 Bots) */}
          <button
            onClick={() => onSelectPage("COPY_TRADING")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activePage === "COPY_TRADING"
                ? "bg-emerald-600/35 text-white border border-emerald-500/60 shadow-lg shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#09110d]"
            } ${isCollapsed ? "justify-center px-0" : ""}`}
            title="AI Bot Traders (20 Copy Bots)"
          >
            <div className="flex items-center gap-3">
              <Bot size={18} className={activePage === "COPY_TRADING" ? "text-emerald-400" : "text-slate-400"} />
              {!isCollapsed && <span className="truncate">Strategies</span>}
            </div>
            {!isCollapsed && (
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  activeBotsCount > 0
                    ? "bg-emerald-500 text-black animate-pulse"
                    : "bg-[#111e17] text-slate-400 border border-[#1b3125]"
                }`}
              >
                {activeBotsCount > 0 ? `${activeBotsCount} Active` : "20 Bots"}
              </span>
            )}
          </button>

          {/* Trade History */}
          <button
            onClick={() => onSelectPage("HISTORY")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activePage === "HISTORY"
                ? "bg-emerald-600/35 text-white border border-emerald-500/60 shadow-lg shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#09110d]"
            } ${isCollapsed ? "justify-center px-0" : ""}`}
            title="User & Bot Trade History"
          >
            <div className="flex items-center gap-3">
              <History size={18} className={activePage === "HISTORY" ? "text-emerald-400" : "text-slate-400"} />
              {!isCollapsed && <span className="truncate">Trade History</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#111e17] text-slate-400 border border-[#1b3125]">
                {totalTradesCount}
              </span>
            )}
          </button>
        </nav>

        {/* 3.5 ACTIVE BOT LIVE PNL CARD & QUICK CONTROL */}
        {!isCollapsed && activeBot && (
          <div className="p-2.5 mx-2.5 my-2 rounded-xl bg-[#060b08] border border-[#14261c] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeBot.status === "RUNNING"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-slate-500"
                  }`}
                />
                <span className="font-extrabold text-white truncate text-xs">
                  {activeBot.name}
                </span>
              </div>
              <span
                className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded uppercase ${
                  activeBot.status === "RUNNING"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : "bg-slate-900 text-slate-400 border border-slate-800"
                }`}
              >
                {activeBot.status}
              </span>
            </div>

            {/* Live PnL Card (reference only — no live funds move here) */}
            <div className="p-2 rounded-lg bg-[#030604] border border-[#112017]">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-semibold">LIVE BOT PNL</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {activeBot.openPositions.length} Open Trades
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <div
                  className={`text-base font-mono font-black tabular-nums tracking-tight ${
                    liveBotPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {liveBotPnl >= 0 ? "+" : ""}${liveBotPnl.toFixed(2)}{" "}
                  <span className="text-[10px] text-slate-400 font-sans">USDT</span>
                </div>
                <div
                  className={`text-xs font-mono font-bold ${
                    liveBotPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {liveBotPnl >= 0 ? "+" : ""}{activeBot.roi30d > 0 ? `${activeBot.roi30d.toFixed(1)}%` : "0.0%"}
                </div>
              </div>

              {/* Active Pairs */}
              {activeBot.openPositions.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[#112017] text-[10px] text-slate-300 font-mono overflow-x-auto scrollbar-none">
                  <span className="text-slate-500">Pairs:</span>
                  {activeBot.openPositions.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className="px-1 py-0.2 rounded bg-[#09120c] text-emerald-300 font-bold border border-[#16271e] shrink-0"
                    >
                      {p.symbol.replace("/USDT", "")} {p.side}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Stop Bot / Cancel Button */}
            {activeBot.status === "RUNNING" ? (
              <button
                onClick={() => setShowStopModal(true)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-rose-950/30"
              >
                <Square size={12} className="fill-current" />
                <span>STOP BOT</span>
              </button>
            ) : (
              <button
                onClick={() => onToggleBotStatus && onToggleBotStatus(activeBot.id)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
              >
                <Play size={12} className="fill-current" />
                <span>START BOT</span>
              </button>
            )}
          </div>
        )}

        {isCollapsed && activeBot && (
          <div className="py-2 px-1 flex flex-col items-center border-t border-[#122018]">
            <button
              onClick={() => onSelectPage("COPY_TRADING")}
              className="w-10 h-10 rounded-xl bg-[#070d0a] hover:bg-[#122017] border border-[#16271e] flex flex-col items-center justify-center transition-colors cursor-pointer relative"
              title={`Active Bot: ${activeBot.name} | PnL: $${liveBotPnl} USDT`}
            >
              <Bot size={16} className={activeBot.status === "RUNNING" ? "text-emerald-400" : "text-slate-400"} />
              <span
                className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${
                  activeBot.status === "RUNNING" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* 4. FOOTER STATUS & TOGGLE (when collapsed) */}
      <div className="p-3 border-t border-[#122018]">
        {isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl bg-[#080e0b] hover:bg-[#111c16] border border-[#16271e] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer mx-auto"
            title="Expand Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        ) : (
          <div className="p-2.5 rounded-xl bg-[#060a08] border border-[#122018] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">TATS PRO Engine:</span>
              <span className="text-emerald-400 font-bold font-mono">v1.0 ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">6-EMA Alignment:</span>
              <span className="text-white font-mono font-bold">15M ACTIVE</span>
            </div>
          </div>
        )}
      </div>

      {/* Stop Bot Confirmation Modal */}
      {showStopModal && activeBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#070c09] border-2 border-rose-600/60 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-left font-sans">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/40 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-extrabold text-white">
                  Stop Bot Confirmation
                </h3>
                <p className="text-xs text-rose-300 font-medium mt-1">
                  Are you sure you want to stop <span className="font-bold text-white">{activeBot.name}</span>?
                </p>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Stopping the bot will halt internal signal executions and safely return any open position margins back to your wallet balance.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowStopModal(false)}
                className="px-3.5 py-2 rounded-xl bg-[#0f1a14] hover:bg-[#16271e] text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Keep Running
              </button>
              <button
                onClick={() => {
                  if (onToggleBotStatus) onToggleBotStatus(activeBot.id);
                  setShowStopModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-rose-950/50"
              >
                Yes, Stop Bot
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
