import { useCallback, useEffect, useState } from "react";
import { Layers, RefreshCw, XCircle } from "lucide-react";
import { getDemoBalance, getDemoPositions } from "./apiExtended.ts";
import { closeDemoPosition, openDemoPosition } from "./apiExtended.ts";
import type { PositionRecord } from "./apiExtended.ts";
import { useAuth } from "./AuthContext.tsx";

interface Props {
  symbol: string;
  currentPrice: number;
  decimals?: number;
  onNotify: (msg: string) => void;
  onRequireAuth: () => void;
}

export function DemoTradingPanel({ symbol, currentPrice, decimals = 2, onNotify, onRequireAuth }: Props) {
  const { token } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [size, setSize] = useState("100");
  const [leverage, setLeverage] = useState("10");
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setBalance(null);
      setPositions([]);
      setUnavailable(null);
      return;
    }
    setLoading(true);
    const [b, p] = await Promise.all([getDemoBalance(), getDemoPositions()]);
    if (b.ok) {
      const v = (b.data as any)?.balance;
      setBalance(typeof v === "number" ? v : Number(v));
      setUnavailable(null);
    } else {
      setUnavailable((b as any).message || "Demo trading unavailable.");
    }
    if (p.ok) setPositions(Array.isArray(p.data) ? (p.data as PositionRecord[]) : []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) {
    return (
      <div className="bg-[#0b1017] border border-[#1e2a3a] rounded-xl p-4 text-xs text-slate-300">
        <div className="font-extrabold text-white text-sm mb-1">Demo Trading</div>
        <p className="text-slate-400 mb-3">Sign in for backend-backed demo positions.</p>
        <button onClick={onRequireAuth} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">
          Sign In to Trade Demo
        </button>
      </div>
    );
  }
  const submit = async () => {
    const sizeUsdt = Number(size);
    const lev = Number(leverage);
    if (!sizeUsdt || sizeUsdt <= 0 || !lev || lev <= 0) {
      onNotify("Enter a valid size and leverage.");
      return;
    }
    const res = await openDemoPosition({ symbol, side, sizeUsdt, leverage: lev });
    if (res.ok) {
      onNotify(`Demo ${side} opened on ${symbol}.`);
      void load();
    } else {
      onNotify(`Demo order failed: ${(res as any).message}`);
    }
  };

  const closePos = async (id: string) => {
    setClosingId(id);
    const res = await closeDemoPosition(id);
    if (res.ok) onNotify("Demo position closed.");
    else onNotify(`Close failed: ${(res as any).message}`);
    setClosingId(null);
    void load();
  };

  return (
    <div className="bg-[#0b1017] border border-[#1e2a3a] rounded-xl p-4 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="font-extrabold text-white text-sm flex items-center gap-2">
          <Layers size={15} className="text-emerald-400" /> Demo Trading
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">ISOLATED</span>
        </div>
        <button onClick={() => void load()} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {unavailable ? (
        <div className="text-amber-200 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2">{unavailable}</div>
      ) : (
        <div>
          <div className="flex justify-between bg-[#070c12] border border-[#1a2634] rounded-lg px-3 py-2 mb-3">
            <span className="text-slate-400">Demo balance</span>
            <span className="font-mono font-black text-white">{balance == null || Number.isNaN(balance) ? "--" : `$${balance.toFixed(2)}`}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => setSide("LONG")} className={`py-2 rounded-lg font-black cursor-pointer ${side === "LONG" ? "bg-emerald-600 text-white" : "bg-[#131c28] text-slate-400"}`}>LONG</button>
            <button onClick={() => setSide("SHORT")} className={`py-2 rounded-lg font-black cursor-pointer ${side === "SHORT" ? "bg-rose-600 text-white" : "bg-[#131c28] text-slate-400"}`}>SHORT</button>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mb-2">{symbol} @ {currentPrice.toFixed(decimals)}</div>
          <button onClick={() => void submit()} className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer">
            Open Demo {side}
          </button>
          <div className="mt-3 space-y-1.5">
            {positions.length === 0 && <div className="text-slate-500">No open demo positions reported by backend.</div>}
            {positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-[#070c12] border border-[#1a2634] rounded-lg px-2.5 py-2">
                <span className="font-bold text-white">{p.symbol} {p.side}</span>
                <button onClick={() => void closePos(p.id)} disabled={closingId === p.id}
                  className="px-2 py-1 rounded bg-[#1a2330] text-slate-200 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                  <XCircle size={12} /> Close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


