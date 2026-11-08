import fs from "fs";
import path from "path";

export interface User {
  id: number;
  username: string;
  wallet: string;
  balance: number;
  trade_balance: number;
  available_balance: number;
  is_admin: number;
}

export interface Trade {
  id: number;
  user_id: number;
  symbol: string;
  amount: number;
  type: "UP" | "DOWN";
  entry_price: number;
  exit_price?: number | null;
  leverage: number;
  duration_seconds?: number;
  profit_loss?: number | null;
  roi?: number | null;
  status: "OPEN" | "WON" | "LOST" | "STOPPED";
  created_at: string;
  closed_at?: string | null;
}

interface DatabaseSchema {
  users: User[];
  trades: Trade[];
  nextUserId: number;
  nextTradeId: number;
}

const DB_FILE = path.resolve(process.cwd(), "database.json");

function getDefaultData(): DatabaseSchema {
  return {
    users: [],
    trades: [],
    nextUserId: 1,
    nextTradeId: 1,
  };
}

class JsonDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          trades: Array.isArray(parsed.trades) ? parsed.trades : [],
          nextUserId: typeof parsed.nextUserId === "number" ? parsed.nextUserId : 1,
          nextTradeId: typeof parsed.nextTradeId === "number" ? parsed.nextTradeId : 1,
        };
      }
    } catch (err) {
      console.error("Error reading database.json, initializing fresh data:", err);
    }
    const defaultData = getDefaultData();
    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing to database.json:", err);
    }
  }

  private persist() {
    this.saveData(this.data);
  }

  public getUserByWallet(wallet: string): User | undefined {
    return this.data.users.find(
      (u) => u.wallet.toLowerCase() === wallet.trim().toLowerCase()
    );
  }

  public getUserById(id: number): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public createUser(wallet: string, username: string): User {
    const existing = this.getUserByWallet(wallet);
    if (existing) {
      return existing;
    }

    const newUser: User = {
      id: this.data.nextUserId++,
      username: username || `Trader_${Math.floor(1000 + Math.random() * 9000)}`,
      wallet: wallet.trim(),
      balance: 100, // Welcome demo balance $100 USD
      trade_balance: 100,
      available_balance: 100,
      is_admin: 0,
    };

    this.data.users.push(newUser);
    this.persist();
    return newUser;
  }

  public addBonus(userId: number, amount = 50): User {
    const user = this.getUserById(userId);
    if (!user) throw new Error("User not found");

    user.balance = (user.balance || 0) + amount;
    user.available_balance = (user.available_balance || 0) + amount;
    user.trade_balance = (user.trade_balance || 0) + amount;

    this.persist();
    return user;
  }

  public getTradesByUserId(userId: number): Trade[] {
    return this.data.trades
      .filter((t) => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getTradeById(tradeId: number): Trade | undefined {
    return this.data.trades.find((t) => t.id === tradeId);
  }

  public createTrade(tradeData: {
    user_id: number;
    symbol: string;
    amount: number;
    type: "UP" | "DOWN";
    entry_price: number;
    leverage?: number;
    duration_seconds?: number;
  }): Trade {
    const user = this.getUserById(tradeData.user_id);
    if (!user) throw new Error("User not found");
    if ((user.available_balance || 0) < tradeData.amount) {
      throw new Error("Insufficient USD balance");
    }

    user.available_balance = Math.max(0, (user.available_balance || 0) - tradeData.amount);

    const newTrade: Trade = {
      id: this.data.nextTradeId++,
      user_id: tradeData.user_id,
      symbol: tradeData.symbol,
      amount: tradeData.amount,
      type: tradeData.type,
      entry_price: tradeData.entry_price,
      exit_price: null,
      leverage: tradeData.leverage || 1,
      duration_seconds: tradeData.duration_seconds || 30,
      profit_loss: null,
      roi: null,
      status: "OPEN",
      created_at: new Date().toISOString(),
      closed_at: null,
    };

    this.data.trades.unshift(newTrade);
    this.persist();
    return newTrade;
  }

  public closeTrade(tradeId: number, exitPrice: number, pnl: number, roi: number, forcedStatus?: "WON" | "LOST"): Trade {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== "OPEN") {
      throw new Error("Trade already closed or not found");
    }

    const won = forcedStatus ? forcedStatus === "WON" : pnl >= 0;
    trade.status = won ? "WON" : "LOST";
    trade.exit_price = exitPrice;
    trade.profit_loss = pnl;
    trade.roi = roi;
    trade.closed_at = new Date().toISOString();

    const user = this.getUserById(trade.user_id);
    if (user) {
      // Returned capital: initial amount + pnl
      const finalReturn = Math.max(0, trade.amount + pnl);
      user.balance = Math.max(0, (user.balance || 0) + pnl);
      user.available_balance = Math.max(0, (user.available_balance || 0) + finalReturn);
      user.trade_balance = user.available_balance;
    }

    this.persist();
    return trade;
  }
}

export const db = new JsonDatabase();
