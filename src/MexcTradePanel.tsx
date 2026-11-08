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
} from "lucide-react";
import { TechnicalIndicators } from "./technicalAnalysis.ts";

export interface MexcPosition {
  id: string;
  orderId: string;
  symbol: string;
  mexcSymbol: string;
  side: "LONG" | "SHORT";
  openType: "Isolated" | "Cross";
  leverage: number;
  entryPrice: number;
  markPrice: number;
  quantityUsdt: number;
  vol: number;
  margin: number;
  takeProfit: number | null;
  stopLoss: number | null;
  pnl: number;
  pnlPercent: number;
  createdAt: number;
  mode: "LIVE" | "SIMULATED";
}

interface MexcTradePanelProps {
  symbol: string;
  timeframe?: string;
  currentPrice: number;
  decimals?: number;
  technicals: TechnicalIndicators;
  onNotify: (msg: string) => void;
  onPlayChime?: () => void;
  onClose?: () => void;
}

const LEVERAGE_PRESETS = [5, 10, 20, 25, 50, 75, 100, 125, 200];

export const MexcTradePanel: React.FC<MexcTradePanelProps> = ({
  symbol,
  timeframe = "1m",
  currentPrice,
  decimals = 2,
  technicals,
  onNotify,
  onPlayChime,
  onClose,
}) => {
  // Trade Form State
  const [activeTab, setActiveTab] = useState<"trade" | "ai_strategy">("trade");
  const [panelWidth, setPanelWidth] = useState<"standard" | "wide">("wide");
  const [tradeAction, setTradeAction] = useState<"open" | "close">("open");
  const [orderType, setOrderType] = useState<"limit" | "market">("market");
  const [marginMode, setMarginMode] = useState<"Isolated" | "Cross">("Isolated");
  const [leverage, setLeverage] = useState<number>(25);
  const [priceInput, setPriceInput] = useState<string>(currentPrice.toFixed(decimals));
  const [quantityUsdt, setQuantityUsdt] = useState<string>("100");
  const [percentSlider, setPercentSlider] = useState<number>(25);

  // TP / SL State (Auto-filled from AI Signal)
  const [tpslEnabled, setTpslEnabled] = useState(true);
  const [takeProfitInput, setTakeProfitInput] = useState<string>("");
  const [stopLossInput, setStopLossInput] = useState<string>("");
  const [autoSyncSignal, setAutoSyncSignal] = useState(true);

  // Modals & Panels
  const [isLeverageModalOpen, setIsLeverageModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"positions" | "history">("positions");
  const [enforceSignalDirection, setEnforceSignalDirection] = useState<boolean>(true);

  // MEXC API Credentials State
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("mexc_api_key") || "");
  const [secretKey, setSecretKey] = useState<string>(() => localStorage.getItem("mexc_secret_key") || "");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [accountBalance, setAccountBalance] = useState<number>(10000.0);
  const [apiError, setApiError] = useState<string | null>(null);

  // Positions and Orders
  const [positions, setPositions] = useState<MexcPosition[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update price input if in Market mode
  useEffect(() => {
    if (orderType === "market" || !priceInput) {
      setPriceInput(currentPrice.toFixed(decimals));
    }
  }, [currentPrice, orderType, decimals]);

  // Auto-sync TP & SL from AI Technical Analysis
  useEffect(() => {
    if (autoSyncSignal && technicals && technicals.targetPrice > 0) {
      setTakeProfitInput(technicals.targetPrice.toFixed(decimals));
      setStopLossInput(technicals.stopLoss.toFixed(decimals));
    }
  }, [technicals, autoSyncSignal, decimals]);

  // Sync positions from backend periodically
  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/mexc/positions");
      const data = await res.json();
      if (data.success && Array.isArray(data.positions)) {
        // Calculate updated unrealized PnL based on current price
        const updated = data.positions.map((p: MexcPosition) => {
          if (p.symbol === symbol) {
            const priceDiff = p.side === "LONG" ? currentPrice - p.entryPrice : p.entryPrice - currentPrice;
            const pnlPercent = (priceDiff / p.entryPrice) * p.leverage * 100;
            const pnl = (pnlPercent / 100) * p.margin;
            return {
              ...p,
              markPrice: currentPrice,
              pnl: parseFloat(pnl.toFixed(2)),
              pnlPercent: parseFloat(pnlPercent.toFixed(2)),
            };
          }
          return p;
        });
        setPositions(updated);
      }
    } catch {}
  };

  useEffect(() => {
    fetchPositions();
    const timer = setInterval(fetchPositions, 3000);
    return () => clearInterval(timer);
  }, [symbol, currentPrice]);

  // Verify MEXC API Keys
  const handleVerifyApiKey = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      setApiError("Please provide both MEXC API Key and Secret Key.");
      return;
    }
    setIsVerifying(true);
    setApiError(null);
    try {
      const res = await fetch("/api/mexc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), secretKey: secretKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIsVerified(true);
        if (data.balance) {
          setAccountBalance(data.balance);
        }
        localStorage.setItem("mexc_api_key", apiKey.trim());
        localStorage.setItem("mexc_secret_key", secretKey.trim());
        onNotify("🟢 MEXC Perpetual Futures API successfully verified!");
        if (onPlayChime) onPlayChime();
        setIsApiKeyModalOpen(false);
      } else {
        setIsVerified(false);
        setApiError(data.error || "Failed to authenticate with MEXC API.");
      }
    } catch (err: any) {
      setApiError(err.message || "Network error verifying MEXC API.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Quick USDT percentage slider
  const handlePercentChange = (pct: number) => {
    setPercentSlider(pct);
    const amount = (accountBalance * (pct / 100)).toFixed(1);
    setQuantityUsdt(amount);
  };

  // Binary Strict Signal Direction as user requested:
  // If signal is BUY on any selected timeframe: Open Short is strictly OFF (disabled), Open Long is ON (active).
  // If signal is SELL on any selected timeframe: Open Long is strictly OFF (disabled), Open Short is ON (active).
  const isBuySignal = technicals.direction === "UP" || technicals.signal.includes("BUY");
  const isSellSignal = !isBuySignal;
  const isLongDisabled = !isBuySignal;
  const isShortDisabled = !isSellSignal;

  // Submit Order (Long or Short)
  const handleExecuteOrder = async (side: 1 | 3) => {
    if (side === 1 && isLongDisabled) {
      onNotify(`🔒 Open Long is OFF because AI Signal is SELL on ${timeframe.toUpperCase()}.`);
      return;
    }
    if (side === 3 && isShortDisabled) {
      onNotify(`🔒 Open Short is OFF because AI Signal is BUY on ${timeframe.toUpperCase()}.`);
      return;
    }

    if (!apiKey.trim() || !secretKey.trim()) {
      onNotify("🔑 Please paste your MEXC API Key & Secret Key to send orders to MEXC!");
      setIsApiKeyModalOpen(true);
      return;
    }

    const qty = parseFloat(quantityUsdt);
    if (isNaN(qty) || qty <= 0) {
      onNotify("Please enter a valid order quantity in USDT.");
      return;
    }

    const orderPrice = orderType === "market" ? currentPrice : parseFloat(priceInput) || currentPrice;

    setIsSubmitting(true);
    try {
      const payload = {
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        symbol,
        side, // 1: Open Long, 3: Open Short
        type: orderType === "limit" ? 1 : 5,
        openType: marginMode === "Isolated" ? 1 : 2,
        leverage,
        price: orderPrice,
        quantityUsdt: qty,
        takeProfit: tpslEnabled && takeProfitInput ? parseFloat(takeProfitInput) : null,
        stopLoss: tpslEnabled && stopLossInput ? parseFloat(stopLossInput) : null,
      };

      const res = await fetch("/api/mexc/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onNotify(`🚀 ${side === 1 ? "Open Long" : "Open Short"} executed on MEXC! Mode: ${data.mode}`);
        if (onPlayChime) onPlayChime();
        fetchPositions();
      } else {
        onNotify(`❌ Error: ${data.error || "Order rejected by MEXC"}`);
      }
    } catch (err: any) {
      onNotify(`Order failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close Position
  const handleClosePosition = async (positionId: string) => {
    try {
      const res = await fetch("/api/mexc/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId }),
      });
      const data = await res.json();
      if (data.success) {
        onNotify("Position closed at market price");
        fetchPositions();
      }
    } catch {}
  };

  // Calculations
  const qtyNum = parseFloat(quantityUsdt) || 0;
  const marginRequired = qtyNum > 0 ? (qtyNum / leverage).toFixed(2) : "0.00";
  const maxLong = (accountBalance * leverage).toFixed(1);
  const maxShort = (accountBalance * leverage).toFixed(1);

  // Liquidation Price Estimate
  const estLiqLong = currentPrice > 0 ? (currentPrice * (1 - 0.9 / leverage)).toFixed(decimals) : "0.00";
  const estLiqShort = currentPrice > 0 ? (currentPrice * (1 + 0.9 / leverage)).toFixed(decimals) : "0.00";

  return (
    <aside
      className={`h-full bg-[#090c12] border-l border-[#161d2b] flex flex-col shrink-0 select-none text-slate-200 text-xs overflow-hidden transition-all duration-200 ${
        panelWidth === "wide" ? "w-88 sm:w-96 lg:w-[420px]" : "w-80 sm:w-84 xl:w-88"
      }`}
    >
      {/* 1. TOP TABS (Trade vs AI Strategy) + Quick Actions */}
      <div className="h-11 bg-[#0a0e16] border-b border-[#161d2b] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("trade")}
            className={`px-3 py-1 font-bold text-xs rounded-md transition-colors cursor-pointer ${
              activeTab === "trade"
                ? "bg-[#182234] text-blue-400 border border-blue-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Trade Control
          </button>
          <button
            onClick={() => setActiveTab("ai_strategy")}
            className={`px-2.5 py-1 font-bold text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ai_strategy"
                ? "bg-purple-950/80 text-purple-300 border border-purple-500/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap size={13} className="text-purple-400" />
            <span>AI Radar TP/SL</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Width expand/contract button */}
          <button
            onClick={() => setPanelWidth(panelWidth === "wide" ? "standard" : "wide")}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={panelWidth === "wide" ? "Standard width" : "Wider panel"}
          >
            {panelWidth === "wide" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* API Key Settings Button */}
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
              isVerified
                ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
                : apiKey
                ? "bg-amber-950/60 border-amber-500/50 text-amber-300"
                : "bg-[#131926] border-[#20293d] text-slate-400 hover:text-white"
            }`}
            title="Configure MEXC Perpetual Futures API Credentials"
          >
            <Key size={12} className={isVerified ? "text-emerald-400" : "text-amber-400"} />
            <span>{isVerified ? "MEXC Live" : "API Keys"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Close panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. SUB-BAR: Open / Close Segmented Control */}
      <div className="p-2.5 pb-1 bg-[#090c12] border-b border-[#141b29] shrink-0">
        <div className="grid grid-cols-2 gap-1 bg-[#10141e] p-1 rounded-lg border border-[#1b2333]">
          <button
            onClick={() => setTradeAction("open")}
            className={`py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
              tradeAction === "open"
                ? "bg-[#1f2b42] text-white shadow-md border border-blue-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setTradeAction("close")}
            className={`py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
              tradeAction === "close"
                ? "bg-[#1f2b42] text-white shadow-md border border-blue-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Close
          </button>
        </div>
      </div>

      {/* SCROLLABLE TRADE FORM BODY */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* LEVERAGE & MARGIN BAR (Matches MEXC HTML Snippet: [B] Isolated 25X / [S] Isolated 25X) */}
        <div className="bg-[#10141e] border border-[#1d273a] rounded-lg p-2 flex items-center justify-between">
          <button
            onClick={() => setIsLeverageModalOpen(true)}
            className="flex-1 flex items-center justify-between px-2 py-1 bg-[#151b27] hover:bg-[#1c2538] border border-[#232f46] rounded-md text-xs font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            title="Adjust Futures Leverage (5X to 200X)"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center">
                B
              </span>
              <span>{marginMode}</span>
              <span className="text-amber-400 font-black">{leverage}X</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          <div className="w-1.5" />

          <button
            onClick={() => setIsLeverageModalOpen(true)}
            className="flex-1 flex items-center justify-between px-2 py-1 bg-[#151b27] hover:bg-[#1c2538] border border-[#232f46] rounded-md text-xs font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            title="Adjust Futures Leverage (5X to 200X)"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black flex items-center justify-center">
                S
              </span>
              <span>{marginMode}</span>
              <span className="text-amber-400 font-black">{leverage}X</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>

        {/* 3. ORDER TYPE: Limit | Market */}
        <div className="flex items-center justify-between border-b border-[#161d2b] pb-2">
          <div className="flex items-center gap-3 text-xs font-bold">
            <button
              onClick={() => setOrderType("limit")}
              className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                orderType === "limit"
                  ? "border-blue-500 text-white font-black"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Limit
            </button>
            <button
              onClick={() => setOrderType("market")}
              className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                orderType === "market"
                  ? "border-blue-500 text-white font-black"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Market
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <span>Available:</span>
            <span className="text-slate-200 font-bold">{accountBalance.toFixed(2)} USDT</span>
          </div>
        </div>

        {/* 4. AI SIGNAL RADAR AUTO-FILL BANNER (User Request: خود سیگنال نقطه ورود و تک پروفیت و استوپ رو بزاره) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
            isBuySignal
              ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-200"
              : isSellSignal
              ? "bg-rose-950/30 border-rose-500/50 text-rose-200"
              : "bg-[#111722] border-slate-700 text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black">
              <Zap size={14} className={isBuySignal ? "text-emerald-400 fill-current" : "text-rose-400 fill-current"} />
              <span>AI RADAR: {technicals.signal}</span>
              <span className="text-[10px] font-mono bg-black/50 px-1.5 py-0.2 rounded text-slate-300">
                {technicals.confidence}%
              </span>
            </div>

            <button
              onClick={() => {
                setTakeProfitInput(technicals.targetPrice.toFixed(decimals));
                setStopLossInput(technicals.stopLoss.toFixed(decimals));
                setTpslEnabled(true);
                onNotify("⚡ AI Target TP & SL applied to trade form!");
              }}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
            >
              Apply TP/SL
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-0.5">
            <div className="bg-black/40 px-2 py-1 rounded border border-white/10 flex items-center justify-between">
              <span className="text-slate-400">Target (TP):</span>
              <span className="font-bold text-emerald-400">${technicals.targetPrice.toFixed(decimals)}</span>
            </div>
            <div className="bg-black/40 px-2 py-1 rounded border border-white/10 flex items-center justify-between">
              <span className="text-slate-400">Stop (SL):</span>
              <span className="font-bold text-rose-400">${technicals.stopLoss.toFixed(decimals)}</span>
            </div>
          </div>
        </div>

        {/* 5. PRICE INPUT (USDT) */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>Price (USDT)</span>
            <span className="text-[10px] text-slate-500 font-mono">MEXC Perpetual</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="text"
              disabled={orderType === "market"}
              value={orderType === "market" ? "Market Price (BBO)" : priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className={`w-full bg-[#131924] border border-[#232c3f] rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500 ${
                orderType === "market" ? "text-slate-400 italic cursor-not-allowed" : ""
              }`}
            />
            {orderType === "limit" && (
              <button
                onClick={() => setPriceInput(currentPrice.toFixed(decimals))}
                className="absolute right-2 px-2 py-1 rounded bg-[#1e273a] hover:bg-[#28354e] text-blue-400 text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                Last
              </button>
            )}
          </div>
        </div>

        {/* 6. QUANTITY INPUT (USDT) */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>Quantity (USDT)</span>
            <span className="text-slate-300 font-mono font-bold">Margin: ${marginRequired}</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="number"
              step="10"
              value={quantityUsdt}
              onChange={(e) => setQuantityUsdt(e.target.value)}
              placeholder="100"
              className="w-full bg-[#131924] border border-[#232c3f] rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-3 text-slate-500 font-bold text-xs">USDT</span>
          </div>

          {/* Quick Percent Buttons */}
          <div className="grid grid-cols-5 gap-1 mt-1.5">
            {[10, 25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercentChange(pct)}
                className={`py-1 text-[11px] font-bold rounded border transition-colors cursor-pointer ${
                  percentSlider === pct
                    ? "bg-blue-600/40 border-blue-500 text-blue-300"
                    : "bg-[#111622] border-[#1d2638] text-slate-400 hover:text-white"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* 7. TP / SL CHECKBOX & INPUTS */}
        <div className="bg-[#10141e] border border-[#1d273a] rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tpslEnabled}
                onChange={(e) => setTpslEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <span className="font-bold text-xs text-slate-200">Take Profit / Stop Loss</span>
            </label>

            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {autoSyncSignal ? "Auto-Synced" : "Manual"}
            </span>
          </div>

          {tpslEnabled && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-emerald-400 mb-0.5">TP Price (USDT)</label>
                <input
                  type="text"
                  value={takeProfitInput}
                  onChange={(e) => {
                    setTakeProfitInput(e.target.value);
                    setAutoSyncSignal(false);
                  }}
                  className="w-full bg-[#151b26] border border-emerald-900/50 rounded-md px-2 py-1 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                  placeholder="TP Price"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-rose-400 mb-0.5">SL Price (USDT)</label>
                <input
                  type="text"
                  value={stopLossInput}
                  onChange={(e) => {
                    setStopLossInput(e.target.value);
                    setAutoSyncSignal(false);
                  }}
                  className="w-full bg-[#151b26] border border-rose-900/50 rounded-md px-2 py-1 text-rose-300 font-mono font-bold text-xs focus:outline-none focus:border-rose-500"
                  placeholder="SL Price"
                />
              </div>
            </div>
          )}
        </div>

        {/* 8. ESTIMATED METRICS */}
        <div className="bg-[#0b0e14] p-2 rounded-lg border border-[#161d2b] space-y-1 text-[11px] font-mono text-slate-400">
          <div className="flex items-center justify-between">
            <span>Est. Margin:</span>
            <span className="text-white font-bold">${marginRequired} USDT</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. Long Liq:</span>
            <span className="text-rose-400 font-bold">${estLiqLong}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. Short Liq:</span>
            <span className="text-rose-400 font-bold">${estLiqShort}</span>
          </div>
        </div>

        {/* MEXC API STATUS BANNER */}
        {!apiKey.trim() || !secretKey.trim() ? (
          <div className="bg-[#121824] border border-blue-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-amber-400 shrink-0" />
              <div>
                <div className="font-bold text-white text-xs">MEXC Perpetual Futures API</div>
                <div className="text-[11px] text-slate-400">Connect Key & Secret to open live positions</div>
              </div>
            </div>
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Connect API
            </button>
          </div>
        ) : (
          <div className="bg-[#0e1622] border border-emerald-500/40 p-2.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                  <span>MEXC API Connected (LIVE)</span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                    {apiKey.slice(0, 4)}••••{apiKey.slice(-4)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Avail: <strong className="text-white">${accountBalance.toFixed(2)} USDT</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-md transition-colors cursor-pointer shrink-0"
            >
              Edit Keys
            </button>
          </div>
        )}

        {/* 9. SIGNAL DIRECTION & EXECUTION STATUS BANNER */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
            isBuySignal
              ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-950/30"
              : "bg-rose-950/40 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/30"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                isBuySignal ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"
              }`}
            >
              {isBuySignal ? <ArrowUp size={11} className="stroke-[3]" /> : <ArrowDown size={11} className="stroke-[3]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-300">
                  {timeframe} Signal:
                </span>
                <span
                  className={`text-xs font-black px-1.5 py-0.5 rounded ${
                    isBuySignal
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {isBuySignal ? "BUY (CALL ▲)" : "SELL (PUT ▼)"}
                </span>
                <span className="text-[11px] font-mono text-slate-400 font-bold">
                  {technicals.confidence}%
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {isBuySignal ? (
                  <span className="text-emerald-400 font-semibold">
                    ✓ Open Long is ON &bull; <span className="text-slate-500">Open Short is OFF (Locked)</span>
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold">
                    ✓ Open Short is ON &bull; <span className="text-slate-500">Open Long is OFF (Locked)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`text-[10px] font-mono font-black px-2 py-1 rounded-md border ${
                isBuySignal
                  ? "bg-emerald-900/60 border-emerald-500/50 text-emerald-300"
                  : "bg-rose-900/60 border-rose-500/50 text-rose-300"
              }`}
            >
              {isBuySignal ? "BUY MODE" : "SELL MODE"}
            </span>
          </div>
        </div>

        {/* 10. MAIN ACTION BUTTONS: OPEN LONG / OPEN SHORT */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Open Long Button */}
          <button
            onClick={() => handleExecuteOrder(1)}
            disabled={isSubmitting || isLongDisabled}
            className={`py-3.5 px-3 rounded-xl font-black text-sm flex flex-col items-center justify-center transition-all ${
              isLongDisabled
                ? "bg-[#0c1017] border border-slate-800/80 text-slate-600 opacity-25 cursor-not-allowed pointer-events-none select-none shadow-none"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/70 ring-2 ring-emerald-400 cursor-pointer active:scale-95 animate-pulse"
            }`}
            title={
              isLongDisabled
                ? `Open Long is OFF (AI Signal is SELL on ${timeframe.toUpperCase()})`
                : "Click to instantly send LONG order to MEXC Futures"
            }
          >
            <div className="flex items-center gap-1.5 text-base">
              <ArrowUp size={18} className={!isLongDisabled ? "animate-bounce" : ""} />
              <span>Open Long</span>
            </div>
            <div className="text-[10px] font-mono mt-1 font-bold">
              {isLongDisabled ? (
                <span className="text-slate-500 flex items-center gap-1">
                  <Lock size={10} />
                  <span>OFF (Signal is SELL)</span>
                </span>
              ) : (
                <span className="text-emerald-100 flex items-center gap-1">
                  <span>⚡ ON • 1-CLICK MEXC</span>
                </span>
              )}
            </div>
          </button>

          {/* Open Short Button */}
          <button
            onClick={() => handleExecuteOrder(3)}
            disabled={isSubmitting || isShortDisabled}
            className={`py-3.5 px-3 rounded-xl font-black text-sm flex flex-col items-center justify-center transition-all ${
              isShortDisabled
                ? "bg-[#0c1017] border border-slate-800/80 text-slate-600 opacity-25 cursor-not-allowed pointer-events-none select-none shadow-none"
                : "bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-950/70 ring-2 ring-rose-400 cursor-pointer active:scale-95 animate-pulse"
            }`}
            title={
              isShortDisabled
                ? `Open Short is OFF (AI Signal is BUY on ${timeframe.toUpperCase()})`
                : "Click to instantly send SHORT order to MEXC Futures"
            }
          >
            <div className="flex items-center gap-1.5 text-base">
              <ArrowDown size={18} className={!isShortDisabled ? "animate-bounce" : ""} />
              <span>Open Short</span>
            </div>
            <div className="text-[10px] font-mono mt-1 font-bold">
              {isShortDisabled ? (
                <span className="text-slate-500 flex items-center gap-1">
                  <Lock size={10} />
                  <span>OFF (Signal is BUY)</span>
                </span>
              ) : (
                <span className="text-rose-100 flex items-center gap-1">
                  <span>⚡ ON • 1-CLICK MEXC</span>
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 10. BOTTOM POSITIONS / ORDERS DRAWER */}
      <div className="h-44 bg-[#0a0d14] border-t border-[#161d2b] flex flex-col shrink-0">
        <div className="h-8 px-3 border-b border-[#161d2b] flex items-center justify-between text-xs font-bold text-slate-400">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveBottomTab("positions")}
              className={`transition-colors cursor-pointer ${
                activeBottomTab === "positions" ? "text-white font-extrabold" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Positions ({positions.length})
            </button>
            <button
              onClick={() => setActiveBottomTab("history")}
              className={`transition-colors cursor-pointer ${
                activeBottomTab === "history" ? "text-white font-extrabold" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              History
            </button>
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            {isVerified ? "MEXC Connected" : "Simulated Mode"}
          </span>
        </div>

        {/* Positions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
          {positions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-[11px]">
              No active positions. Click Open Long or Short to trade.
            </div>
          ) : (
            positions.map((pos) => {
              const isPnlPositive = pos.pnl >= 0;
              return (
                <div
                  key={pos.id}
                  className="bg-[#10141e] border border-[#1c2436] rounded-lg p-2 text-xs font-mono flex items-center justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                          pos.side === "LONG"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : "bg-rose-950 text-rose-400 border border-rose-800/40"
                        }`}
                      >
                        {pos.side} {pos.leverage}X
                      </span>
                      <span className="text-white text-xs">{pos.symbol}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Entry: ${pos.entryPrice.toFixed(decimals)}</span>
                      <span>Mark: ${pos.markPrice.toFixed(decimals)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-black text-xs ${isPnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
                      {isPnlPositive ? "+" : ""}
                      ${pos.pnl.toFixed(2)} ({isPnlPositive ? "+" : ""}
                      {pos.pnlPercent.toFixed(1)}%)
                    </div>
                    <button
                      onClick={() => handleClosePosition(pos.id)}
                      className="mt-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Close Market
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: LEVERAGE & MARGIN MODE SELECTOR */}
      {isLeverageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border-2 border-blue-500/60 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-black text-white flex items-center gap-2">
                <Sliders size={18} className="text-blue-400" />
                <span>Adjust Futures Leverage & Margin</span>
              </span>
              <button
                onClick={() => setIsLeverageModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Margin Mode Selector */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Margin Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarginMode("Isolated")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    marginMode === "Isolated"
                      ? "bg-blue-600 text-white border-blue-400 shadow-md"
                      : "bg-[#182030] border-[#25324a] text-slate-400"
                  }`}
                >
                  Isolated (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setMarginMode("Cross")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    marginMode === "Cross"
                      ? "bg-blue-600 text-white border-blue-400 shadow-md"
                      : "bg-[#182030] border-[#25324a] text-slate-400"
                  }`}
                >
                  Cross
                </button>
              </div>
            </div>

            {/* Leverage Slider (5x to 200x) */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Leverage (5X - 200X)</label>
                <span className="text-xl font-black font-mono text-amber-400">{leverage}X</span>
              </div>

              <input
                type="range"
                min="5"
                max="200"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              {/* Presets */}
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                {LEVERAGE_PRESETS.map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => setLeverage(lev)}
                    className={`py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      leverage === lev
                        ? "bg-blue-600 text-white border-blue-400"
                        : "bg-[#151c2a] border-[#222d42] text-slate-400 hover:text-white"
                    }`}
                  >
                    {lev}X
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setIsLeverageModalOpen(false);
                onNotify(`Leverage updated to ${leverage}X ${marginMode}`);
              }}
              className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
            >
              Confirm Leverage
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: MEXC API CREDENTIALS CONFIGURATION */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border-2 border-blue-500 rounded-2xl max-w-md w-full p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-base font-black text-white flex items-center gap-2">
                <Key size={20} className="text-amber-400" />
                <span>Connect MEXC Perpetual Futures API</span>
              </span>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Connect your MEXC API Key & Secret Key to open real perpetual futures positions directly from this radar.
              Permissions required on MEXC: <strong className="text-white">Futures Trade</strong>.
            </p>

            {apiError && (
              <div className="mt-3 bg-rose-950/60 border border-rose-500/50 p-2.5 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{apiError}</span>
              </div>
            )}

            {isVerified && (
              <div className="mt-3 bg-emerald-950/60 border border-emerald-500/50 p-2.5 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Connected! Live Available Balance: ${accountBalance.toFixed(2)} USDT</span>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">MEXC API Key (Access Key)</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. mx0vgl..."
                  className="w-full bg-[#161c28] border border-[#263248] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">MEXC Secret Key</label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full bg-[#161c28] border border-[#263248] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                onClick={handleVerifyApiKey}
                disabled={isVerifying}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying with MEXC...</span>
                  </>
                ) : (
                  <span>Verify & Connect</span>
                )}
              </button>

              <button
                onClick={() => {
                  setApiKey("");
                  setSecretKey("");
                  localStorage.removeItem("mexc_api_key");
                  localStorage.removeItem("mexc_secret_key");
                  setIsVerified(false);
                  onNotify("API Keys removed. Reverted to Demo Simulator.");
                }}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Need an API key?</span>
              <a
                href="https://www.mexc.com/user/openapi"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>MEXC API Management</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
