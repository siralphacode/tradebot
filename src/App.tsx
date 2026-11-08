import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  Clock,
  RefreshCw,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  ShieldCheck,
  Zap,
  Target,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Activity,
  Sliders,
  X,
  Layers,
  TrendingUp,
} from "lucide-react";
import { CandleChart, KlineData } from "./CandleChart.tsx";
import { CryptoLogo } from "./cryptoLogos.tsx";
import { computeTechnicalAnalysis, parseTimeframeSeconds } from "./technicalAnalysis.ts";
import {
  PriceAlert,
  loadAlerts,
  saveAlerts,
  checkAlertsTriggered,
  sendBrowserNotification,
  playAlertChime,
} from "./priceAlerts.ts";
import { PriceAlertModal } from "./PriceAlertModal.tsx";
import { TatsDashboardModal } from "./TatsDashboardModal.tsx";
import { CopyTradingPage } from "./CopyTradingPage.tsx";
import { loadStoredBots, saveStoredBots, getLastActiveBotId, setLastActiveBotId } from "./copyTradingData.ts";
import { BotTrader } from "./copyTradingTypes.ts";
import { Sidebar } from "./Sidebar.tsx";
import { WalletModal } from "./WalletModal.tsx";
import { TradeHistoryPage } from "./TradeHistoryPage.tsx";
import { WalletState, loadStoredWallet, saveStoredWallet } from "./walletState.ts";
import { GlobalTradeRecord, loadGlobalTradeHistory } from "./tradeHistoryState.ts";
import { TRADENEWS_API_BASE } from "./tradenews/config.ts";
import { getKlines, getTickers } from "./tradenews/api.ts";
import { getPositionHistory, getTradeHistory } from "./tradenews/apiExtended.ts";
import { BackendBanner } from "./tradenews/BackendBanner.tsx";
import { AuthModal } from "./tradenews/AuthModal.tsx";
import { DemoTradingPanel } from "./tradenews/DemoTradingPanel.tsx";
import { ReferralPanel } from "./tradenews/ReferralPanel.tsx";
import { useAuth } from "./tradenews/AuthContext.tsx";

interface CryptoTicker {
  symbol: string;
  base: string;
  name: string;
  decimals: number;
  price: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

const API_BASE: string = TRADENEWS_API_BASE;
void API_BASE;

const TIMEFRAMES = ["30s", "1m", "5m", "15m", "1h", "4h", "1d"];

function formatUSD(val: number, decimals = 2) {
  return Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function App() {
  // Selected Coin - default to BTC/USDT
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [tickers, setTickers] = useState<CryptoTicker[]>([]);
  // No fabricated starting price: 0 means "waiting for backend quote".
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Timeframe and Klines (15m is recommended for TATS PRO v1.0)
  const [chartInterval, setChartInterval] = useState("15m");
  const [klines, setKlines] = useState<KlineData[]>([]);
  const [isLoadingKlines, setIsLoadingKlines] = useState(false);

  // Toggles
  const [showSignals, setShowSignals] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // TATS PRO MTF Dashboard Modal
  const [isTatsDashboardOpen, setIsTatsDashboardOpen] = useState(false);

  // Navigation & Left Sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<"TERMINAL" | "COPY_TRADING" | "HISTORY">("TERMINAL");

  // Wallet & Assets
  const [wallet, setWallet] = useState<WalletState>(() => loadStoredWallet());
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalMode, setWalletModalMode] = useState<"CONNECT" | "DEPOSIT" | "WITHDRAW">("CONNECT");

  // Local trade journal (legacy display only) + backend history handled separately.
  const [tradeHistory] = useState<GlobalTradeRecord[]>(() => loadGlobalTradeHistory());
  const [activeBotsCount, setActiveBotsCount] = useState<number>(0);
  const [activeBot, setActiveBot] = useState<BotTrader | null>(() => {
    const bots = loadStoredBots();
    const lastId = getLastActiveBotId();
    if (lastId) {
      const found = bots.find((b) => b.id === lastId);
      if (found) return found;
    }
    const running = bots.find((b) => b.status === "RUNNING");
    return running || bots[0] || null;
  });

  useEffect(() => {
    const updateStats = () => {
      const bots = loadStoredBots();
      const running = bots.filter((b) => b.status === "RUNNING").length;
      setActiveBotsCount(running);
      setWallet(loadStoredWallet());

      const lastId = getLastActiveBotId();
      if (lastId) {
        const found = bots.find((b) => b.id === lastId);
        if (found) {
          setActiveBot(found);
          return;
        }
      }
      const runningBot = bots.find((b) => b.status === "RUNNING");
      setActiveBot(runningBot || bots[0] || null);
    };
    updateStats();
    const interval = window.setInterval(updateStats, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleToggleBotFromSidebar = (botId: string) => {
    const bots = loadStoredBots();
    const target = bots.find((b) => b.id === botId);
    if (!target) return;

    // FINANCIAL SAFETY: simulated bots must never credit/debit any wallet.
    // Bot start/stop only flips local display state; no funds move.
    const isRunning = target.status === "RUNNING";
    const updatedBots = bots.map((b) => {
      if (b.id !== botId) return b;
      if (isRunning) {
        return { ...b, status: "IDLE" as const, openPositions: [] };
      } else {
        return { ...b, status: "RUNNING" as const, startedAt: b.startedAt || Date.now() };
      }
    });

    saveStoredBots(updatedBots);
    setLastActiveBotId(botId);
    const updatedActive = updatedBots.find((b) => b.id === botId) || null;
    setActiveBot(updatedActive);

    notify(isRunning ? `Bot "${target.name}" stopped (display only).` : `Bot "${target.name}" started (display only).`);
  };

  // Price Alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [triggeredNotification, setTriggeredNotification] = useState<{
    alert: PriceAlert;
    price: number;
  } | null>(null);

  // Profit Secured & Credited Real-Time Notification
  // Legacy simulated profit toast state (kept for type stability; no longer fed).
  const [profitNotification, setProfitNotification] = useState<{
    botName: string;
    symbol: string;
    side: string;
    pnlUsdt: number;
    pnlPct: number;
    currentPrice: number;
    exitReason: string;
    newBalance: number;
  } | null>(null);
  void setProfitNotification;

  // Simulated profit events are disabled: no listener fabricates PnL or
  // wallet updates. Only explicit backend/wallet sync events are honored.
  // (Legacy "tradenews_profit_secured" fabrication path removed.)
  useEffect(() => {
    const handleWalletUpdated = (e: any) => {
      if (e.detail) {
        setWallet(e.detail);
      }
    };

    window.addEventListener("tradenews_wallet_updated", handleWalletUpdated);
    return () => {
      window.removeEventListener("tradenews_wallet_updated", handleWalletUpdated);
    };
  }, []);

  // Auto-dismiss profit notification after 6 seconds
  useEffect(() => {
    if (!profitNotification) return;
    const timer = setTimeout(() => {
      setProfitNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [profitNotification]);

  // Draggable Carousel State & Ref
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDraggingCarouselRef = useRef(false);
  const carouselStartXRef = useRef(0);
  const carouselScrollLeftRef = useRef(0);
  const hasMovedCarouselRef = useRef(false);

  const notify = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(null), 3500);
  };

  // Calculate dynamic technical analysis based on the selected timeframe
  const technicals = useMemo(() => {
    return computeTechnicalAnalysis(klines, symbol, chartInterval);
  }, [klines, symbol, chartInterval]);

  // Audio ding on fresh cycle start
  useEffect(() => {
    const tfSec = parseTimeframeSeconds(chartInterval);
    if (soundEnabled && technicals.lockedRemainingSeconds === tfSec - 1 && klines.length > 5) {
      playAlertChime();
    }
  }, [technicals.lockedRemainingSeconds, soundEnabled, klines.length, chartInterval]);

  // Price alerts trigger check
  useEffect(() => {
    if (alerts.length === 0) return;
    const priceMap: Record<string, number> = {};
    tickers.forEach((t) => {
      priceMap[t.symbol] = t.price;
    });
    if (currentPrice > 0) {
      priceMap[symbol] = currentPrice;
    }

    const { updatedAlerts, newlyTriggered } = checkAlertsTriggered(alerts, priceMap);
    if (newlyTriggered.length > 0) {
      setAlerts(updatedAlerts);
      if (soundEnabled) playAlertChime();
      const latest = newlyTriggered[newlyTriggered.length - 1];
      setTriggeredNotification(latest);
      newlyTriggered.forEach(({ alert, price }) => {
        sendBrowserNotification(alert, price);
      });
    }
  }, [tickers, currentPrice, symbol, alerts, soundEnabled]);

  // Alert handlers
  const handleAddAlert = (newAlertData: Omit<PriceAlert, "id" | "createdAt" | "triggered">) => {
    const newAlert: PriceAlert = {
      ...newAlertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      triggered: false,
    };
    const nextAlerts = [newAlert, ...alerts];
    setAlerts(nextAlerts);
    saveAlerts(nextAlerts);
    notify(`Price alert set for ${newAlert.symbol} at ${newAlert.targetPrice.toLocaleString()} USDT`);
  };

  const handleDeleteAlert = (alertId: string) => {
    const nextAlerts = alerts.filter((a) => a.id !== alertId);
    setAlerts(nextAlerts);
    saveAlerts(nextAlerts);
    notify("Alert removed");
  };

  const handleToggleAlert = (alertId: string) => {
    const nextAlerts = alerts.map((a) => (a.id === alertId ? { ...a, active: !a.active } : a));
    setAlerts(nextAlerts);
    saveAlerts(nextAlerts);
  };

  const handleClearHistory = () => {
    const nextAlerts = alerts.filter((a) => !a.triggered);
    setAlerts(nextAlerts);
    saveAlerts(nextAlerts);
    notify("Triggered alerts history cleared");
  };

  const activeAlerts = useMemo(() => alerts.filter((a) => a.active && !a.triggered), [alerts]);

  const availableSymbols = useMemo(() => {
    if (tickers.length > 0) {
      return tickers.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        price: t.price,
        decimals: t.decimals,
      }));
    }
    // No backend data yet: return an empty list. Never fabricate prices —
    // charts/alerts render an explicit "waiting for backend" state instead.
    return [] as { symbol: string; name: string; price: number; decimals: number }[];
  }, [tickers]);

  const selectedTicker = useMemo(() => {
    const found = tickers.find((t) => t.symbol === symbol);
    if (found) return found;
    // No backend quote yet: expose an explicit empty quote, never a
    // fabricated price. currentPrice 0 = "waiting for backend".
    return {
      symbol,
      base: symbol.split("/")[0] || "",
      name: symbol.split("/")[0] || "",
      decimals:
        symbol.includes("PEPE") || symbol.includes("SHIB")
          ? 6
          : symbol.includes("XRP") ||
            symbol.includes("DOGE") ||
            symbol.includes("ADA") ||
            symbol.includes("SUI") ||
            symbol.includes("NEAR") ||
            symbol.includes("DOT") ||
            symbol.includes("TRX")
          ? 4
          : 2,
      price: 0,
      priceChangePercent: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
    } as CryptoTicker;
  }, [tickers, symbol]);

  const decimals = selectedTicker.decimals;

  // Fetch live market tickers from the TradeNews Cloudflare backend.
  // If the endpoint is disabled/missing, keep the last known tickers and
  // surface the outage via BackendBanner — never fabricate prices.
  const [backendHistory, setBackendHistory] = useState<GlobalTradeRecord[] | null>(null);
  const [backendHistoryError, setBackendHistoryError] = useState<string | null>(null);
  const fetchTickers = useCallback(async () => {
    const res = await getTickers();
    if (res.ok && Array.isArray(res.data)) {
      const list = res.data as unknown as CryptoTicker[];
      if (list.length > 0) {
        setTickers(list);
        const match = list.find((t: CryptoTicker) => t.symbol === symbol);
        if (match && typeof match.price === "number" && match.price > 0) {
          setCurrentPrice(match.price);
        }
      }
    }
  }, [symbol]);

  // Fetch Klines for chart & signal computation
  const fetchKlines = useCallback(
    async (forcedInterval?: string) => {
      const activeTf = forcedInterval || chartInterval;
      try {
        setIsLoadingKlines(true);
        const res = await getKlines(symbol, activeTf, 120);
        if (res.ok && Array.isArray(res.data)) {
          const rows = res.data as unknown as KlineData[];
          if (rows.length > 0) {
            setKlines(rows);
            const last = rows[rows.length - 1];
            if (typeof last.close === "number" && last.close > 0) {
              setCurrentPrice(last.close);
            }
          }
        }
      } catch {
      } finally {
        setIsLoadingKlines(false);
      }
    },
    [symbol, chartInterval]
  );

  // Backend trade/position history (real responses only; unavailable state otherwise)
  const fetchBackendHistory = useCallback(async () => {
    const [posRes, tradeRes] = await Promise.all([getPositionHistory(), getTradeHistory()]);
    const merged: GlobalTradeRecord[] = [];
    let err: string | null = null;
    for (const r of [posRes, tradeRes]) {
      if (r.ok && Array.isArray(r.data)) {
        for (const t of r.data as any[]) {
          merged.push({
            id: String(t.id ?? `${t.symbol}-${t.timestamp}`),
            timestamp: typeof t.timestamp === "number" ? t.timestamp : Date.parse(t.timestamp || t.createdAt || "") || Date.now(),
            source: String(t.source || "TradeNews backend"),
            symbol: String(t.symbol || ""),
            side: t.side === "SHORT" ? "SHORT" : "LONG",
            entryPrice: Number(t.entryPrice ?? 0),
            exitPrice: Number(t.exitPrice ?? 0),
            sizeUsdt: Number(t.sizeUsdt ?? 0),
            leverage: Number(t.leverage ?? 1),
            pnlUsdt: Number(t.pnlUsdt ?? 0),
            pnlPct: Number(t.pnlPct ?? 0),
            exitReason: String(t.exitReason || t.status || ""),
            status: "CLOSED",
          });
        }
      } else if ((r as any).endpointDisabled || (r as any).status === 0) {
        err = (r as any).message || "History endpoint unavailable.";
      }
    }
    setBackendHistoryError(err);
    setBackendHistory(merged);
  }, []);

  // Initial load
  const { token: authToken, user: authUser, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  useEffect(() => {
    fetchTickers();
    fetchKlines();
  }, [fetchTickers, fetchKlines]);

  useEffect(() => {
    void fetchBackendHistory();
  }, [fetchBackendHistory]);

  // Polling loop every 2 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchTickers();
      fetchKlines();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [fetchTickers, fetchKlines]);
  useEffect(() => {
    if (!authToken) return;
    const timer = window.setInterval(() => {
      void fetchBackendHistory();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [authToken, fetchBackendHistory]);
  // Drag-to-scroll handlers for horizontal currency carousel
  const handleCarouselMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    isDraggingCarouselRef.current = true;
    hasMovedCarouselRef.current = false;
    carouselStartXRef.current = e.pageX - carouselRef.current.offsetLeft;
    carouselScrollLeftRef.current = carouselRef.current.scrollLeft;
  };

  const handleCarouselMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCarouselRef.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - carouselStartXRef.current) * 1.4;
    if (Math.abs(walk) > 4) {
      hasMovedCarouselRef.current = true;
    }
    carouselRef.current.scrollLeft = carouselScrollLeftRef.current - walk;
  };

  const handleCarouselMouseUp = () => {
    isDraggingCarouselRef.current = false;
  };

  const scrollCarousel = (amount: number) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const isUp = technicals.direction === "UP";
  const isDown = technicals.direction === "DOWN";
  const remainingSec = technicals.lockedRemainingSeconds ?? 60;
  const tfSeconds = parseTimeframeSeconds(chartInterval);
  const progressPercent = Math.min(100, Math.max(0, (remainingSec / tfSeconds) * 100));

  const isOptimalEntry = technicals.entryWindow === "OPTIMAL";
  const isMidCycle = technicals.entryWindow === "ACTIVE";

  return (
    <div className="flex h-screen w-screen bg-[#040706] text-[#e2e8f0] font-sans overflow-hidden select-none">
      {/* Toast Flash Alert */}
      {flashMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0a130e] border-2 border-emerald-500 text-white px-5 py-2.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <Zap size={16} className="text-emerald-400 fill-current" />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* 1. LEFT SIDEBAR: FIXED & COLLAPSIBLE */}
      <Sidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        wallet={wallet}
        onOpenWalletModal={(mode) => {
          setWalletModalMode(mode);
          setIsWalletModalOpen(true);
        }}
        activeBotsCount={activeBotsCount}
        totalTradesCount={tradeHistory.length}
        activeBot={activeBot}
        onToggleBotStatus={handleToggleBotFromSidebar}
      />

      {/* 2. MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#040706]">
        <BackendBanner onNotify={notify} />
        {/* TradeNews account strip */}
        <div className="px-3 py-1.5 border-b border-[#122018] bg-[#060a08] flex items-center gap-2 text-xs">
          {authToken && authUser ? (
            <>
              <span className="text-slate-400">Signed in as</span>
              <span className="text-white font-bold truncate">{authUser.email || authUser.username || `user ${authUser.id}`}</span>
              <button onClick={() => { signOut(); notify("Signed out."); }} className="ml-auto px-2 py-1 rounded bg-[#131c14] hover:bg-[#1c2b1f] text-slate-300 cursor-pointer">Sign Out</button>
            </>
          ) : (
            <>
              <span className="text-slate-400">TradeNews account: not signed in. Backend features require sign-in.</span>
              <button onClick={() => { setAuthModalMode("LOGIN"); setIsAuthModalOpen(true); }} className="ml-auto px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">Sign In</button>
              <button onClick={() => { setAuthModalMode("REGISTER"); setIsAuthModalOpen(true); }} className="px-2 py-1 rounded bg-[#131c14] hover:bg-[#1c2b1f] text-slate-200 cursor-pointer">Register</button>
            </>
          )}
        </div>
        {/* VIEW ROUTING (Header removed per user request; all navigation in left sidebar) */}
        {activePage === "HISTORY" ? (
          <TradeHistoryPage
            tradeHistory={backendHistory ?? tradeHistory}
            backendUnavailable={backendHistory === null ? null : backendHistoryError}
            signedIn={Boolean(authToken)}
            onClearHistory={() => {
              notify("Backend history cannot be cleared from this interface.");
            }}
            onSelectCoinForChart={(sym) => {
              setSymbol(sym);
              setActivePage("TERMINAL");
              notify(`Switched to ${sym} chart.`);
            }}
          />
        ) : activePage === "COPY_TRADING" ? (
          <CopyTradingPage
            tickers={tickers}
            onSelectCoinForChart={(sym) => {
              setSymbol(sym);
              setActivePage("TERMINAL");
              notify(`Switched to ${sym} chart.`);
            }}
            onNotify={notify}
          />
        ) : (
          <>
            {/* 1. USDT COIN SELECTOR CAROUSEL - MINIMAL & CLEAN */}
            <div className="relative h-12 bg-[#060a08] border-b border-[#122018] flex items-center shrink-0">
              {/* Scroll Left Button */}
              <button
                onClick={() => scrollCarousel(-280)}
                className="absolute left-1.5 z-20 w-7 h-7 rounded-lg bg-[#0a120e]/95 hover:bg-[#142319] text-slate-300 hover:text-white border border-[#16291e] shadow-xl flex items-center justify-center transition-all cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Carousel Container */}
              <div
                ref={carouselRef}
                onMouseDown={handleCarouselMouseDown}
                onMouseMove={handleCarouselMouseMove}
                onMouseUp={handleCarouselMouseUp}
                onMouseLeave={handleCarouselMouseUp}
                className="w-full h-full px-11 flex items-center gap-2 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing select-none"
              >
                {(tickers.length > 0 ? tickers : availableSymbols).map((t) => {
                  const isSelected = t.symbol === symbol;
                  const isPositive = (t as any).priceChangePercent >= 0;
                  return (
                    <button
                      key={t.symbol}
                      onClick={() => {
                        if (hasMovedCarouselRef.current) return;
                        setSymbol(t.symbol);
                        setCurrentPrice(t.price);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-600/35 text-white border-2 border-emerald-500 font-extrabold shadow-md shadow-emerald-950/40"
                          : "bg-[#080d0a] hover:bg-[#101b15] text-slate-300 border border-[#14221a] hover:border-emerald-700/60 font-semibold"
                      }`}
                    >
                      <CryptoLogo symbol={t.symbol} size={18} />
                      <span className="font-extrabold tracking-tight">{t.symbol}</span>
                      <span className="text-white font-mono font-bold text-xs tabular-nums">${formatUSD(t.price, t.decimals)}</span>
                      {(t as any).priceChangePercent !== undefined && (
                        <span className={`text-[11px] font-bold font-mono tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {isPositive ? "+" : ""}
                          {(t as any).priceChangePercent.toFixed(1)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Scroll Right Button */}
              <button
                onClick={() => scrollCarousel(280)}
                className="absolute right-1.5 z-20 w-7 h-7 rounded-lg bg-[#0a120e]/95 hover:bg-[#142319] text-slate-300 hover:text-white border border-[#16291e] shadow-xl flex items-center justify-center transition-all cursor-pointer"
                title="Scroll Right"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 2. SINGLE-LINE CALM INSTRUMENT TOOLBAR (Decluttered, Zero Visual Strain) */}
            <div className="h-11 bg-[#050806] border-b border-[#122018] px-3 flex items-center justify-between gap-3 shrink-0 text-xs">
              {/* Left Zone: Timeframes & Signal Badge */}
              <div className="flex items-center gap-2">
                {/* Timeframes */}
                <div className="flex items-center bg-[#080e0a] p-0.5 rounded-lg border border-[#14221a]">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setChartInterval(tf);
                        fetchKlines(tf);
                        notify(`Switched to ${tf} timeframe`);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        chartInterval === tf
                          ? "bg-emerald-600 text-white font-extrabold shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Signal Badge */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs ${
                    isUp
                      ? "bg-emerald-950/70 border-emerald-500/70 text-emerald-300"
                      : isDown
                      ? "bg-rose-950/70 border-rose-500/70 text-rose-300"
                      : "bg-[#080e0a] border-[#14221a] text-slate-400"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isUp ? "bg-emerald-400 animate-pulse" : isDown ? "bg-rose-400 animate-pulse" : "bg-slate-400"}`} />
                  <span className="font-extrabold">{isUp ? "BUY [LONG]" : isDown ? "SELL [SHORT]" : "NEUTRAL"}</span>
                  <span className="font-mono text-white text-xs font-black">{technicals.confidence}%</span>
                </div>

                {/* Candle Timer */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#080e0a] border border-[#14221a] font-mono text-xs">
                  <Clock size={12} className="text-emerald-400" />
                  <span className="text-slate-400">{chartInterval.toUpperCase()}:</span>
                  <span className="font-bold text-white tabular-nums">{technicals.formattedRemainingTime || `${remainingSec}s`}</span>
                </div>
              </div>

              {/* Right Zone: Key Price Levels & Single-Instance Tools */}
              <div className="flex items-center gap-2">
                {/* Levels Quick Bar */}
                <div className="hidden lg:flex items-center gap-2 font-mono text-xs bg-[#080e0a] px-2.5 py-1 rounded-lg border border-[#14221a]">
                  <span className="text-slate-400">Entry: <strong className="text-white tabular-nums">${formatUSD(technicals.tatsPro.entryPrice || currentPrice, decimals)}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span className="text-rose-400">SL: <strong className="tabular-nums">${formatUSD(technicals.stopLoss, decimals)}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400">TP1: <strong className="tabular-nums">${formatUSD(technicals.tpTargets[0] || technicals.targetPrice, decimals)}</strong></span>
                </div>

                {/* Signal Markers Toggle */}
                <button
                  onClick={() => setShowSignals(!showSignals)}
                  className={`px-2.5 py-1 rounded-lg border font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    showSignals
                      ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
                      : "bg-[#080e0a] border-[#14221a] text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Chart Signal Markers"
                >
                  <Sparkles size={12} className="text-emerald-400" />
                  <span className="hidden sm:inline">Markers:</span>
                  <span>{showSignals ? "ON" : "OFF"}</span>
                </button>

                {/* Dashboard Modal Button (Only Once) */}
                <button
                  onClick={() => setIsTatsDashboardOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080e0a] hover:bg-[#111c15] border border-[#14221a] text-emerald-400 font-bold text-xs transition-colors cursor-pointer"
                  title="TATS Multi-Timeframe Dashboard"
                >
                  <Layers size={13} />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>

                {/* Price Alerts Modal Button (Only Once) */}
                <button
                  onClick={() => setIsAlertModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080e0a] hover:bg-[#111c15] border border-[#14221a] font-bold text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
                  title="Price Alerts"
                >
                  <Bell size={13} className={activeAlerts.length > 0 ? "text-amber-400" : "text-slate-400"} />
                  {activeAlerts.length > 0 && (
                    <span className="bg-amber-500 text-black text-[10px] font-mono font-black px-1.5 rounded-full">
                      {activeAlerts.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 3. MAIN CONTENT: CANDLESTICK CHART + BACKEND DEMO TRADING */}
            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden relative">
              <main className="flex-1 relative overflow-hidden bg-[#040706] min-w-0">
                <CandleChart
                  klines={klines}
                  currentPrice={currentPrice}
                  symbol={symbol}
                  decimals={decimals}
                  interval={chartInterval}
                  signalMarkers={technicals.signalsHistory}
                  showSignals={showSignals}
                  tatsData={technicals.tatsPro}
                  alerts={alerts}
                  isLoading={isLoadingKlines}
                  onToggleSignals={() => setShowSignals(!showSignals)}
                />
              </main>
              <aside className="xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-[#122018] bg-[#040706] p-3 overflow-y-auto">
                <DemoTradingPanel
                  symbol={symbol}
                  currentPrice={currentPrice}
                  decimals={decimals}
                  onNotify={notify}
                  onRequireAuth={() => {
                    setAuthModalMode("LOGIN");
                    setIsAuthModalOpen(true);
                  }}
                />
                <div className="mt-2 text-[11px] text-slate-500 leading-relaxed px-1">
                  Demo trading is isolated from any real-money balance. Live deposits,
                  withdrawals, and live trading remain disabled in this build.
                </div>
                <ReferralPanel onNotify={notify} />
              </aside>
            </div>
          </>
        )}
      </div>


      {/* Floating Profit Secured & Credited Alert Notification */}
      {profitNotification && (
        <div className="fixed top-16 right-5 z-50 bg-[#061009] border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-2xl shadow-emerald-950/80 max-w-sm w-full backdrop-blur-xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 animate-pulse">
              <TrendingUp size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                  Profit Secured & Credited!
                </span>
                <button
                  onClick={() => setProfitNotification(null)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-1">
                <div className="text-xl font-mono font-black text-emerald-400">
                  +${profitNotification.pnlUsdt.toFixed(2)} USDT
                  <span className="text-xs font-bold text-emerald-300 ml-1.5">
                    (+{profitNotification.pnlPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  <span className="font-bold text-white">{profitNotification.symbol}</span>{" "}
                  <span className="text-slate-400">({profitNotification.side}) via</span>{" "}
                  <span className="text-emerald-300 font-semibold">{profitNotification.botName}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                  {profitNotification.exitReason}
                </div>
                <div className="mt-2 py-1 px-2.5 rounded-lg bg-[#0c1a11] border border-emerald-800/50 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 text-[11px] font-sans">New Balance:</span>
                  <span className="font-black text-emerald-300">
                    ${profitNotification.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setActivePage("HISTORY");
                    setProfitNotification(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  View Ledger
                </button>
                <button
                  onClick={() => setProfitNotification(null)}
                  className="px-3 py-1.5 bg-[#0e1c12] hover:bg-[#152a1c] text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Price Target Alert Notification */}
      {triggeredNotification && (
        <div className="fixed top-16 right-5 z-50 bg-[#070d0a] border-2 border-amber-500 text-white p-4 rounded-2xl shadow-2xl max-w-sm w-full backdrop-blur-xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 animate-bounce">
              <BellRing size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Target Price Hit!
                </span>
                <button
                  onClick={() => setTriggeredNotification(null)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-sm font-black text-white mt-1">
                {triggeredNotification.alert.symbol} reached target of ${triggeredNotification.alert.targetPrice.toLocaleString()} USDT
              </div>

              <div className="text-xs font-mono text-slate-300 mt-0.5">
                Current Price: <span className="text-emerald-400 font-bold">${triggeredNotification.price.toLocaleString()} USDT</span>
                {triggeredNotification.alert.note && (
                  <div className="text-xs text-amber-200/90 mt-1 italic font-sans bg-black/40 px-2 py-0.5 rounded">
                    &ldquo;{triggeredNotification.alert.note}&rdquo;
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSymbol(triggeredNotification.alert.symbol);
                    setActivePage("TERMINAL");
                    setTriggeredNotification(null);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  View Chart
                </button>
                <button
                  onClick={() => setTriggeredNotification(null)}
                  className="px-3 py-1.5 bg-[#121c16] hover:bg-[#192b1f] text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal (records only — real-money flows disabled) */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        mode={walletModalMode}
        wallet={wallet}
        onUpdateWallet={(updated) => {
          setWallet(updated);
          saveStoredWallet(updated);
        }}
        onNotify={notify}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onNotify={notify}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        currentSymbol={symbol}
        currentPrice={currentPrice}
        decimals={decimals}
        availableSymbols={availableSymbols}
        alerts={alerts}
        onAddAlert={handleAddAlert}
        onDeleteAlert={handleDeleteAlert}
        onToggleAlert={handleToggleAlert}
        onClearHistory={handleClearHistory}
        onTestChime={playAlertChime}
      />

      {/* TATS PRO v1.0 MTF Dashboard Modal */}
      <TatsDashboardModal
        isOpen={isTatsDashboardOpen}
        onClose={() => setIsTatsDashboardOpen(false)}
        symbol={symbol}
        timeframe={chartInterval}
        currentPrice={currentPrice}
        decimals={decimals}
        tatsData={technicals.tatsPro}
        onNotify={notify}
      />
    </div>
  );
}
