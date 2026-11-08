import { useCallback, useEffect, useState } from "react";
import { Copy, Gift, RefreshCw } from "lucide-react";
import { applyReferralCode, getReferralInfo } from "./apiExtended.ts";
import { useAuth } from "./AuthContext.tsx";
import type { ReferralInfo } from "./api.ts";

export function ReferralPanel({ onNotify }: { onNotify: (m: string) => void }) {
  const { token } = useAuth();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setInfo(null);
      setError(null);
      return;
    }
    const res = await getReferralInfo();
    if (res.ok) {
      setInfo(res.data as ReferralInfo);
      setError(null);
    } else {
      setInfo(null);
      setError((res as any).message || "Referral service unavailable.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  const apply = async () => {
    if (!code.trim()) {
      onNotify("Enter a referral code first.");
      return;
    }
    setBusy(true);
    const res = await applyReferralCode(code.trim());
    setBusy(false);
    if (res.ok) {
      setInfo(res.data as ReferralInfo);
      onNotify("Referral code applied.");
    } else {
      onNotify(`Referral apply failed: ${(res as any).message}`);
    }
  };

  return (
    <div className="bg-[#0b1017] border border-[#1e2a3a] rounded-xl p-4 text-xs mt-3">
      <div className="font-extrabold text-white text-sm flex items-center gap-2 mb-2">
        <Gift size={15} className="text-emerald-400" /> Referrals
        <button onClick={() => void load()} className="ml-auto p-1.5 text-slate-400 hover:text-white cursor-pointer">
          <RefreshCw size={14} />
        </button>
      </div>
      {error ? (
        <div className="text-amber-200 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2">
          Referrals unavailable: {error} No codes are simulated.
        </div>
      ) : info ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-[#070c12] border border-[#1a2634] rounded-lg px-3 py-2">
            <span className="font-mono font-bold text-white">{info.code}</span>
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(info.code);
                  onNotify("Referral code copied.");
                } catch {}
              }}
              className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="text-slate-400 font-mono">
            Referred: {info.referralCount ?? 0} · Rewards: ${(info.rewardsUsdt ?? 0).toFixed(2)}
          </div>
        </div>
      ) : (
        <div className="text-slate-500">Loading referral info…</div>
      )}
      <div className="flex gap-2 mt-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Apply referral code"
          className="flex-1 bg-[#070c12] border border-[#1a2634] rounded-lg px-2.5 py-2 font-mono text-white focus:outline-none focus:border-emerald-500"
        />
        <button onClick={() => void apply()} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:bg-slate-800">
          Apply
        </button>
      </div>
    </div>
  );
}

