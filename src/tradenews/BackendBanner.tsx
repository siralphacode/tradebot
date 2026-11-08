import { useEffect, useState } from "react";

import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { TRADENEWS_API_BASE } from "./config.ts";
import { getTickers } from "./api.ts";

export type BackendStatus = "checking" | "online" | "offline";

export function useBackendStatus(pollMs = 30000) {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [detail, setDetail] = useState<string>("");
  const check = async () => {
    const res = await getTickers();
    if (res.ok) {
      setStatus("online");
      setDetail("");
    } else {
      setStatus("offline");
      setDetail((res as any).message || "Backend unreachable.");
    }
  };
  useEffect(() => {
    void check();
    const t = window.setInterval(check, pollMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { status, detail, recheck: check };
}

export function BackendBanner({ onNotify }: { onNotify: (m: string) => void }) {
  const { status, detail, recheck } = useBackendStatus();
  if (status === "online") return null;
  return (
    <div className={`px-3 py-2 flex items-center gap-2 text-xs font-semibold border-b ${
      status === "checking"
        ? "bg-[#0a0f14] border-[#1a2632] text-slate-300"
        : "bg-amber-950/50 border-amber-700/50 text-amber-200"
    }`}>
      {status === "checking" ? <RefreshCw size={13} className="animate-spin" /> : <WifiOff size={13} />}
      <span>
        {status === "checking"
          ? `Connecting to TradeNews backend (${TRADENEWS_API_BASE})...`
          : `TradeNews backend unavailable (${TRADENEWS_API_BASE}). ${detail} Showing local chart analysis only — no backend data is fabricated.`}
      </span>
      {status === "offline" && (
        <button onClick={() => { void recheck(); onNotify("Retrying backend connection..."); }}
          className="ml-auto px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold cursor-pointer flex items-center gap-1">
          <Wifi size={12} /> Retry
        </button>
      )}
    </div>
  );
}
