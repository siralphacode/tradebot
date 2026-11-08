import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Sliders,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
  Lock,
  Unlock,
  Key,
  ExternalLink,
  ChevronDown,
  Target,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Wallet,
  Globe,
  HelpCircle,
  FileText,
  Activity,
  Layers,
} from "lucide-react";
import { TechnicalIndicators } from "./technicalAnalysis.ts";

export interface HyperliquidPosition {
  coin: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  sizeRaw: string;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  positionValue: number;
  leverage: number;
  marginUsed: number;
  tpOrder?: { id: number; price: number } | null;
  slOrder?: { id: number; price: number } | null;
}

export interface HyperliquidPublicConfig {
  configured: boolean;
  masterAddress: string;
  agentAddress: string;
  isTestnet: boolean;
  mainnetAllowed: boolean;
  dailyLossLimitUSD: number;
  dailyLossAccumulatedUSD: number;
  maxPositionNotionalUSD: number;
  maxLeverageLimit: number;
  jurisdictionNotice: string;
}

interface HyperliquidPanelProps {
  symbol: string;
  timeframe?: string;
  currentPrice: number;
  decimals?: number;
  technicals: TechnicalIndicators;
  onNotify: (msg: string) => void;
  onPlayChime?: () => void;
  onClose?: () => void;
}

const LEVERAGE_PRESETS = [2, 5, 10, 20, 25, 40, 50];
const MARGIN_QUICK_PRESETS = [25, 50, 100, 250, 500];

export const HyperliquidPanel: React.FC<HyperliquidPanelProps> = ({
  symbol,
  timeframe = "1m",
  currentPrice,
  decimals = 2,
  technicals,
  onNotify,
  onPlayChime,
  onClose,
}) => {
  // Tabs: "TRADE", "POSITIONS", "HISTORY", "AUDIT"
  const [activeTab, setActiveTab] = useState<"TRADE" | "POSITIONS" | "HISTORY" | "AUDIT">("TRADE");

  // Panel layout size: NORMAL vs EXPANDED
  const [isExpanded, setIsExpanded] = useState(false);

  // Status & Account
  const [config, setConfig] = useState<HyperliquidPublicConfig | null>(null);
  const [accountValue, setAccountValue] = useState<number>(0);
  const [availableMargin, setAvailableMargin] = useState<number>(0);
  const [totalMarginUsed, setTotalMarginUsed] = useState<number>(0);
  const [withdrawable, setWithdrawable] = useState<number>(0);
  const [positions, setPositions] = useState<HyperliquidPosition[]>([]);
  const [historyFills, setHistoryFills] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(false);

  // Admin Passcode & Authorization
  const [adminPasscode, setAdminPasscode] = useState<string>(() => localStorage.getItem("hl_admin_passcode") || "admin123");
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(true);

  // Order Parameters
  const [marginInput, setMarginInput] = useState<string>("50");
  const [leverage, setLeverage] = useState<number>(10);
  const [isIsolated, setIsIsolated] = useState<boolean>(true);
  const [slippage, setSlippage] = useState<number>(0.005); // 0.5%
  const [enableTP, setEnableTP] = useState<boolean>(true);
  const [enableSL, setEnableSL] = useState<boolean>(true);
  const [tpPriceInput, setTpPriceInput] = useState<string>("");
  const [slPriceInput, setSlPriceInput] = useState<string>("");
  const [lockToSignalDirection, setLockToSignalDirection] = useState<boolean>(true);

  // Modals & Action States
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<"BUY" | "SELL" | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastExecutionReport, setLastExecutionReport] = useState<any>(null);

  // Config Form State
  const [cfgMasterAddress, setCfgMasterAddress] = useState<string>("");
  const [cfgAgentKey, setCfgAgentKey] = useState<string>("");
  const [cfgIsTestnet, setCfgIsTestnet] = useState<boolean>(true);
  const [cfgMainnetAllowed, setCfgMainnetAllowed] = useState<boolean>(false);
  const [cfgAdminPasscode, setCfgAdminPasscode] = useState<string>("admin123");
  const [cfgDailyLimit, setCfgDailyLimit] = useState<string>("1000");
  const [cfgStatusMsg, setCfgStatusMsg] = useState<string | null>(null);
  const [isSavingCfg, setIsSavingCfg] = useState<boolean>(false);

  // Coin base extraction
  const coin = useMemo(() => {
    return symbol.replace("/USDT", "").replace("/USD", "").replace("_USDT", "").trim();
  }, [symbol]);

  // Load Status and Account Data
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/hyperliquid/status");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.masterAddress && !cfgMasterAddress) {
          setCfgMasterAddress(data.masterAddress);
        }
        setCfgIsTestnet(data.isTestnet);
        setCfgMainnetAllowed(data.mainnetAllowed);
        setCfgDailyLimit(data.dailyLossLimitUSD.toString());
      }
    } catch (e) {
      // ignore
    }
  };

  const fetchAccount = async () => {
    setIsLoadingAccount(true);
    try {
      const res = await fetch("/api/hyperliquid/account");
      if (res.ok) {
        const data = await res.json();
        setAccountValue(data.accountValue || 0);
        setTotalMarginUsed(data.totalMarginUsed || 0);
        setWithdrawable(data.withdrawable || 0);
        // available margin = accountValue - totalMarginUsed
        const avail = Math.max(0, (data.accountValue || 0) - (data.totalMarginUsed || 0));
        setAvailableMargin(avail);
        setPositions(data.openPositions || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/hyperliquid/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryFills(data.fills || []);
        setAuditLogs(data.auditLogs || []);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAccount();
    fetchHistory();
    const interval = setInterval(() => {
      fetchAccount();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update TP and SL helper offsets automatically when TATS PRO Signal changes
  const applySignalScopeTargets = (targetIdx = 0) => {
    if (!currentPrice || currentPrice <= 0) return;
    const isBuy = technicals.signal === "BUY" || technicals.signal === "STRONG BUY";
    const targetTp =
      (technicals.tpTargets && technicals.tpTargets[targetIdx]) ||
      technicals.targetPrice ||
      (isBuy ? currentPrice * 1.025 : currentPrice * 0.975);
    const targetSl =
      technicals.stopLoss || (isBuy ? currentPrice * 0.985 : currentPrice * 1.015);

    setTpPriceInput(targetTp.toFixed(decimals));
    setSlPriceInput(targetSl.toFixed(decimals));
    onNotify(`Applied TATS PRO TP${targetIdx + 1} ($${targetTp.toFixed(decimals)}) & SL ($${targetSl.toFixed(decimals)})`);
  };

  // Sync TP/SL defaults on price change if inputs are blank
  useEffect(() => {
    if (currentPrice > 0 && !tpPriceInput && !slPriceInput) {
      const isBuy = technicals.signal === "BUY" || technicals.signal === "STRONG BUY";
      const defTp = (technicals.tpTargets && technicals.tpTargets[0]) || (isBuy ? currentPrice * 1.02 : currentPrice * 0.98);
      const defSl = technicals.stopLoss || (isBuy ? currentPrice * 0.99 : currentPrice * 1.01);
      setTpPriceInput(defTp.toFixed(decimals));
      setSlPriceInput(defSl.toFixed(decimals));
    }
  }, [currentPrice, symbol, technicals.stopLoss, technicals.tpTargets]);

  // Derived order calculations
  const marginVal = parseFloat(marginInput) || 0;
  const notionalUSD = marginVal * leverage;
  const estimatedCoins = currentPrice > 0 ? notionalUSD / currentPrice : 0;

  // Signal direction lock rule
  const isBuySignal = technicals.signal === "BUY" || technicals.signal === "STRONG BUY";
  const isSellSignal = technicals.signal === "SELL" || technicals.signal === "STRONG SELL";

  const isBuyDisabled = useMemo(() => {
    if (!lockToSignalDirection) return false;
    return isSellSignal; // disable Buy if signal is explicitly SELL
  }, [lockToSignalDirection, isSellSignal]);

  const isSellDisabled = useMemo(() => {
    if (!lockToSignalDirection) return false;
    return isBuySignal; // disable Sell if signal is explicitly BUY
  }, [lockToSignalDirection, isBuySignal]);

  // Handle Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCfg(true);
    setCfgStatusMsg(null);
    try {
      const res = await fetch("/api/hyperliquid/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterAddress: cfgMasterAddress,
          agentPrivateKey: cfgAgentKey ? cfgAgentKey : undefined,
          isTestnet: cfgIsTestnet,
          mainnetAllowed: cfgMainnetAllowed,
          adminPasscode: cfgAdminPasscode,
          dailyLossLimitUSD: parseFloat(cfgDailyLimit) || 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update configuration");
      }
      setCfgStatusMsg(`Success: ${data.status}`);
      setAdminPasscode(cfgAdminPasscode);
      localStorage.setItem("hl_admin_passcode", cfgAdminPasscode);
      await fetchStatus();
      await fetchAccount();
      onNotify("Hyperliquid configuration updated successfully.");
      setTimeout(() => {
        setIsConfigModalOpen(false);
        setCfgStatusMsg(null);
      }, 1500);
    } catch (err: any) {
      setCfgStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSavingCfg(false);
    }
  };

  // Open confirmation modal
  const handleInitiateOrder = (side: "BUY" | "SELL") => {
    if (!adminPasscode) {
      onNotify("Admin Passcode required for execution.");
      setIsConfigModalOpen(true);
      return;
    }
    if (marginVal <= 0) {
      onNotify("Please enter a valid margin amount.");
      return;
    }
    setPendingAction(side);
    setIsConfirmModalOpen(true);
  };

  // Execute Order via Backend Hyperliquid Service
  const handleExecuteOrder = async () => {
    if (!pendingAction) return;
    setIsExecuting(true);
    setLastExecutionReport(null);

    const isBuy = pendingAction === "BUY";
    const tpPx = enableTP && tpPriceInput ? parseFloat(tpPriceInput) : undefined;
    const slPx = enableSL && slPriceInput ? parseFloat(slPriceInput) : undefined;

    try {
      const res = await fetch("/api/hyperliquid/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          isBuy,
          marginUSDC: marginVal,
          leverage,
          isIsolated,
          takeProfitPrice: tpPx,
          stopLossPrice: slPx,
          slippageTolerance: slippage,
          adminPasscode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Order execution failed.");
      }

      setLastExecutionReport(data);
      setIsConfirmModalOpen(false);

      if (onPlayChime) onPlayChime();

      if (data.safeCloseExecuted) {
        onNotify(`PROTECTION TRIGGERED: Order placed but protective TP/SL failed. Safe position unwind completed.`);
      } else {
        onNotify(`Successfully executed Hyperliquid ${isBuy ? "BUY" : "SELL"} on ${coin}! Order #${data.orderId}`);
      }

      await fetchAccount();
      await fetchHistory();
      setActiveTab("POSITIONS");
    } catch (err: any) {
      onNotify(`Execution Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Close Position
  const handleClosePosition = async (posCoin: string) => {
    if (!confirm(`Are you sure you want to CLOSE the ${posCoin} position with reduce-only execution?`)) {
      return;
    }

    try {
      const res = await fetch("/api/hyperliquid/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: posCoin,
          adminPasscode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to close position");
      }
      onNotify(`Position closed on Hyperliquid: ${posCoin} (Size: ${data.sizeClosed})`);
      await fetchAccount();
      await fetchHistory();
    } catch (err: any) {
      onNotify(`Close Error: ${err.message}`);
    }
  };

  return (
    <div
      className={`h-full flex flex-col bg-[#0b0e14] border-l border-slate-800 text-slate-100 select-none transition-all duration-300 ${
        isExpanded ? "w-[560px]" : "w-[400px]"
      } shrink-0 relative z-20`}
    >
      {/* 1. TOP HEADER & EXCHANGE STATUS */}
      <div className="p-3 border-b border-slate-800 bg-[#0d111a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white flex items-center gap-1">
                HYPERLIQUID <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">DEX L1</span>
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  config?.isTestnet
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {config?.isTestnet ? "Testnet" : "Mainnet"}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <span>{config?.configured ? `Agent: ${config.agentAddress?.slice(0, 6)}...${config.agentAddress?.slice(-4)}` : "Agent: Not Set"}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${config?.configured ? "bg-emerald-400" : "bg-rose-500"}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Config Modal Button */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Configure Hyperliquid Agent Wallet & API"
          >
            <Settings size={15} />
          </button>

          {/* Refresh Account */}
          <button
            onClick={() => {
              fetchAccount();
              fetchStatus();
              fetchHistory();
              onNotify("Refreshed Hyperliquid state");
            }}
            disabled={isLoadingAccount}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Account State"
          >
            <RefreshCw size={15} className={isLoadingAccount ? "animate-spin text-emerald-400" : ""} />
          </button>

          {/* Expand / Minimize Width */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Collapse Panel" : "Expand Panel"}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Close Panel Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Jurisdiction & Safe Mode Notice */}
      <div className="px-3 py-1.5 bg-amber-950/20 border-b border-amber-900/30 text-[10px] text-amber-300/90 flex items-center justify-between">
        <span className="flex items-center gap-1.5 truncate">
          <Globe size={12} className="shrink-0 text-amber-400" />
          <span>{config?.isTestnet ? "Testnet Integration Mode (Paper Funds). Mainnet is protected." : "Mainnet Active. Non-US jurisdiction verified."}</span>
        </span>
        <button
          onClick={() => setIsConfigModalOpen(true)}
          className="text-[9px] underline text-amber-400 font-bold hover:text-white shrink-0 ml-2"
        >
          Keys
        </button>
      </div>

      {/* 2. REAL-TIME ACCOUNT BALANCE BAR */}
      <div className="p-3 bg-gradient-to-b from-[#101420] to-[#0b0e14] border-b border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold text-slate-300">Hyperliquid Clearinghouse</span>
          <span className="text-[10px] font-mono text-emerald-400">USDC Margin</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#141926] p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Account Value</div>
            <div className="text-sm font-black text-white font-mono mt-0.5">
              ${accountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-[#141926] p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Available Margin</div>
            <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
              ${availableMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-[#141926] p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Total In Use</div>
            <div className="text-sm font-black text-slate-300 font-mono mt-0.5">
              ${totalMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 bg-[#0d1017] text-xs">
        <button
          onClick={() => setActiveTab("TRADE")}
          className={`flex-1 py-2 font-bold transition-colors border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "TRADE"
              ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          <Zap size={13} />
          <span>Trade Control</span>
        </button>

        <button
          onClick={() => setActiveTab("POSITIONS")}
          className={`flex-1 py-2 font-bold transition-colors border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "POSITIONS"
              ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          <Layers size={13} />
          <span>Positions ({positions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`flex-1 py-2 font-bold transition-colors border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "HISTORY"
              ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          <Activity size={13} />
          <span>Fills</span>
        </button>

        <button
          onClick={() => setActiveTab("AUDIT")}
          className={`flex-1 py-2 font-bold transition-colors border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "AUDIT"
              ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          <ShieldCheck size={13} />
          <span>Audit Log</span>
        </button>
      </div>

      {/* 4. MAIN TAB BODIES */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {/* ==================== TAB: TRADE CONTROL ==================== */}
        {activeTab === "TRADE" && (
          <>
            {/* SIGNAL SCOPE CONFIRMED SIGNAL CARD */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#121826] to-[#0e131f] border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isBuySignal ? "bg-emerald-400 animate-ping" : isSellSignal ? "bg-rose-400 animate-ping" : "bg-slate-400"
                    }`}
                  />
                  <span className="text-xs font-black uppercase text-slate-300 tracking-wider">
                    Signal Scope • {coin} ({timeframe})
                  </span>
                </div>
                <div
                  className={`text-xs font-black px-2 py-0.5 rounded-full uppercase border ${
                    isBuySignal
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : isSellSignal
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                      : "bg-slate-700 text-slate-300 border-slate-600"
                  }`}
                >
                  {technicals.signal}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-black/30 rounded-lg border border-slate-800/60 mb-2">
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">CONFIDENCE</div>
                  <div className="text-xs font-black text-amber-400 font-mono">{technicals.confidence}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">RSI (14)</div>
                  <div className="text-xs font-black text-slate-200 font-mono">{technicals.rsi}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">CYCLE LOCK</div>
                  <div className="text-xs font-black text-emerald-400 font-mono">{technicals.lockedRemainingSeconds}s</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 py-0.5">
                <span>Entry: <strong className="text-white font-mono">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: decimals })}</strong></span>
                <button
                  type="button"
                  onClick={applySignalScopeTargets}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer flex items-center gap-1"
                >
                  <Target size={12} /> Apply Signal to TP/SL
                </button>
              </div>

              {/* Signal alignment toggle */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={lockToSignalDirection}
                    onChange={(e) => setLockToSignalDirection(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Lock execution to confirmed signal direction</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  {lockToSignalDirection ? "(Strict Safeguard)" : "(Manual Override)"}
                </span>
              </div>
            </div>

            {/* ORDER PARAMETERS FORM */}
            <div className="p-3 rounded-xl bg-[#101420] border border-slate-800 space-y-3">
              {/* Margin & Mode Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-emerald-400" /> Margin (USDC)
                </span>
                <div className="flex items-center gap-1 bg-[#141926] p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setIsIsolated(true)}
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      isIsolated ? "bg-emerald-500 text-black shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Isolated
                  </button>
                  <button
                    onClick={() => setIsIsolated(false)}
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      !isIsolated ? "bg-emerald-500 text-black shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Cross
                  </button>
                </div>
              </div>

              {/* Margin Input & Presets */}
              <div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={marginInput}
                    onChange={(e) => setMarginInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#161c2c] border border-slate-700 focus:border-emerald-500 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg outline-none pr-14"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400">USDC</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {MARGIN_QUICK_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMarginInput(amt.toString())}
                      className="py-1 rounded bg-[#161c2c] hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-bold transition-colors cursor-pointer text-center border border-slate-800"
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  <span>Available: ${availableMargin.toFixed(2)} USDC</span>
                  <button
                    type="button"
                    onClick={() => setMarginInput(Math.max(10, Math.floor(availableMargin * 0.95)).toString())}
                    className="text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Use Max (95%)
                  </button>
                </div>
              </div>

              {/* Leverage Slider & Presets */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="text-slate-300 font-bold">Leverage:</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
                <div className="flex items-center justify-between gap-1 mt-2">
                  {LEVERAGE_PRESETS.map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        leverage === lev
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                          : "bg-[#141926] text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Protective Orders: Take Profit & Stop Loss */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <ShieldAlert size={13} className="text-amber-400" /> Protective Trigger Orders
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Reduce-Only Guaranteed</span>
                </div>

                {/* TP row */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableTP}
                        onChange={(e) => setEnableTP(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-semibold text-emerald-400">Take Profit</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {technicals.tpTargets && technicals.tpTargets.length > 0 ? (
                        technicals.tpTargets.slice(0, 4).map((tp, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setTpPriceInput(tp.toFixed(decimals))}
                            className="px-1.5 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-600 text-[10px] font-mono text-emerald-300 hover:text-white border border-emerald-800/60 cursor-pointer font-bold"
                            title={`TATS PRO TP${idx + 1}: $${tp.toFixed(decimals)}`}
                          >
                            TP{idx + 1}
                          </button>
                        ))
                      ) : (
                        [1.5, 3.0, 5.0].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              if (currentPrice > 0) {
                                const mult = isBuySignal ? 1 + pct / 100 : 1 - pct / 100;
                                setTpPriceInput((currentPrice * mult).toFixed(decimals));
                              }
                            }}
                            className="px-1.5 py-0.2 rounded bg-[#161c2c] hover:bg-slate-700 text-[9px] font-mono text-emerald-300 border border-slate-800 cursor-pointer"
                          >
                            +{pct}%
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  {enableTP && (
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={tpPriceInput}
                        onChange={(e) => setTpPriceInput(e.target.value)}
                        placeholder="Target trigger price"
                        className="w-full bg-[#161c2c] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg outline-none pr-12"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] font-mono text-slate-500">USDC</span>
                    </div>
                  )}
                </div>

                {/* SL row */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableSL}
                        onChange={(e) => setEnableSL(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-semibold text-rose-400">Stop Loss</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {technicals.stopLoss > 0 && (
                        <button
                          type="button"
                          onClick={() => setSlPriceInput(technicals.stopLoss.toFixed(decimals))}
                          className="px-1.5 py-0.5 rounded bg-rose-950/90 hover:bg-rose-700 text-[10px] font-mono text-rose-300 hover:text-white border border-rose-800/60 cursor-pointer font-bold"
                          title={`Set TATS PRO Stop Loss: $${technicals.stopLoss.toFixed(decimals)}`}
                        >
                          TATS SL
                        </button>
                      )}
                      {[0.8, 1.5, 2.5].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            if (currentPrice > 0) {
                              const mult = isBuySignal ? 1 - pct / 100 : 1 + pct / 100;
                              setSlPriceInput((currentPrice * mult).toFixed(decimals));
                            }
                          }}
                          className="px-1.5 py-0.2 rounded bg-[#161c2c] hover:bg-slate-700 text-[9px] font-mono text-rose-300 border border-slate-800 cursor-pointer"
                        >
                          -{pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  {enableSL && (
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={slPriceInput}
                        onChange={(e) => setSlPriceInput(e.target.value)}
                        placeholder="Stop trigger price"
                        className="w-full bg-[#161c2c] border border-slate-700 focus:border-rose-500 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg outline-none pr-12"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] font-mono text-slate-500">USDC</span>
                    </div>
                  )}
                </div>

                {/* Slippage & Notional Summary */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <span>Slippage:</span>
                    <select
                      value={slippage}
                      onChange={(e) => setSlippage(parseFloat(e.target.value))}
                      className="bg-[#141926] border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white font-mono outline-none"
                    >
                      <option value="0.001">0.1%</option>
                      <option value="0.003">0.3%</option>
                      <option value="0.005">0.5% (Default)</option>
                      <option value="0.01">1.0%</option>
                    </select>
                  </div>
                  <div>
                    Notional: <strong className="text-white font-mono">${notionalUSD.toFixed(2)}</strong> (~{estimatedCoins.toFixed(4)} {coin})
                  </div>
                </div>
              </div>
            </div>

            {/* DUAL EXECUTION ACTIONS (PROMINENT BUY & SELL BUTTONS) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isBuyDisabled}
                onClick={() => handleInitiateOrder("BUY")}
                className={`py-3.5 px-3 rounded-xl font-black text-sm tracking-wide uppercase transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer ${
                  isBuyDisabled
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-950/50 hover:shadow-emerald-900/60 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-1">
                  <ArrowUp size={16} className="font-extrabold stroke-[3]" />
                  <span>OPEN BUY ON HYPERLIQUID</span>
                </div>
                <span className="text-[10px] font-mono font-normal opacity-90">
                  LONG • {leverage}x • ${notionalUSD.toFixed(0)}
                </span>
              </button>

              <button
                type="button"
                disabled={isSellDisabled}
                onClick={() => handleInitiateOrder("SELL")}
                className={`py-3.5 px-3 rounded-xl font-black text-sm tracking-wide uppercase transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer ${
                  isSellDisabled
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-950/50 hover:shadow-rose-900/60 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-1">
                  <ArrowDown size={16} className="font-extrabold stroke-[3]" />
                  <span>OPEN SELL ON HYPERLIQUID</span>
                </div>
                <span className="text-[10px] font-mono font-normal opacity-90">
                  SHORT • {leverage}x • ${notionalUSD.toFixed(0)}
                </span>
              </button>
            </div>

            {/* Signal Lock notice if one side is disabled */}
            {lockToSignalDirection && (isBuyDisabled || isSellDisabled) && (
              <div className="p-2 rounded-lg bg-[#141926] border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Lock size={12} />
                  <span>
                    Opposite action disabled: Signal Scope is currently <strong>{technicals.signal}</strong>.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setLockToSignalDirection(false)}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  Unlock
                </button>
              </div>
            )}

            {/* Last Execution Report Banner */}
            {lastExecutionReport && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  lastExecutionReport.safeCloseExecuted
                    ? "bg-amber-950/30 border-amber-500/50 text-amber-300"
                    : "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>{lastExecutionReport.safeCloseExecuted ? "Safety Close Notice" : "Order Execution Complete"}</span>
                </div>
                <div className="mt-1 font-mono text-[11px]">
                  Filled: {lastExecutionReport.filledSize} @ ${parseFloat(lastExecutionReport.filledPrice || "0").toFixed(decimals)}
                </div>
                {lastExecutionReport.exposureAlert && (
                  <div className="mt-1 text-[10px] text-amber-200">
                    {lastExecutionReport.exposureAlert}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ==================== TAB: POSITIONS ==================== */}
        {activeTab === "POSITIONS" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Active Positions on Hyperliquid</span>
              <button
                onClick={fetchAccount}
                className="text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="p-8 text-center bg-[#101420] rounded-xl border border-slate-800 text-slate-500">
                <Layers size={28} className="mx-auto mb-2 opacity-40" />
                <div className="text-sm font-bold text-slate-400">No Open Positions</div>
                <div className="text-xs text-slate-500 mt-1">Execute a trade from Trade Control to open a live position.</div>
              </div>
            ) : (
              positions.map((pos) => {
                const isProfitable = pos.unrealizedPnl >= 0;
                return (
                  <div
                    key={pos.coin}
                    className="p-3 rounded-xl bg-[#101420] border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">{pos.coin}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            pos.side === "LONG"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {pos.side} {pos.leverage}x
                        </span>
                      </div>
                      <div
                        className={`font-mono font-black text-sm ${
                          isProfitable ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isProfitable ? "+" : ""}${pos.unrealizedPnl.toFixed(2)} ({pos.returnOnEquity.toFixed(2)}%)
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-black/30 p-2 rounded-lg border border-slate-800/80">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase">Size</div>
                        <div className="text-slate-200 font-bold">{pos.size} {pos.coin}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase">Entry Price</div>
                        <div className="text-slate-200 font-bold">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase">Liq Price</div>
                        <div className="text-rose-400 font-bold">
                          {pos.liquidationPrice > 0 ? `$${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "None"}
                        </div>
                      </div>
                    </div>

                    {/* Active TP / SL tags */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        {pos.tpOrder ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                            TP: ${pos.tpOrder.price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">No TP</span>
                        )}
                        {pos.slOrder ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono">
                            SL: ${pos.slOrder.price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">No SL</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleClosePosition(pos.coin)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs transition-colors cursor-pointer border border-rose-500/30"
                      >
                        CLOSE POSITION
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ==================== TAB: FILLS ==================== */}
        {activeTab === "HISTORY" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Executed Hyperliquid Fills</span>
              <button
                onClick={fetchHistory}
                className="text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {historyFills.length === 0 ? (
              <div className="p-8 text-center bg-[#101420] rounded-xl border border-slate-800 text-slate-500">
                <Activity size={28} className="mx-auto mb-2 opacity-40" />
                <div className="text-sm font-bold text-slate-400">No Recent Fills</div>
                <div className="text-xs text-slate-500 mt-1">Fills will appear here once executed on Hyperliquid.</div>
              </div>
            ) : (
              historyFills.slice(0, 15).map((fill: any, idx: number) => {
                const isBuy = fill.dir?.toLowerCase().includes("buy") || fill.side === "B";
                return (
                  <div
                    key={fill.tid || idx}
                    className="p-2.5 rounded-lg bg-[#101420] border border-slate-800 font-mono text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={isBuy ? "text-emerald-400" : "text-rose-400"}>
                          {isBuy ? "BUY" : "SELL"}
                        </span>
                        <span className="text-white">{fill.coin}</span>
                        <span className="text-[10px] text-slate-500">{new Date(fill.time).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Size: {fill.sz} • Px: ${parseFloat(fill.px).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Fee</div>
                      <div className="text-slate-300">${parseFloat(fill.fee || "0").toFixed(4)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ==================== TAB: AUDIT LOG ==================== */}
        {activeTab === "AUDIT" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Risk & Protection Audit Trail</span>
              <button
                onClick={fetchHistory}
                className="text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center bg-[#101420] rounded-xl border border-slate-800 text-slate-500">
                <ShieldCheck size={28} className="mx-auto mb-2 opacity-40" />
                <div className="text-sm font-bold text-slate-400">Audit Trail Clean</div>
                <div className="text-xs text-slate-500 mt-1">Order submissions, protective order triggers, and safe closures are tracked here.</div>
              </div>
            ) : (
              auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border font-mono text-xs ${
                    log.status === "PROTECTION_TRIGGERED"
                      ? "bg-amber-950/20 border-amber-500/40"
                      : "bg-[#101420] border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">{log.type}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {log.coin} • {log.side} • Size: {log.size}
                  </div>
                  {log.exposureReport && (
                    <div className="mt-1 text-[10px] text-amber-300/90 font-sans">
                      {log.exposureReport}
                    </div>
                  )}
                  <div className="text-[9px] text-slate-500 mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ==================== CONFIRMATION MODAL ==================== */}
      {isConfirmModalOpen && pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border-2 border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white ${
                    pendingAction === "BUY" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {pendingAction === "BUY" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">CONFIRM HYPERLIQUID ORDER</h3>
                  <div className="text-[11px] text-slate-400">Manual Admin Authorization Required</div>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono bg-black/40 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Action:</span>
                <span className={pendingAction === "BUY" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  MARKET {pendingAction} ({isIsolated ? "Isolated" : "Cross"})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Asset:</span>
                <span className="text-white font-bold">{coin} (Perpetual)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Margin:</span>
                <span className="text-white font-bold">${marginVal.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Leverage:</span>
                <span className="text-amber-400 font-bold">{leverage}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Notional Size:</span>
                <span className="text-white font-bold">${notionalUSD.toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Take Profit:</span>
                <span className="text-emerald-400 font-bold">
                  {enableTP && tpPriceInput ? `$${tpPriceInput}` : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Stop Loss:</span>
                <span className="text-rose-400 font-bold">
                  {enableSL && slPriceInput ? `$${slPriceInput}` : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Environment:</span>
                <span className="text-amber-400 font-bold">{config?.isTestnet ? "TESTNET" : "MAINNET"}</span>
              </div>
            </div>

            {/* Admin Passcode Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Admin Passcode (Mandatory):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="Enter admin passcode"
                  className="w-full bg-[#182032] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none"
                />
                <Key size={14} className="absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleExecuteOrder}
                className={`flex-1 py-3 rounded-xl font-black text-sm tracking-wide uppercase transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer ${
                  pendingAction === "BUY"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60"
                } ${isExecuting ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Executing on Hyperliquid...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Authorize & Execute {pendingAction}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isExecuting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONFIG / SETTINGS MODAL ==================== */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border-2 border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">HYPERLIQUID AGENT WALLET SETUP</h3>
                  <div className="text-[11px] text-slate-400">Secure Backend Signing • Zero Master Seed Access</div>
                </div>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Instruction banner */}
            <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl text-xs text-purple-200/90 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-purple-300">
                <HelpCircle size={14} />
                <span>How Hyperliquid Agent Wallets Work:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                1. Go to{" "}
                <a
                  href={cfgIsTestnet ? "https://app.hyperliquid-testnet.xyz" : "https://app.hyperliquid.xyz"}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-emerald-400 font-bold inline-flex items-center gap-0.5"
                >
                  Hyperliquid {cfgIsTestnet ? "Testnet" : "Mainnet"} <ExternalLink size={10} />
                </a>{" "}
                &rarr; Portfolio/Trade &rarr; <strong>Settings &rarr; API Wallets</strong>.
              </p>
              <p className="text-[11px] leading-relaxed">
                2. Click <strong>&ldquo;Create API Wallet&rdquo;</strong> and sign with MetaMask to approve.
              </p>
              <p className="text-[11px] leading-relaxed">
                3. Copy the generated <strong>Agent Private Key</strong> into the box below. Your master MetaMask seed is never requested or stored.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              {/* Master Account Address */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Master Wallet Address (Your EVM / MetaMask Account):
                </label>
                <input
                  type="text"
                  value={cfgMasterAddress}
                  onChange={(e) => setCfgMasterAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#182032] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none"
                  required
                />
              </div>

              {/* Agent Private Key */}
              <div>
                <label className="font-bold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>Agent Wallet Private Key (Signing Key):</span>
                  <span className="text-[10px] text-amber-400 font-mono">Backend Secure Enclave</span>
                </label>
                <input
                  type="password"
                  value={cfgAgentKey}
                  onChange={(e) => setCfgAgentKey(e.target.value)}
                  placeholder={config?.configured ? "••••••••••••••••••••••••••••••••••••••••" : "0x..."}
                  className="w-full bg-[#182032] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Never commit or share this. Stored only in server memory for EIP-712 order signing.
                </span>
              </div>

              {/* Environment Toggle (Testnet / Mainnet) */}
              <div className="p-3 bg-black/40 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Environment:</span>
                  <div className="flex items-center gap-1 bg-[#141926] p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCfgIsTestnet(true)}
                      className={`px-3 py-1 rounded font-bold cursor-pointer transition-all ${
                        cfgIsTestnet ? "bg-amber-500 text-black shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Testnet (Safe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCfgIsTestnet(false)}
                      className={`px-3 py-1 rounded font-bold cursor-pointer transition-all ${
                        !cfgIsTestnet ? "bg-emerald-500 text-black shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Mainnet
                    </button>
                  </div>
                </div>

                {!cfgIsTestnet && (
                  <label className="flex items-center gap-2 pt-1 text-rose-300">
                    <input
                      type="checkbox"
                      checked={cfgMainnetAllowed}
                      onChange={(e) => setCfgMainnetAllowed(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold">
                      I have verified testnet trades and explicitly authorize real Mainnet trading.
                    </span>
                  </label>
                )}
              </div>

              {/* Daily Loss Limit Circuit Breaker */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Daily Loss Circuit Breaker ($):
                  </label>
                  <input
                    type="number"
                    value={cfgDailyLimit}
                    onChange={(e) => setCfgDailyLimit(e.target.value)}
                    className="w-full bg-[#182032] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Admin Passcode:
                  </label>
                  <input
                    type="password"
                    value={cfgAdminPasscode}
                    onChange={(e) => setCfgAdminPasscode(e.target.value)}
                    className="w-full bg-[#182032] border border-slate-700 focus:border-emerald-500 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none"
                    required
                  />
                </div>
              </div>

              {cfgStatusMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-mono ${
                    cfgStatusMsg.startsWith("Success")
                      ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
                  }`}
                >
                  {cfgStatusMsg}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCfg}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wide transition-colors cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                >
                  {isSavingCfg ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Verify & Save Configuration</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
