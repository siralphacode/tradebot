import React, { useEffect, useRef, useState } from "react";
import { X, ShieldCheck, Loader2, UserPlus, LogIn } from "lucide-react";
import { authLogin, authRegister } from "./api.ts";
import { TURNSTILE_SITE_KEY } from "./config.ts";
import { useAuth } from "./AuthContext.tsx";

declare global {
  interface Window {
    turnstile?: any;
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "LOGIN" | "REGISTER";
  onNotify: (msg: string) => void;
}

export function AuthModal({ isOpen, onClose, initialMode = "LOGIN", onNotify }: AuthModalProps) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<any>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || !TURNSTILE_SITE_KEY) return;
    const renderWidget = () => {
      if (!turnstileRef.current || !window.turnstile || widgetId.current) return;
      try {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          theme: "dark",
        });
      } catch {}
    };
    if (window.turnstile) {
      renderWidget();
      return;
    }
    let script = document.querySelector("script[data-turnstile]") as HTMLScriptElement | null;
    if (!script) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "1";
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      script.addEventListener("load", renderWidget);
    }
    return () => {
      try {
        if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current);
      } catch {}
      widgetId.current = null;
      setTurnstileToken("");
    };
  }, [isOpen]);
  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const payload: any = { email: email.trim(), password };
      if (turnstileToken) payload.turnstileToken = turnstileToken;
      if (mode === "REGISTER" && referralCode.trim()) payload.referralCode = referralCode.trim();
      const res = mode === "LOGIN" ? await authLogin(payload) : await authRegister(payload);
      if (res.ok) {
        signIn(res.data.token, res.data.user, remember);
        onNotify(mode === "LOGIN" ? "Signed in to TradeNews." : "TradeNews account created.");
        onClose();
      } else if ((res as any).endpointDisabled || (res as any).status === 0) {
        setError("Auth service unavailable: backend endpoint disabled or unreachable.");
      } else {
        setError((res as any).message || "Authentication failed.");
      }
    } finally {
      setBusy(false);
      setTurnstileToken("");
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0f0c] border border-[#1c2b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#16241b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-black font-black text-xs">TN</div>
            <div>
              <div className="text-sm font-extrabold text-white">{mode === "LOGIN" ? "Sign in" : "Create account"}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-400" />
                <span>Protected by Cloudflare Turnstile</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070c09] border border-[#16241b]">
            <button type="button" onClick={() => setMode("LOGIN")}
              className={`py-2 rounded-lg text-xs font-extrabold cursor-pointer ${mode === "LOGIN" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => setMode("REGISTER")}
              className={`py-2 rounded-lg text-xs font-extrabold cursor-pointer ${mode === "REGISTER" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}>
              Register
            </button>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="w-full bg-[#070c09] border border-[#1a2b20] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters"
            className="w-full bg-[#070c09] border border-[#1a2b20] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
          {mode === "REGISTER" && (
            <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Referral code (optional)"
              className="w-full bg-[#070c09] border border-[#1a2b20] rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500" />
          )}
          {TURNSTILE_SITE_KEY ? (
            <div ref={turnstileRef} className="flex justify-center min-h-[65px]" />
          ) : (
            <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-2">
              Turnstile site key is not configured in this build. Verified server-side only.
            </div>
          )}
          {error && <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-700/50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-extrabold text-sm cursor-pointer flex items-center justify-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Please wait..." : mode === "LOGIN" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
