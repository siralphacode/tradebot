import React, { useState } from "react";
import {
  Bell,
  BellRing,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Volume2,
  Clock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { PriceAlert, playAlertChime } from "./priceAlerts.ts";
import { CryptoLogo } from "./cryptoLogos.tsx";

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol: string;
  currentPrice: number;
  decimals?: number;
  availableSymbols: { symbol: string; name: string; price: number; decimals: number }[];
  alerts: PriceAlert[];
  onAddAlert: (newAlert: Omit<PriceAlert, "id" | "createdAt" | "triggered">) => void;
  onDeleteAlert: (alertId: string) => void;
  onToggleAlert: (alertId: string) => void;
  onClearHistory: () => void;
  onTestChime: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  currentPrice,
  decimals = 2,
  availableSymbols,
  alerts,
  onAddAlert,
  onDeleteAlert,
  onToggleAlert,
  onClearHistory,
  onTestChime,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(currentSymbol);
  const [targetPriceInput, setTargetPriceInput] = useState<string>(
    (currentPrice * 1.02).toFixed(decimals)
  );
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  if (!isOpen) return null;

  const currentCoin = availableSymbols.find((s) => s.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    name: selectedSymbol.split("/")[0],
    price: currentPrice,
    decimals,
  };

  const currentSelectedPrice = currentCoin.price;

  // Handle requesting browser notification permissions
  const handleRequestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const result = await Notification.requestPermission();
        setPermissionState(result);
        if (result === "granted") {
          playAlertChime();
          new Notification("Price Alerts Enabled", {
            body: "You will now receive desktop notifications when target prices are reached.",
            icon: "/favicon.ico",
          });
        }
      } catch (err) {
        console.error("Failed to request permission:", err);
      }
    }
  };

  // Adjust target price with percentage presets
  const handleApplyPreset = (percent: number) => {
    const newPrice = currentSelectedPrice * (1 + percent / 100);
    setTargetPriceInput(newPrice.toFixed(currentCoin.decimals || decimals));
    if (percent > 0) {
      setCondition("ABOVE");
    } else {
      setCondition("BELOW");
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetPriceInput);
    if (!target || target <= 0) return;

    // Auto deduce condition if target price differs from current price
    const finalCondition = condition || (target >= currentSelectedPrice ? "ABOVE" : "BELOW");

    onAddAlert({
      symbol: selectedSymbol,
      targetPrice: target,
      initialPrice: currentSelectedPrice,
      condition: finalCondition,
      note: note.trim() || undefined,
      active: true,
    });

    // Reset inputs
    setNote("");
    setTargetPriceInput((currentSelectedPrice * 1.02).toFixed(currentCoin.decimals || decimals));
  };

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#10141d] border border-[#222a3a] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="h-14 px-5 border-b border-[#1c2433] bg-[#0c0f16] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BellRing size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Price Alerts & Notifications</span>
                <span className="text-[10px] font-mono bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800/40">
                  {activeAlerts.length} Active
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Real-time target trigger with desktop sound & visuals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTestChime}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              title="Test Sound Chime"
            >
              <Volume2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Browser Permission Banner */}
        {permissionState !== "granted" ? (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-5 py-2.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span>Enable native browser notifications to receive alerts while in other tabs.</span>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-md text-[11px] cursor-pointer shadow-md transition-colors shrink-0"
            >
              Enable Notifications
            </button>
          </div>
        ) : (
          <div className="bg-emerald-950/30 border-b border-emerald-800/30 px-5 py-1.5 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>Browser Desktop Notifications: Granted & Active</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Create Alert Form Card */}
          <form
            onSubmit={handleSubmit}
            className="bg-[#141924] border border-[#212a3b] rounded-xl p-4 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Plus size={14} className="text-amber-400" />
                <span>Create New Price Alert</span>
              </span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">Current Price:</span>
                <span className="text-emerald-400 font-bold">
                  ${currentSelectedPrice.toLocaleString(undefined, {
                    minimumFractionDigits: currentCoin.decimals || 2,
                    maximumFractionDigits: currentCoin.decimals || 2,
                  })}
                </span>
              </div>
            </div>

            {/* Symbol & Condition Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Symbol selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Crypto Symbol
                </label>
                <div className="relative">
                  <select
                    value={selectedSymbol}
                    onChange={(e) => {
                      setSelectedSymbol(e.target.value);
                      const coin = availableSymbols.find((s) => s.symbol === e.target.value);
                      if (coin) {
                        setTargetPriceInput((coin.price * 1.02).toFixed(coin.decimals || 2));
                      }
                    }}
                    className="w-full bg-[#1b2230] border border-[#2a364a] rounded-lg px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {availableSymbols.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} - {s.name} (${s.price.toFixed(s.decimals)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Trigger Condition
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCondition("ABOVE")}
                    className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      condition === "ABOVE"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-sm"
                        : "bg-[#1b2230] border-[#2a364a] text-slate-400 hover:text-white"
                    }`}
                  >
                    <ArrowUp size={13} />
                    <span>Crosses Above</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCondition("BELOW")}
                    className={`py-2 px-2.5 rounded-lg border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      condition === "BELOW"
                        ? "bg-rose-950/60 border-rose-500 text-rose-400 shadow-sm"
                        : "bg-[#1b2230] border-[#2a364a] text-slate-400 hover:text-white"
                    }`}
                  >
                    <ArrowDown size={13} />
                    <span>Crosses Below</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Price Input with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Target Price (USD)
                </label>
                <div className="flex items-center gap-1">
                  {[-5, -2, -1, 1, 2, 5].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        p > 0
                          ? "bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/40"
                          : "bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/40"
                      }`}
                    >
                      {p > 0 ? `+${p}%` : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="any"
                  value={targetPriceInput}
                  onChange={(e) => setTargetPriceInput(e.target.value)}
                  className="w-full bg-[#1b2230] border border-[#2a364a] focus:border-amber-400 rounded-lg pl-7 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Custom Note input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Alert Note / Tag (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Take Profit target, Major support bounce, Breakout..."
                className="w-full bg-[#1b2230] border border-[#2a364a] focus:border-amber-400 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                maxLength={60}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs py-2.5 rounded-lg shadow-lg cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Bell size={15} />
              <span>Set Price Alert for {selectedSymbol}</span>
            </button>
          </form>

          {/* Alerts List Tabs */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("active")}
                  className={`pb-1 cursor-pointer transition-colors ${
                    activeTab === "active"
                      ? "text-amber-400 border-b-2 border-amber-400 font-extrabold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Active Alerts ({activeAlerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`pb-1 cursor-pointer transition-colors ${
                    activeTab === "history"
                      ? "text-amber-400 border-b-2 border-amber-400 font-extrabold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Triggered History ({triggeredAlerts.length})
                </button>
              </div>

              {activeTab === "history" && triggeredAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {/* Active Alerts List */}
            {activeTab === "active" ? (
              activeAlerts.length === 0 ? (
                <div className="p-8 text-center bg-[#141924]/60 border border-dashed border-[#222a3a] rounded-xl text-slate-500 text-xs">
                  <Bell size={24} className="mx-auto mb-2 text-slate-600 opacity-60" />
                  <p>No active price alerts set.</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Use the form above to add an alert for any of the top 8 cryptocurrencies.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.map((alert) => {
                    const coin = availableSymbols.find((s) => s.symbol === alert.symbol);
                    const curPrice = coin?.price || alert.initialPrice;
                    const diffPercent = ((alert.targetPrice - curPrice) / curPrice) * 100;
                    const isAbove = alert.condition === "ABOVE";

                    return (
                      <div
                        key={alert.id}
                        className="bg-[#141924] border border-[#212a3b] hover:border-slate-700 p-3 rounded-xl flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CryptoLogo symbol={alert.symbol} size={24} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{alert.symbol}</span>
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                  isAbove
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                    : "bg-rose-950 text-rose-400 border border-rose-800/40"
                                }`}
                              >
                                {isAbove ? "≥ ABOVE" : "≤ BELOW"}
                              </span>
                              {alert.note && (
                                <span className="text-[10px] text-slate-400 font-sans italic bg-black/30 px-1.5 py-0.2 rounded">
                                  {alert.note}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              Target:{" "}
                              <span className="text-amber-400 font-bold">
                                ${alert.targetPrice.toLocaleString()}
                              </span>{" "}
                              <span className="text-slate-600">|</span> Current: $
                              {curPrice.toLocaleString()} (
                              <span
                                className={
                                  diffPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                }
                              >
                                {diffPercent >= 0 ? "+" : ""}
                                {diffPercent.toFixed(2)}%
                              </span>
                              )
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleAlert(alert.id)}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors border ${
                              alert.active
                                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-400"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                            }`}
                          >
                            {alert.active ? "ACTIVE" : "PAUSED"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAlert(alert.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Delete Alert"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Triggered Alerts History */
              triggeredAlerts.length === 0 ? (
                <div className="p-8 text-center bg-[#141924]/60 border border-dashed border-[#222a3a] rounded-xl text-slate-500 text-xs">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-slate-600 opacity-60" />
                  <p>No triggered alerts yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {triggeredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-[#141924]/60 border border-[#212a3b] p-3 rounded-xl flex items-center justify-between opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <CryptoLogo symbol={alert.symbol} size={22} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{alert.symbol}</span>
                            <span className="text-[10px] font-bold bg-amber-950 text-amber-400 px-1.5 py-0.2 rounded border border-amber-800/40">
                              TRIGGERED
                            </span>
                            {alert.note && (
                              <span className="text-[10px] text-slate-400 italic">
                                {alert.note}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Target Hit:{" "}
                            <span className="text-white font-bold">
                              ${alert.targetPrice.toLocaleString()}
                            </span>{" "}
                            {alert.triggeredAt && (
                              <span className="text-slate-500">
                                • {new Date(alert.triggeredAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteAlert(alert.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
