import React, { useState } from "react";
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Zap,
} from "lucide-react";
import { WalletState, DEPOSIT_NETWORKS, DepositNetwork } from "./walletState.ts";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "CONNECT" | "DEPOSIT" | "WITHDRAW";
  wallet: WalletState;
  onUpdateWallet: (updated: WalletState) => void;
  onNotify: (msg: string) => void;
}

// Crisp procedural SVG QR Code Matrix generator
function ProceduralQrCode({ text, size = 180 }: { text: string; size?: number }) {
  // Deterministic 21x21 pseudo QR matrix based on hash of text
  const matrixSize = 21;
  const hashVal = text.split("").reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 7);

  const cells: boolean[][] = Array.from({ length: matrixSize }, (_, r) =>
    Array.from({ length: matrixSize }, (_, c) => {
      // 3 Corner finder patterns (7x7)
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= matrixSize - 7;
      const isBottomLeft = r >= matrixSize - 7 && c < 7;

      if (isTopLeft || isTopRight || isBottomLeft) {
        const localR = isBottomLeft ? r - (matrixSize - 7) : r;
        const localC = isTopRight ? c - (matrixSize - 7) : c;
        if (localR === 0 || localR === 6 || localC === 0 || localC === 6) return true;
        if (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4) return true;
        return false;
      }

      // Timing tracks
      if (r === 6 || c === 6) return (r + c) % 2 === 0;

      // Data pseudo-random filling from text seed
      const cellIndex = r * matrixSize + c;
      const pseudoVal = (hashVal * (cellIndex + 17) + cellIndex * 37) % 100;
      return pseudoVal > 46;
    })
  );

  const cellSize = size / matrixSize;

  return (
    <div className="bg-white p-3 rounded-2xl shadow-xl border border-emerald-500/30 flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill="#ffffff" />
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#050a07"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export function WalletModal({
  isOpen,
  onClose,
  mode,
  wallet,
  onUpdateWallet,
  onNotify,
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<"CONNECT" | "DEPOSIT" | "WITHDRAW">(mode);
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetwork>(DEPOSIT_NETWORKS[0]);
  const [copied, setCopied] = useState(false);

  // Withdraw Form State
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState<number>(100);
  const [withdrawNetwork, setWithdrawNetwork] = useState("Arbitrum One");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    onNotify("Address copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = (walletName: WalletState["walletName"]) => {
    const updated: WalletState = {
      isConnected: true,
      address: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      walletName,
      network: "Arbitrum One",
      balanceUsdt: 18450.0,
    };
    onUpdateWallet(updated);
    onNotify(`Connected to ${walletName} successfully.`);
    onClose();
  };

  const handleDisconnect = () => {
    const updated: WalletState = {
      isConnected: false,
      address: null,
      walletName: null,
      network: "Arbitrum One",
      balanceUsdt: 0,
    };
    onUpdateWallet(updated);
    onNotify("Wallet disconnected.");
    onClose();
  };

  const handleConfirmWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAddress.trim()) {
      onNotify("Please enter a destination withdrawal address.");
      return;
    }
    if (withdrawAmount <= 0 || withdrawAmount > wallet.balanceUsdt) {
      onNotify("Invalid withdrawal amount or insufficient balance.");
      return;
    }

    setIsSubmittingWithdraw(true);
    setTimeout(() => {
      const newBal = Math.max(0, wallet.balanceUsdt - withdrawAmount);
      onUpdateWallet({
        ...wallet,
        balanceUsdt: newBal,
      });
      setIsSubmittingWithdraw(false);
      onNotify(`Withdrawal request of $${withdrawAmount.toLocaleString()} USDT submitted to ${withdrawNetwork}.`);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#050807] border-2 border-[#15231b] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#14221a] flex items-center justify-between bg-[#080d0a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Wallet size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">TradeNews Assets & Wallet</h2>
              <p className="text-xs text-slate-400">Institutional Web3 Gateway</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0e1612] hover:bg-[#15221b] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="flex items-center border-b border-[#14221a] bg-[#070b09] p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab("CONNECT")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "CONNECT"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#0e1713]"
            }`}
          >
            Connect Wallet
          </button>
          <button
            onClick={() => setActiveTab("DEPOSIT")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "DEPOSIT"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#0e1713]"
            }`}
          >
            Deposit & Scan
          </button>
          <button
            onClick={() => setActiveTab("WITHDRAW")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "WITHDRAW"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-white hover:bg-[#0e1713]"
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[75vh]">
          {/* TAB 1: CONNECT WALLET */}
          {activeTab === "CONNECT" && (
            <div className="space-y-4">
              {wallet.isConnected ? (
                <div className="p-4 rounded-xl bg-[#09100c] border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Connection Status</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      CONNECTED
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-2 font-mono">
                    <span className="text-slate-400 font-sans">Provider</span>
                    <span className="text-white font-bold">{wallet.walletName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-2 font-mono">
                    <span className="text-slate-400 font-sans">Address</span>
                    <span className="text-emerald-300 font-bold">{wallet.address}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-2 font-mono">
                    <span className="text-slate-400 font-sans">Available Balance</span>
                    <span className="text-base text-white font-extrabold">
                      ${wallet.balanceUsdt.toLocaleString()} USDT
                    </span>
                  </div>

                  <button
                    onClick={handleDisconnect}
                    className="w-full mt-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 mb-3">
                    Select your preferred Web3 provider to link your trading account:
                  </p>
                  {[
                    { name: "MetaMask", desc: "Browser Extension & Mobile App" },
                    { name: "WalletConnect", desc: "Scan with Rainbow, Trust, or Ledger" },
                    { name: "Phantom", desc: "Solana & Multi-Chain Wallet" },
                    { name: "Coinbase", desc: "Coinbase Self-Custody Wallet" },
                    { name: "Trust Wallet", desc: "Mobile DeFi Wallet" },
                  ].map((w) => (
                    <button
                      key={w.name}
                      onClick={() => handleConnect(w.name as any)}
                      className="w-full p-3 rounded-xl bg-[#0a110d] hover:bg-[#111d17] border border-[#16271e] hover:border-emerald-500/50 flex items-center justify-between transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#14241b] flex items-center justify-center text-emerald-400 font-bold text-xs">
                          {w.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{w.desc}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Connect
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEPOSIT & SCAN QR CODE */}
          {activeTab === "DEPOSIT" && (
            <div className="space-y-4">
              {/* Network Selection */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Select Deposit Network (USDT):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEPOSIT_NETWORKS.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-left ${
                        selectedNetwork.id === net.id
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40"
                          : "bg-[#0a110d] border-[#16271e] text-slate-300 hover:text-white"
                      }`}
                    >
                      <div>{net.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono font-normal">
                        Min: ${net.minDeposit} USDT
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code Scanner Display */}
              <div className="flex flex-col items-center justify-center p-4 bg-[#09100c] rounded-xl border border-[#16271e]">
                <ProceduralQrCode text={selectedNetwork.address} size={170} />
                <div className="text-xs text-slate-400 mt-2.5 font-medium flex items-center gap-1.5">
                  <QrCode size={13} className="text-emerald-400" />
                  <span>Scan QR code with your mobile crypto wallet</span>
                </div>
              </div>

              {/* Deposit Address Box */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  USDT Deposit Address ({selectedNetwork.name}):
                </label>
                <div className="flex items-center gap-2 bg-[#080d0a] border border-[#182a20] rounded-xl p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={selectedNetwork.address}
                    className="flex-1 bg-transparent text-xs font-mono font-bold text-emerald-300 outline-none truncate"
                  />
                  <button
                    onClick={() => handleCopy(selectedNetwork.address)}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Address"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-lg bg-[#0a120e] border border-[#182c21] text-xs text-slate-300 space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Instant Credit Protocol</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Only send USDT on <strong>{selectedNetwork.name}</strong>. Deposits are credited automatically
                  after {selectedNetwork.confirmations} block confirmation(s).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAW */}
          {activeTab === "WITHDRAW" && (
            <form onSubmit={handleConfirmWithdraw} className="space-y-4">
              {/* Available Balance Banner */}
              <div className="p-3 rounded-xl bg-[#09100c] border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Available Balance:</span>
                  <span className="text-base font-extrabold font-mono text-white">
                    ${wallet.balanceUsdt.toLocaleString()} USDT
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/60">
                  Ready to Withdraw
                </span>
              </div>

              {/* Destination Address */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Destination Wallet Address:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste destination TRC20, ERC20 or Arbitrum address..."
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="w-full bg-[#080d0a] border border-[#182a20] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Network */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Withdrawal Network:
                </label>
                <select
                  value={withdrawNetwork}
                  onChange={(e) => setWithdrawNetwork(e.target.value)}
                  className="w-full bg-[#080d0a] border border-[#182a20] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Arbitrum One">Arbitrum One (Fee: $0.80 USDT)</option>
                  <option value="Tron (TRC20)">Tron TRC20 (Fee: $1.00 USDT)</option>
                  <option value="Ethereum (ERC20)">Ethereum ERC20 (Fee: $4.50 USDT)</option>
                  <option value="Solana (SPL)">Solana SPL (Fee: $0.50 USDT)</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-300">Amount to Withdraw (USDT):</span>
                  <span className="font-mono text-slate-400">Min: $20 USDT</span>
                </div>
                <input
                  type="number"
                  min={20}
                  max={wallet.balanceUsdt}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#080d0a] border border-[#182a20] rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />

                {/* Quick percentage buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        setWithdrawAmount(Math.round(((wallet.balanceUsdt * pct) / 100) * 100) / 100)
                      }
                      className="flex-1 py-1 rounded bg-[#0b130e] hover:bg-[#15241c] border border-[#192c21] text-[11px] font-mono font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-[#080d0a] border border-[#16271e] text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Network Fee:</span>
                  <span className="text-white">$0.80 USDT</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>You will receive:</span>
                  <span className="text-emerald-400 font-bold">
                    ${Math.max(0, withdrawAmount - 0.8).toLocaleString()} USDT
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingWithdraw}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmittingWithdraw ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Broadcasting Transaction...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={15} />
                    <span>Confirm & Withdraw Funds</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
