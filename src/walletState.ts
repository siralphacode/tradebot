export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletName: "MetaMask" | "WalletConnect" | "Phantom" | "Coinbase" | "Trust Wallet" | null;
  network: "Arbitrum One" | "Ethereum" | "Solana" | "Tron";
  balanceUsdt: number;
}

export interface DepositNetwork {
  id: string;
  name: string;
  chain: string;
  address: string;
  memo?: string;
  minDeposit: number;
  confirmations: number;
  qrPattern: string; // Used to draw crisp SVG QR matrix
}

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  {
    id: "trc20",
    name: "Tron (TRC20)",
    chain: "TRX",
    address: "TYP6q5V7e8K9rL2mM3n4pB5sC6dE7fG8hJ",
    minDeposit: 10,
    confirmations: 1,
    qrPattern: "TYP6q5V7e8K9rL2mM3n4pB5sC6dE7fG8hJ",
  },
  {
    id: "erc20",
    name: "Ethereum (ERC20)",
    chain: "ETH",
    address: "0x89205A3A3b2A5532645604CF7c478a5e3A10aE2C",
    minDeposit: 50,
    confirmations: 12,
    qrPattern: "0x89205A3A3b2A5532645604CF7c478a5e3A10aE2C",
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    chain: "ARB",
    address: "0x89205A3A3b2A5532645604CF7c478a5e3A10aE2C",
    minDeposit: 10,
    confirmations: 20,
    qrPattern: "0x89205A3A3b2A5532645604CF7c478a5e3A10aE2C",
  },
  {
    id: "solana",
    name: "Solana (SPL)",
    chain: "SOL",
    address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    minDeposit: 10,
    confirmations: 32,
    qrPattern: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  },
];

const WALLET_STORAGE_KEY = "tradenews_user_wallet_v1";

export function loadStoredWallet(): WalletState {
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Never auto-fabricate a balance. Older builds seeded a fake
      // connected wallet — migrate those to a disconnected, zero-balance
      // state so the UI cannot display invented funds.
      if (parsed && typeof parsed === "object") {
        const migrated: WalletState = {
          isConnected: parsed.isConnected === true && Boolean(parsed.address),
          address: typeof parsed.address === "string" ? parsed.address : null,
          walletName: parsed.walletName ?? null,
          network: parsed.network ?? "Arbitrum One",
          balanceUsdt: 0,
        };
        if (!migrated.isConnected) {
          migrated.address = null;
          migrated.walletName = null;
        }
        return migrated;
      }
    }
  } catch {}
  // Safe default: NOT connected, zero balance (no fabricated funds).
  return {
    isConnected: false,
    address: null,
    walletName: null,
    network: "Arbitrum One",
    balanceUsdt: 0,
  };
}

export function saveStoredWallet(wallet: WalletState): void {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tradenews_wallet_updated", { detail: wallet }));
    }
  } catch {}
}

export function creditWalletBalance(amountUsdt: number): WalletState {
  const current = loadStoredWallet();
  const newBalance = Math.max(0, Math.round((current.balanceUsdt + amountUsdt) * 100) / 100);
  const updated: WalletState = {
    ...current,
    balanceUsdt: newBalance,
  };
  saveStoredWallet(updated);
  return updated;
}

export function debitWalletBalance(amountUsdt: number): { success: boolean; newWallet: WalletState } {
  const current = loadStoredWallet();
  if (current.balanceUsdt < amountUsdt) {
    return { success: false, newWallet: current };
  }
  const newBalance = Math.max(0, Math.round((current.balanceUsdt - amountUsdt) * 100) / 100);
  const updated: WalletState = {
    ...current,
    balanceUsdt: newBalance,
  };
  saveStoredWallet(updated);
  return { success: true, newWallet: updated };
}

