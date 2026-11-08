import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import { EventEmitter } from "events";
import axios from "axios";
import cors from "cors";
import crypto from "crypto";
import { db } from "./db.ts";
import { hyperliquidService } from "./hyperliquidService.ts";

// NOTE: server.ts is a LEGACY local dev simulator only. It is NOT part of the
// Cloudflare production path (static dist/ + api.tradenews.live Worker + D1).
// Google Gemini / GenAI has been removed from this project. The /api/ai/*
// route below now returns the deterministic local-technical fallback only.
const ai: null = null;
void ai;

// Prevent MaxListenersExceededWarning when making concurrent or frequent HTTPS calls
EventEmitter.defaultMaxListeners = 50;

// Reusable HTTP and HTTPS agents with proper connection pooling & cleanup
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 10000,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 10000,
});

const httpClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 5000,
});

export interface CryptoMeta {
  symbol: string;         // e.g. "SOL/USDT"
  binanceSymbol: string;  // e.g. "SOLUSDT"
  base: string;           // e.g. "SOL"
  name: string;           // e.g. "Solana"
  decimals: number;
  fallbackPrice: number;
}

export const TOP_8_CRYPTOS: CryptoMeta[] = [
  { symbol: "BTC/USDT", binanceSymbol: "BTCUSDT", base: "BTC", name: "Bitcoin", decimals: 2, fallbackPrice: 83450.00 },
  { symbol: "ETH/USDT", binanceSymbol: "ETHUSDT", base: "ETH", name: "Ethereum", decimals: 2, fallbackPrice: 3420.00 },
  { symbol: "SOL/USDT", binanceSymbol: "SOLUSDT", base: "SOL", name: "Solana", decimals: 2, fallbackPrice: 118.50 },
  { symbol: "BNB/USDT", binanceSymbol: "BNBUSDT", base: "BNB", name: "BNB", decimals: 2, fallbackPrice: 598.40 },
  { symbol: "XRP/USDT", binanceSymbol: "XRPUSDT", base: "XRP", name: "Ripple", decimals: 4, fallbackPrice: 0.5824 },
  { symbol: "DOGE/USDT", binanceSymbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin", decimals: 4, fallbackPrice: 0.1645 },
  { symbol: "ADA/USDT", binanceSymbol: "ADAUSDT", base: "ADA", name: "Cardano", decimals: 4, fallbackPrice: 0.4920 },
  { symbol: "AVAX/USDT", binanceSymbol: "AVAXUSDT", base: "AVAX", name: "Avalanche", decimals: 2, fallbackPrice: 34.60 },
  { symbol: "SUI/USDT", binanceSymbol: "SUIUSDT", base: "SUI", name: "Sui", decimals: 4, fallbackPrice: 2.15 },
  { symbol: "NEAR/USDT", binanceSymbol: "NEARUSDT", base: "NEAR", name: "Near", decimals: 4, fallbackPrice: 5.42 },
  { symbol: "LINK/USDT", binanceSymbol: "LINKUSDT", base: "LINK", name: "Chainlink", decimals: 2, fallbackPrice: 12.85 },
  { symbol: "PEPE/USDT", binanceSymbol: "PEPEUSDT", base: "PEPE", name: "Pepe", decimals: 6, fallbackPrice: 0.0000095 },
  { symbol: "SHIB/USDT", binanceSymbol: "SHIBUSDT", base: "SHIB", name: "Shiba Inu", decimals: 6, fallbackPrice: 0.0000185 },
  { symbol: "LTC/USDT", binanceSymbol: "LTCUSDT", base: "LTC", name: "Litecoin", decimals: 2, fallbackPrice: 72.40 },
  { symbol: "DOT/USDT", binanceSymbol: "DOTUSDT", base: "DOT", name: "Polkadot", decimals: 4, fallbackPrice: 4.80 },
  { symbol: "TRX/USDT", binanceSymbol: "TRXUSDT", base: "TRX", name: "Tron", decimals: 4, fallbackPrice: 0.162 },
];

const BINANCE_SYMBOLS = TOP_8_CRYPTOS.map((c) => c.binanceSymbol);

// Cache for live tickers
let cachedTickers: any[] = [];
let lastTickerFetch = 0;

// Short-term cache for klines to prevent socket churn
const klineCache: Record<string, { data: any[]; timestamp: number }> = {};

function toMexcContractSymbol(symbolInput: string): string {
  const clean = (symbolInput || "").replace("/", "_").toUpperCase();
  if (clean.endsWith("_USDT")) return clean;
  return `${clean}_USDT`;
}

async function fetchLiveTickers(): Promise<any[]> {
  const now = Date.now();
  if (cachedTickers.length > 0 && now - lastTickerFetch < 1200) {
    return cachedTickers;
  }

  // 1. Try MEXC Contract Perpetual Futures Tickers directly
  try {
    const res = await httpClient.get("https://contract.mexc.com/api/v1/contract/ticker", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 3500,
    });
    const mexcList = Array.isArray(res.data?.data) ? res.data.data : [];

    if (mexcList.length > 0) {
      const mapped = TOP_8_CRYPTOS.map((meta) => {
        const mexcSymbol = `${meta.base}_USDT`;
        const found = mexcList.find((r: any) => r.symbol === mexcSymbol);
        if (found) {
          const price = parseFloat(found.lastPrice);
          const riseFallRate = parseFloat(found.riseFallRate || 0);
          return {
            symbol: meta.symbol,
            base: meta.base,
            name: meta.name,
            decimals: meta.decimals,
            price: isNaN(price) ? meta.fallbackPrice : price,
            fairPrice: parseFloat(found.fairPrice || found.lastPrice) || price,
            indexPrice: parseFloat(found.indexPrice || found.lastPrice) || price,
            priceChangePercent: parseFloat((riseFallRate * 100).toFixed(2)),
            high24h: parseFloat(found.high24Price) || price * 1.025,
            low24h: parseFloat(found.lower24Price) || price * 0.975,
            volume24h: parseFloat(found.volume24) || 1250000,
            amount24h: parseFloat(found.amount24) || 50000000,
            source: "MEXC_CONTRACT_PERPETUAL",
          };
        }
        return {
          symbol: meta.symbol,
          base: meta.base,
          name: meta.name,
          decimals: meta.decimals,
          price: meta.fallbackPrice,
          fairPrice: meta.fallbackPrice,
          indexPrice: meta.fallbackPrice,
          priceChangePercent: 1.25,
          high24h: meta.fallbackPrice * 1.03,
          low24h: meta.fallbackPrice * 0.97,
          volume24h: 1250000,
          amount24h: 50000000,
          source: "FALLBACK",
        };
      });

      cachedTickers = mapped;
      lastTickerFetch = now;
      return mapped;
    }
  } catch (mexcErr) {
    // Fallback to Binance if MEXC network blips
  }

  // 2. Fallback to Binance
  try {
    const symbolsParam = JSON.stringify(BINANCE_SYMBOLS);
    const res = await httpClient.get(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`,
      { timeout: 3500 }
    );
    const rawList = Array.isArray(res.data) ? res.data : [];

    const mapped = TOP_8_CRYPTOS.map((meta) => {
      const found = rawList.find((r: any) => r.symbol === meta.binanceSymbol);
      if (found) {
        return {
          symbol: meta.symbol,
          base: meta.base,
          name: meta.name,
          decimals: meta.decimals,
          price: parseFloat(found.lastPrice),
          fairPrice: parseFloat(found.lastPrice),
          indexPrice: parseFloat(found.lastPrice),
          priceChangePercent: parseFloat(found.priceChangePercent),
          high24h: parseFloat(found.highPrice),
          low24h: parseFloat(found.lowPrice),
          volume24h: parseFloat(found.volume),
          amount24h: parseFloat(found.quoteVolume),
          source: "BINANCE_BACKUP",
        };
      }
      return {
        symbol: meta.symbol,
        base: meta.base,
        name: meta.name,
        decimals: meta.decimals,
        price: meta.fallbackPrice,
        fairPrice: meta.fallbackPrice,
        indexPrice: meta.fallbackPrice,
        priceChangePercent: 1.25,
        high24h: meta.fallbackPrice * 1.03,
        low24h: meta.fallbackPrice * 0.97,
        volume24h: 1250000,
        amount24h: 50000000,
        source: "FALLBACK",
      };
    });

    cachedTickers = mapped;
    lastTickerFetch = now;
    return mapped;
  } catch {
    if (cachedTickers.length > 0) return cachedTickers;
    return TOP_8_CRYPTOS.map((meta) => ({
      symbol: meta.symbol,
      base: meta.base,
      name: meta.name,
      decimals: meta.decimals,
      price: meta.fallbackPrice,
      fairPrice: meta.fallbackPrice,
      indexPrice: meta.fallbackPrice,
      priceChangePercent: 0.85,
      high24h: meta.fallbackPrice * 1.025,
      low24h: meta.fallbackPrice * 0.975,
      volume24h: 1000000,
      amount24h: 30000000,
      source: "FALLBACK",
    }));
  }
}

function resolveBinanceSymbol(symbolInput: string): string {
  const clean = (symbolInput || "").replace("/", "").toUpperCase();
  const matched = TOP_8_CRYPTOS.find(
    (c) => c.symbol === symbolInput || c.binanceSymbol === clean || c.base === clean
  );
  return matched ? matched.binanceSymbol : "BTCUSDT";
}

function generateSubMinuteKlines(basePrice: number, intervalSeconds: number, limit = 80) {
  const klines = [];
  const now = Date.now();
  const stepMs = intervalSeconds * 1000;
  let price = basePrice * 0.985;

  for (let i = limit; i >= 0; i--) {
    const openTime = now - i * stepMs;
    const change = (Math.random() - 0.495) * (price * 0.0035);
    const open = price;
    price = Math.max(0.0001, price + change);
    const spread = Math.abs(change) * 1.2 + price * 0.001;
    const high = Math.max(open, price) + Math.random() * spread;
    const low = Math.min(open, price) - Math.random() * spread;
    const volume = Math.random() * 5000 + 500;

    klines.push({
      openTime,
      open,
      high,
      low,
      close: price,
      volume,
    });
  }

  // Ensure latest candle reflects exact live current price
  if (klines.length > 0) {
    const last = klines[klines.length - 1];
    last.close = basePrice;
    last.high = Math.max(last.high, basePrice, last.open);
    last.low = Math.min(last.low, basePrice, last.open);
  }

  return klines;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Top 8 Cryptos Tickers endpoint (all in USD)
  app.get("/api/crypto/tickers", async (_req, res) => {
    try {
      const tickers = await fetchLiveTickers();
      res.json({ data: tickers });
    } catch {
      res.status(500).json({ error: "Failed to load tickers" });
    }
  });

  // Single price endpoint
  app.get("/api/crypto/price", async (req, res) => {
    const symbol = (req.query.symbol as string) || "SOL/USD";
    try {
      const tickers = await fetchLiveTickers();
      const match = tickers.find((t) => t.symbol === symbol);
      if (match) {
        return res.json({ price: match.price, ticker: match });
      }
      res.json({ price: 118.50 });
    } catch {
      res.json({ price: 118.50 });
    }
  });

  // In-memory trade positions & orders store
  let activePositions: any[] = [];
  let orderHistory: any[] = [];

  // Helper: map interval to MEXC Contract interval string
  function mapToMexcInterval(interval: string): string | null {
    switch (interval) {
      case "1m": return "Min1";
      case "5m": return "Min5";
      case "15m": return "Min15";
      case "1h": return "Min60";
      case "4h": return "Hour4";
      case "1d": return "Day1";
      default: return null;
    }
  }

  // Helper: sign MEXC Contract Private API
  function signMexcContract(apiKey: string, secretKey: string, timestamp: number, bodyOrQuery: string = ""): string {
    const payload = apiKey + timestamp + bodyOrQuery;
    return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  }

  // Klines (Candlestick data - MEXC Linear Swap Perpetual)
  app.get("/api/crypto/klines", async (req, res) => {
    const symbolStr = (req.query.symbol as string) || "BTC/USDT";
    const interval = (req.query.interval as string) || "1m";
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 300);
    const mexcSymbol = toMexcContractSymbol(symbolStr);
    const binanceSymbol = resolveBinanceSymbol(symbolStr);

    const cacheKey = `${symbolStr}-${interval}-${limit}`;
    const cached = klineCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < 1200) {
      return res.json({ data: cached.data });
    }

    // If sub-minute interval (30s)
    if (interval === "5s" || interval === "15s" || interval === "30s" || interval === "Tick") {
      const sec = interval === "5s" ? 5 : interval === "15s" ? 15 : interval === "30s" ? 30 : 2;
      const tickers = await fetchLiveTickers();
      const match = tickers.find((t) => t.symbol === symbolStr || t.base === symbolStr.split("/")[0]);
      const curPrice = match ? match.price : 82450.0;
      const generated = generateSubMinuteKlines(curPrice, sec, limit);
      return res.json({ data: generated });
    }

    // 1. Try MEXC Contract Perpetual Kline API
    const mexcInterval = mapToMexcInterval(interval);
    if (mexcInterval) {
      try {
        const mexcRes = await httpClient.get(
          `https://contract.mexc.com/api/v1/contract/kline/${mexcSymbol}?interval=${mexcInterval}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 4000,
          }
        );

        const d = mexcRes.data?.data;
        if (d && Array.isArray(d.time) && d.time.length > 0) {
          const total = d.time.length;
          const startIndex = Math.max(0, total - limit);
          const klines = [];

          for (let i = startIndex; i < total; i++) {
            klines.push({
              openTime: d.time[i] * 1000,
              open: parseFloat(d.open[i]),
              high: parseFloat(d.high[i]),
              low: parseFloat(d.low[i]),
              close: parseFloat(d.close[i]),
              volume: parseFloat(d.vol[i] || 0),
            });
          }

          if (klines.length > 0) {
            klineCache[cacheKey] = { data: klines, timestamp: Date.now() };
            return res.json({ data: klines, source: "MEXC_CONTRACT_PERPETUAL" });
          }
        }
      } catch (mexcErr) {
        // Fallback to Binance
      }
    }

    // 2. Fallback to Binance
    try {
      const binanceInterval = ["1m", "5m", "15m", "1h", "4h", "1d"].includes(interval) ? interval : "1m";
      const response = await httpClient.get(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
          binanceSymbol
        )}&interval=${encodeURIComponent(binanceInterval)}&limit=${limit}`,
        { timeout: 4500 }
      );
      const rows = Array.isArray(response.data) ? response.data : [];
      const klines = rows.map((k: any) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      if (klines.length > 0) {
        klineCache[cacheKey] = { data: klines, timestamp: Date.now() };
        return res.json({ data: klines, source: "BINANCE_BACKUP" });
      }
      const generated = generateSubMinuteKlines(82450.0, 60, limit);
      klineCache[cacheKey] = { data: generated, timestamp: Date.now() };
      res.json({ data: generated });
    } catch {
      const tickers = await fetchLiveTickers();
      const match = tickers.find((t) => t.binanceSymbol === binanceSymbol || t.symbol === symbolStr);
      const curPrice = match ? match.price : 82450.0;
      const generated = generateSubMinuteKlines(curPrice, 60, limit);
      klineCache[cacheKey] = { data: generated, timestamp: Date.now() };
      res.json({ data: generated });
    }
  });

  // MEXC API: Verify Credentials & Get Account Balance
  app.post("/api/mexc/verify", async (req, res) => {
    const { apiKey, secretKey } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ success: false, error: "API Key and Secret Key are required" });
    }

    const timestamp = Date.now();
    const signature = signMexcContract(apiKey, secretKey, timestamp, "");

    try {
      const response = await httpClient.get("https://contract.mexc.com/api/v1/private/account/assets", {
        headers: {
          "ApiKey": apiKey,
          "Request-Time": timestamp.toString(),
          "Signature": signature,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 6000,
      });

      if (response.data && response.data.success) {
        const assets = response.data.data || [];
        const usdtAsset = assets.find((a: any) => a.currency === "USDT") || assets[0];
        return res.json({
          success: true,
          mode: "LIVE",
          message: "Connected to MEXC Futures API successfully",
          balance: usdtAsset ? parseFloat(usdtAsset.availableBalance || usdtAsset.cashBalance || 0) : 0,
          raw: usdtAsset,
        });
      }

      return res.json({
        success: false,
        error: response.data?.message || "MEXC verification returned unsuccessful status",
      });
    } catch (err: any) {
      const mexcMsg = err.response?.data?.message || err.response?.data?.msg || err.message;
      return res.json({
        success: false,
        error: `MEXC API Error: ${mexcMsg}`,
      });
    }
  });

  // MEXC API: Submit Futures Order
  app.post("/api/mexc/order", async (req, res) => {
    const {
      apiKey,
      secretKey,
      symbol = "BTC/USDT",
      side = 1, // 1: Open Long, 3: Open Short
      type = 5, // 1: Limit, 5: Market
      openType = 1, // 1: Isolated, 2: Cross
      leverage = 25,
      price = 82425,
      quantityUsdt = 100,
      stopLoss,
      takeProfit,
    } = req.body;

    const mexcSymbol = toMexcContractSymbol(symbol);
    const contractPrice = parseFloat(price) || 82425;
    const lev = Math.max(5, Math.min(200, parseInt(leverage, 10) || 25));
    const qtyUsdt = parseFloat(quantityUsdt) || 100;
    const margin = qtyUsdt / lev;

    // Calculate approximate contract volume (sheets)
    // BTC: 0.0001 BTC per sheet; ETH: 0.01; SOL: 0.1; Others: approx 1 sheet
    const contractMultipliers: Record<string, number> = {
      BTC_USDT: 0.0001,
      ETH_USDT: 0.01,
      SOL_USDT: 0.1,
      BNB_USDT: 0.01,
      XRP_USDT: 1,
      DOGE_USDT: 10,
    };
    const multiplier = contractMultipliers[mexcSymbol] || 0.01;
    const sheetValue = contractPrice * multiplier;
    const vol = Math.max(1, Math.round(qtyUsdt / Math.max(0.001, sheetValue)));

    const now = Date.now();

    // 1. If API Key and Secret Key are provided, submit real live order to MEXC Futures
    if (apiKey && secretKey && apiKey.trim().length > 5 && secretKey.trim().length > 5) {
      const mexcBody: any = {
        symbol: mexcSymbol,
        price: contractPrice,
        vol,
        leverage: lev,
        side, // 1: Open Long, 3: Open Short
        type, // 1: Limit, 5: Market
        openType, // 1: Isolated, 2: Cross
      };

      if (takeProfit && parseFloat(takeProfit) > 0) {
        mexcBody.takeProfitPrice = parseFloat(takeProfit);
      }
      if (stopLoss && parseFloat(stopLoss) > 0) {
        mexcBody.stopLossPrice = parseFloat(stopLoss);
      }

      const bodyStr = JSON.stringify(mexcBody);
      const signature = signMexcContract(apiKey, secretKey, now, bodyStr);

      try {
        const mexcOrderRes = await httpClient.post(
          "https://contract.mexc.com/api/v1/private/order/create",
          mexcBody,
          {
            headers: {
              "ApiKey": apiKey,
              "Request-Time": now.toString(),
              "Signature": signature,
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 7000,
          }
        );

        if (mexcOrderRes.data && mexcOrderRes.data.success) {
          const orderId = mexcOrderRes.data.data;
          const newPos = {
            id: `MEXC-${orderId || now}`,
            orderId,
            symbol,
            mexcSymbol,
            side: side === 1 ? "LONG" : "SHORT",
            openType: openType === 1 ? "Isolated" : "Cross",
            leverage: lev,
            entryPrice: contractPrice,
            markPrice: contractPrice,
            quantityUsdt: qtyUsdt,
            vol,
            margin: parseFloat(margin.toFixed(2)),
            takeProfit: takeProfit ? parseFloat(takeProfit) : null,
            stopLoss: stopLoss ? parseFloat(stopLoss) : null,
            pnl: 0,
            pnlPercent: 0,
            createdAt: now,
            mode: "LIVE",
          };
          activePositions.unshift(newPos);
          orderHistory.unshift(newPos);

          return res.json({
            success: true,
            mode: "LIVE",
            orderId,
            position: newPos,
            message: `MEXC Futures position opened successfully: ${side === 1 ? "LONG" : "SHORT"} ${symbol} (${lev}X)`,
          });
        }

        return res.json({
          success: false,
          mode: "LIVE",
          error: mexcOrderRes.data?.message || "Failed to submit order to MEXC",
        });
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.response?.data?.msg || err.message;
        return res.json({
          success: false,
          mode: "LIVE",
          error: `MEXC Futures API error: ${errMsg}`,
        });
      }
    }

    // 2. Simulated Execution (Instant fill for testing & demo)
    const simPosition = {
      id: `SIM-${now}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: `SIM-ORD-${now}`,
      symbol,
      mexcSymbol,
      side: side === 1 ? "LONG" : "SHORT",
      openType: openType === 1 ? "Isolated" : "Cross",
      leverage: lev,
      entryPrice: contractPrice,
      markPrice: contractPrice,
      quantityUsdt: qtyUsdt,
      vol,
      margin: parseFloat(margin.toFixed(2)),
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      pnl: 0,
      pnlPercent: 0,
      createdAt: now,
      mode: "SIMULATED",
    };

    activePositions.unshift(simPosition);
    orderHistory.unshift(simPosition);

    return res.json({
      success: true,
      mode: "SIMULATED",
      orderId: simPosition.orderId,
      position: simPosition,
      message: `Simulated position created: ${side === 1 ? "LONG" : "SHORT"} ${symbol} (${lev}X). Enter MEXC API keys to execute live orders on MEXC!`,
    });
  });

  // Get active positions
  app.get("/api/mexc/positions", (_req, res) => {
    res.json({
      success: true,
      positions: activePositions,
      history: orderHistory,
    });
  });

  // Close position endpoint
  app.post("/api/mexc/close-position", (req, res) => {
    const { positionId } = req.body;
    const found = activePositions.find((p) => p.id === positionId);
    if (found) {
      activePositions = activePositions.filter((p) => p.id !== positionId);
      return res.json({ success: true, message: `Position ${found.symbol} closed` });
    }
    return res.status(404).json({ success: false, error: "Position not found" });
  });

  // Compatibility routes for existing endpoints
  app.get("/api/mexc/tickers", async (_req, res) => {
    const tickers = await fetchLiveTickers();
    res.json({ data: tickers });
  });

  app.get("/api/mexc/price", async (req, res) => {
    const symbol = (req.query.symbol as string) || "SOL/USD";
    const tickers = await fetchLiveTickers();
    const match = tickers.find((t) => t.symbol === symbol);
    res.json({ price: match ? match.price : 118.50 });
  });

  app.get("/api/mexc/klines", async (req, res) => {
    const symbol = (req.query.symbol as string) || "SOL/USD";
    const interval = (req.query.interval as string) || "1m";
    const limit = parseInt((req.query.limit as string) || "100", 10);
    const binanceSymbol = resolveBinanceSymbol(symbol);

    try {
      const bInterval = ["1m", "5m", "15m", "1h", "4h", "1d"].includes(interval) ? interval : "1m";
      const response = await httpClient.get(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
          binanceSymbol
        )}&interval=${encodeURIComponent(bInterval)}&limit=${limit}`,
        { timeout: 4000 }
      );
      const rows = Array.isArray(response.data) ? response.data : [];
      const klines = rows.map((k: any) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      res.json({ data: klines });
    } catch {
      res.json({ data: generateSubMinuteKlines(118.50, 60, limit) });
    }
  });

  // AI Market Calculator & Signal Endpoint (legacy local-only fallback).
  // Gemini removed: no Google dependency. Returns deterministic
  // local-technical baseline so legacy dev UI keeps working.
  app.post("/api/ai/analyze-chart", async (req, res) => {
    const { symbol, currentPrice, interval, technicals } = req.body;
    const coinSymbol = symbol || "SOL/USD";
    const price = currentPrice || 118.5;

    // Algorithmic technical baseline
    const rsi = technicals?.rsi ?? 50;
    const trend = technicals?.trend ?? "NEUTRAL";
    const score = technicals?.score ?? 0;
    const direction = score >= 1.5 ? "UP" : score <= -1.5 ? "DOWN" : "NEUTRAL";
    const baselineConfidence = Math.min(96, Math.max(72, Math.round(75 + Math.abs(score) * 2.2)));

    // Fallback response in case Gemini API is not configured or fails
    const fallbackResponse = {
      signal: direction === "UP" ? "BUY" : direction === "DOWN" ? "SELL" : "NEUTRAL",
      direction,
      confidence: baselineConfidence,
      analysisEn:
        direction === "UP"
          ? `Technical indicators confirm bullish momentum for ${coinSymbol}. The 1-minute predictive model forecasts BUY dominance will persist over the next 60 seconds. Golden cross on moving averages supports higher continuation.`
          : direction === "DOWN"
          ? `Sustained selling pressure identified for ${coinSymbol}. The 1-minute predictive model forecasts SELL dominance will persist over the next 60 seconds with bear volume expansion.`
          : `Market is in consolidation mode. Waiting for key breakout above resistance or below support.`,
      recommendedDuration: "30s",
      supportLevel: Number((price * 0.985).toFixed(2)),
      resistanceLevel: Number((price * 1.015).toFixed(2)),
    };

    // Legacy local fallback: deterministic, no external AI call.
    void rsi;
    void trend;
    void interval;
    return res.json(fallbackResponse);
  });

  // User Accounts
  app.get("/api/users/:wallet", (req, res) => {
    try {
      const user = db.getUserByWallet(req.params.wallet);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Database error" });
    }
  });

  app.post("/api/users/register", (req, res) => {
    const { wallet, username } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    try {
      const user = db.createUser(wallet, username);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  app.post("/api/users/:userId/claim-admin-credit", (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const user = db.addBonus(userId, 50);
      res.json({ user, claimed: 50 });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to claim credit" });
    }
  });

  // Trades
  app.get("/api/trades/user/:userId", (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const trades = db.getTradesByUserId(userId);
      res.json(trades);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    const { user_id, symbol, amount, type, entry_price, leverage, duration } = req.body;
    try {
      const trade = db.createTrade({
        user_id: parseInt(user_id, 10),
        symbol: symbol || "SOL/USD",
        amount: parseFloat(amount),
        type,
        entry_price: parseFloat(entry_price),
        leverage: parseFloat(leverage || 1),
        duration_seconds: parseInt(duration || 30, 10),
      });
      res.json(trade);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to open trade" });
    }
  });

  app.get("/api/trades/:tradeId/live", async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId, 10);
      const trade = db.getTradeById(tradeId);

      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }

      if (trade.status !== "OPEN") {
        return res.json({
          trade_id: trade.id,
          current_price: trade.exit_price || trade.entry_price,
          pnl: trade.profit_loss || 0,
          roi: trade.roi || 0,
          status: trade.status,
          closed: true,
        });
      }

      // Check current price
      const tickers = await fetchLiveTickers();
      const match = tickers.find((t) => t.symbol === trade.symbol);
      const currentPrice = match ? match.price : trade.entry_price;

      // Calculate binary or spot leverage PnL
      const diff = currentPrice - trade.entry_price;
      const isUp = trade.type === "UP";
      const isWinning = isUp ? diff > 0 : diff < 0;

      // Check if time expired
      const createdTime = new Date(trade.created_at).getTime();
      const durationSec = trade.duration_seconds || 30;
      const elapsedSec = (Date.now() - createdTime) / 1000;
      const remainingSec = Math.max(0, durationSec - elapsedSec);

      let pnl = 0;
      let roi = 0;

      if (trade.leverage > 1) {
        // Leveraged spot style
        let priceChangePercent = (diff / trade.entry_price) * 100;
        if (!isUp) priceChangePercent = -priceChangePercent;
        roi = priceChangePercent * trade.leverage;
        pnl = (trade.amount * roi) / 100;
      } else {
        // Binary option style (e.g. 100% payout like screenshot)
        roi = isWinning ? 100 : -100;
        pnl = isWinning ? trade.amount : -trade.amount;
      }

      // If expired, automatically close!
      if (remainingSec <= 0) {
        const closed = db.closeTrade(
          trade.id,
          currentPrice,
          pnl,
          roi,
          isWinning ? "WON" : "LOST"
        );
        return res.json({
          trade_id: closed.id,
          current_price: currentPrice,
          pnl: closed.profit_loss,
          roi: closed.roi,
          status: closed.status,
          remaining_seconds: 0,
          closed: true,
        });
      }

      res.json({
        trade_id: trade.id,
        current_price: currentPrice,
        live_price: currentPrice,
        pnl,
        open_pnl: pnl,
        roi,
        open_roi: roi,
        remaining_seconds: Math.ceil(remainingSec),
        status: trade.status,
        closed: false,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch live data" });
    }
  });

  app.patch("/api/trades/:tradeId/close", async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId, 10);
      const trade = db.getTradeById(tradeId);

      if (!trade || trade.status !== "OPEN") {
        return res.status(400).json({ error: "Trade already closed or not found" });
      }

      const tickers = await fetchLiveTickers();
      const match = tickers.find((t) => t.symbol === trade.symbol);
      const exitPrice = match ? match.price : trade.entry_price;

      const diff = exitPrice - trade.entry_price;
      const isUp = trade.type === "UP";
      const isWinning = isUp ? diff > 0 : diff < 0;

      let pnl = 0;
      let roi = 0;

      if (trade.leverage > 1) {
        let priceChangePercent = (diff / trade.entry_price) * 100;
        if (!isUp) priceChangePercent = -priceChangePercent;
        roi = priceChangePercent * trade.leverage;
        pnl = (trade.amount * roi) / 100;
      } else {
        roi = isWinning ? 100 : -100;
        pnl = isWinning ? trade.amount : -trade.amount;
      }

      const closedTrade = db.closeTrade(tradeId, exitPrice, pnl, roi, isWinning ? "WON" : "LOST");
      res.json(closedTrade);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to close trade" });
    }
  });

  // ==========================================
  // HYPERLIQUID TRADING API ENDPOINTS
  // ==========================================

  // Get current Hyperliquid status and public config
  app.get("/api/hyperliquid/status", (req, res) => {
    try {
      const config = hyperliquidService.getPublicConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get Hyperliquid status" });
    }
  });

  // Update Hyperliquid config (Master address, agent key, testnet toggle, admin passcode)
  app.post("/api/hyperliquid/config", async (req, res) => {
    try {
      const { masterAddress, agentPrivateKey, isTestnet, mainnetAllowed, adminPasscode, dailyLossLimitUSD } = req.body;
      const result = await hyperliquidService.updateConfig({
        masterAddress,
        agentPrivateKey,
        isTestnet,
        mainnetAllowed,
        adminPasscode,
        dailyLossLimitUSD,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to update Hyperliquid config" });
    }
  });

  // Get full clearinghouse account state, margin summary & open positions
  app.get("/api/hyperliquid/account", async (req, res) => {
    try {
      const state = await hyperliquidService.getAccountState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch account state" });
    }
  });

  // Admin-authorized market execution with TP/SL protective orders
  app.post("/api/hyperliquid/order", async (req, res) => {
    try {
      const {
        symbol,
        isBuy,
        marginUSDC,
        leverage,
        isIsolated,
        takeProfitPrice,
        stopLossPrice,
        slippageTolerance,
        adminPasscode,
      } = req.body;

      if (!adminPasscode) {
        return res.status(401).json({ error: "Admin authorization passcode is required for real execution." });
      }

      if (!symbol || typeof isBuy !== "boolean" || !marginUSDC || marginUSDC <= 0) {
        return res.status(400).json({ error: "Invalid order parameters (symbol, isBuy, marginUSDC required)." });
      }

      const result = await hyperliquidService.executeOrder({
        symbol,
        isBuy,
        marginUSDC: parseFloat(marginUSDC),
        leverage: parseInt(leverage, 10) || 5,
        isIsolated: Boolean(isIsolated),
        takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
        stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
        slippageTolerance: slippageTolerance ? parseFloat(slippageTolerance) : 0.005,
        adminPasscode,
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Order execution failed." });
    }
  });

  // Close position using reduce-only market order
  app.post("/api/hyperliquid/close", async (req, res) => {
    try {
      const { symbol, adminPasscode } = req.body;
      if (!adminPasscode) {
        return res.status(401).json({ error: "Admin passcode is required." });
      }
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required." });
      }

      const result = await hyperliquidService.closePosition(symbol, adminPasscode);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to close position." });
    }
  });

  // Cancel order (e.g. TP/SL trigger)
  app.post("/api/hyperliquid/cancel-order", async (req, res) => {
    try {
      const { symbol, orderId, adminPasscode } = req.body;
      if (!adminPasscode || !orderId || !symbol) {
        return res.status(400).json({ error: "Symbol, orderId and adminPasscode required." });
      }
      const result = await hyperliquidService.cancelOrder(symbol, parseInt(orderId, 10), adminPasscode);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to cancel order." });
    }
  });

  // Update leverage
  app.post("/api/hyperliquid/update-leverage", async (req, res) => {
    try {
      const { symbol, leverage, isCross } = req.body;
      const result = await hyperliquidService.setLeverage(symbol, parseInt(leverage, 10), Boolean(isCross));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to update leverage." });
    }
  });

  // Get trade history / fills and execution audit log
  app.get("/api/hyperliquid/history", async (req, res) => {
    try {
      const history = await hyperliquidService.getHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch history" });
    }
  });

  // Vite integration (SPA serving)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });

    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api/")) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        let html = fs.readFileSync(indexPath, "utf-8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
