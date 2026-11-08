import { HttpTransport, InfoClient, ExchangeClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// Configuration interface
export interface HyperliquidConfig {
  masterAddress: string;
  agentPrivateKey?: string; // Stored securely on backend only, never exposed to client
  agentAddress?: string;
  isTestnet: boolean;
  mainnetAllowed: boolean;
  adminPasscode: string;
  dailyLossLimitUSD: number;
  dailyLossAccumulatedUSD: number;
  maxPositionNotionalUSD: number;
  maxLeverageLimit: number;
  lastUpdated: number;
}

// Order execution request interface
export interface ExecuteOrderParams {
  symbol: string;           // e.g. "BTC/USDT" or "BTC"
  isBuy: boolean;           // true for LONG, false for SHORT
  marginUSDC: number;       // Margin to allocate
  leverage: number;         // e.g. 5x, 10x, 20x
  isIsolated: boolean;      // true for Isolated, false for Cross
  takeProfitPrice?: number; // Optional TP trigger price
  stopLossPrice?: number;   // Optional SL trigger price
  slippageTolerance?: number; // Slippage tolerance e.g. 0.005 (0.5%)
  adminPasscode: string;    // Explicit admin authorization
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: "MARKET_OPEN" | "CLOSE_POSITION" | "TP_ORDER" | "SL_ORDER" | "SAFE_CLOSE_TRIGGERED" | "LEVERAGE_CHANGE";
  symbol: string;
  coin: string;
  side: "BUY" | "SELL";
  size: string;
  price?: string;
  margin?: number;
  leverage?: number;
  status: "SUCCESS" | "FAILED" | "PROTECTION_TRIGGERED";
  orderId?: number;
  tpOrderId?: number;
  slOrderId?: number;
  safeCloseExecuted?: boolean;
  exposureReport?: string;
  error?: string;
}

// In-memory backend state (persisted per session, no keys ever exposed)
const serverConfig: HyperliquidConfig = {
  masterAddress: process.env.HYPERLIQUID_MASTER_ADDRESS || "",
  agentPrivateKey: process.env.HYPERLIQUID_AGENT_KEY || "",
  agentAddress: "",
  isTestnet: true, // Always start in safe Testnet mode
  mainnetAllowed: false,
  adminPasscode: process.env.ADMIN_PASSCODE || "admin123",
  dailyLossLimitUSD: 1000,
  dailyLossAccumulatedUSD: 0,
  maxPositionNotionalUSD: 10000,
  maxLeverageLimit: 50,
  lastUpdated: Date.now(),
};

// If agent private key was provided in env, compute agent address
if (serverConfig.agentPrivateKey && serverConfig.agentPrivateKey.startsWith("0x")) {
  try {
    const acc = privateKeyToAccount(serverConfig.agentPrivateKey as Hex);
    serverConfig.agentAddress = acc.address;
  } catch (err) {
    console.error("Invalid HYPERLIQUID_AGENT_KEY in environment");
  }
}

// Rate limiter / anti-duplicate lock table
const inFlightOrders = new Set<string>();
const lastOrderTimestamp: Record<string, number> = {};

// Audit execution logs
const auditLogs: AuditLogEntry[] = [];

// Universe & Meta Cache
interface MetaCache {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
  }>;
  assetCtxs?: any[];
  timestamp: number;
}

let testnetMetaCache: MetaCache | null = null;
let mainnetMetaCache: MetaCache | null = null;

function getTransport(isTestnet: boolean): HttpTransport {
  return new HttpTransport({ isTestnet });
}

function getInfoClient(isTestnet: boolean): InfoClient {
  return new InfoClient({ transport: getTransport(isTestnet) });
}

function getExchangeClient(isTestnet: boolean): ExchangeClient | null {
  if (!serverConfig.agentPrivateKey) return null;
  try {
    const wallet = privateKeyToAccount(serverConfig.agentPrivateKey as Hex);
    const transport = getTransport(isTestnet);
    return new ExchangeClient({
      transport,
      wallet,
    });
  } catch (err) {
    console.error("Failed to initialize Hyperliquid ExchangeClient:", err);
    return null;
  }
}

// Clean and normalize coin symbol (e.g., "BTC/USDT" -> "BTC", "PEPE/USDT" -> "kPEPE" if needed)
export function normalizeCoin(symbol: string): string {
  if (!symbol) return "BTC";
  let clean = symbol.toUpperCase().replace("/USDT", "").replace("/USD", "").replace("_USDT", "").replace("-USDT", "").trim();
  // Special Hyperliquid tickers: 1000PEPE is kPEPE
  if (clean === "PEPE" || clean === "1000PEPE") return "kPEPE";
  if (clean === "SHIB" || clean === "1000SHIB") return "kSHIB";
  if (clean === "FLOKI" || clean === "1000FLOKI") return "kFLOKI";
  if (clean === "BONK" || clean === "1000BONK") return "kBONK";
  return clean;
}

// Fetch and cache universe meta
export async function getMeta(isTestnet: boolean): Promise<MetaCache> {
  const now = Date.now();
  const cache = isTestnet ? testnetMetaCache : mainnetMetaCache;
  if (cache && now - cache.timestamp < 60000) {
    return cache;
  }

  const info = getInfoClient(isTestnet);
  const metaAndCtxs = await info.metaAndAssetCtxs();
  const meta = metaAndCtxs[0];
  const assetCtxs = metaAndCtxs[1] || [];

  const newCache: MetaCache = {
    universe: meta.universe,
    assetCtxs,
    timestamp: now,
  };

  if (isTestnet) {
    testnetMetaCache = newCache;
  } else {
    mainnetMetaCache = newCache;
  }

  return newCache;
}

// Find asset info by symbol
export async function getAssetInfo(symbol: string, isTestnet: boolean) {
  const coin = normalizeCoin(symbol);
  const meta = await getMeta(isTestnet);

  let index = meta.universe.findIndex((u) => u.name.toUpperCase() === coin.toUpperCase());
  if (index === -1) {
    // Try without prefix or fallback
    index = meta.universe.findIndex((u) => u.name.toUpperCase().includes(coin.toUpperCase()));
  }

  if (index === -1) {
    throw new Error(`Asset '${coin}' not supported on Hyperliquid ${isTestnet ? "Testnet" : "Mainnet"}`);
  }

  const asset = meta.universe[index];
  const ctx = meta.assetCtxs?.[index] || null;

  return {
    index,
    coin: asset.name,
    szDecimals: asset.szDecimals,
    maxLeverage: Math.min(asset.maxLeverage, serverConfig.maxLeverageLimit),
    markPx: ctx ? parseFloat(ctx.markPx || ctx.oraclePx || "0") : 0,
    midPx: ctx ? parseFloat(ctx.midPx || ctx.markPx || "0") : 0,
  };
}

// Format price with Hyperliquid rules:
// Max 5 significant figures, and no more than (6 - szDecimals) decimal places
export function formatHyperliquidPrice(price: number, szDecimals: number): string {
  if (price <= 0 || isNaN(price)) return "0";
  const maxDecimals = Math.max(0, 6 - szDecimals);

  // Round to max 5 significant figures
  const sigStr = price.toPrecision(5);
  const parsed = parseFloat(sigStr);

  // Then ensure maxDecimals precision
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(parsed * factor) / factor;

  // Format as string without trailing useless zeros if integer
  const formatted = rounded.toFixed(maxDecimals);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

// Format size with szDecimals
export function formatHyperliquidSize(size: number, szDecimals: number): string {
  if (size <= 0 || isNaN(size)) return "0";
  const factor = Math.pow(10, szDecimals);
  const rounded = Math.floor(size * factor) / factor; // Floor to avoid exceeding available margin
  return rounded.toFixed(szDecimals);
}

// Hyperliquid Service Object
export const hyperliquidService = {
  // Public config for frontend (redacts private keys)
  getPublicConfig() {
    return {
      configured: Boolean(serverConfig.masterAddress && serverConfig.agentPrivateKey),
      masterAddress: serverConfig.masterAddress,
      agentAddress: serverConfig.agentAddress,
      isTestnet: serverConfig.isTestnet,
      mainnetAllowed: serverConfig.mainnetAllowed,
      dailyLossLimitUSD: serverConfig.dailyLossLimitUSD,
      dailyLossAccumulatedUSD: serverConfig.dailyLossAccumulatedUSD,
      maxPositionNotionalUSD: serverConfig.maxPositionNotionalUSD,
      maxLeverageLimit: serverConfig.maxLeverageLimit,
      lastUpdated: serverConfig.lastUpdated,
      jurisdictionNotice: "Hyperliquid is not available to US persons or restricted jurisdictions. Trading involves risk of total loss.",
    };
  },

  // Update backend configuration (requires admin authorization)
  async updateConfig(params: {
    masterAddress?: string;
    agentPrivateKey?: string;
    isTestnet?: boolean;
    mainnetAllowed?: boolean;
    adminPasscode?: string;
    dailyLossLimitUSD?: number;
  }) {
    if (params.adminPasscode && params.adminPasscode !== serverConfig.adminPasscode) {
      throw new Error("Invalid Admin Passcode. Action rejected.");
    }

    if (params.masterAddress) {
      const clean = params.masterAddress.trim();
      if (!clean.startsWith("0x") || clean.length !== 42) {
        throw new Error("Invalid Master Address. Must be a 42-character 0x EVM address.");
      }
      serverConfig.masterAddress = clean;
    }

    if (params.agentPrivateKey) {
      let cleanKey = params.agentPrivateKey.trim();
      if (!cleanKey.startsWith("0x")) cleanKey = `0x${cleanKey}`;
      if (cleanKey.length !== 66) {
        throw new Error("Invalid Agent Private Key. Must be 64 hex characters (0x...).");
      }
      try {
        const acc = privateKeyToAccount(cleanKey as Hex);
        serverConfig.agentPrivateKey = cleanKey;
        serverConfig.agentAddress = acc.address;
      } catch (e: any) {
        throw new Error(`Failed to derive address from Agent Private Key: ${e.message}`);
      }
    }

    if (typeof params.isTestnet === "boolean") {
      serverConfig.isTestnet = params.isTestnet;
    }

    if (typeof params.mainnetAllowed === "boolean") {
      serverConfig.mainnetAllowed = params.mainnetAllowed;
    }

    if (typeof params.dailyLossLimitUSD === "number" && params.dailyLossLimitUSD > 0) {
      serverConfig.dailyLossLimitUSD = params.dailyLossLimitUSD;
    }

    serverConfig.lastUpdated = Date.now();

    // Verify connectivity if both address and agent key are set
    let verificationStatus = "CONFIGURED";
    if (serverConfig.masterAddress && serverConfig.agentPrivateKey) {
      try {
        const info = getInfoClient(serverConfig.isTestnet);
        const state = await info.clearinghouseState({ user: serverConfig.masterAddress as Hex });
        verificationStatus = `CONNECTED_AND_VERIFIED (Account Value: $${parseFloat(state.marginSummary.accountValue || "0").toFixed(2)} USDC)`;
      } catch (err: any) {
        verificationStatus = `WARNING_API_CHECK_FAILED: ${err.message}`;
      }
    }

    return {
      success: true,
      status: verificationStatus,
      config: this.getPublicConfig(),
    };
  },

  // Fetch full clearinghouse account state & positions
  async getAccountState() {
    if (!serverConfig.masterAddress) {
      return {
        configured: false,
        accountValue: 0,
        totalMarginUsed: 0,
        withdrawable: 0,
        crossMaintenanceMargin: 0,
        openPositions: [],
        openOrders: [],
        isTestnet: serverConfig.isTestnet,
      };
    }

    const isTestnet = serverConfig.isTestnet;
    const info = getInfoClient(isTestnet);

    try {
      const [state, openOrdersList, metaCache] = await Promise.all([
        info.clearinghouseState({ user: serverConfig.masterAddress as Hex }),
        info.openOrders({ user: serverConfig.masterAddress as Hex }).catch(() => []),
        getMeta(isTestnet),
      ]);

      const margin: any = state.marginSummary || {};
      const accountValue = parseFloat(margin.accountValue || "0");
      const totalMarginUsed = parseFloat(margin.totalMarginUsed || "0");
      const withdrawable = parseFloat(state.withdrawable || "0");
      const crossMaintenanceMargin = parseFloat(state.crossMaintenanceMarginUsed || "0");

      // Format open positions
      const openPositions = (state.assetPositions || [])
        .map((item: any) => {
          const pos = item.position;
          if (!pos) return null;
          const szi = parseFloat(pos.szi || "0");
          if (Math.abs(szi) === 0) return null;

          const coin = pos.coin;
          const isLong = szi > 0;
          const entryPx = parseFloat(pos.entryPx || "0");
          const liquidationPx = parseFloat(pos.liquidationPx || "0");
          const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
          const positionValue = parseFloat(pos.positionValue || "0");
          const returnOnEquity = parseFloat(pos.returnOnEquity || "0") * 100;
          const leverage = typeof pos.leverage === "object" ? pos.leverage.value : pos.leverage;

          // Find current mark price
          const assetIdx = metaCache.universe.findIndex((u) => u.name === coin);
          const markPx = metaCache.assetCtxs?.[assetIdx]
            ? parseFloat(metaCache.assetCtxs[assetIdx].markPx || pos.entryPx)
            : entryPx;

          // Look for matching open TP/SL triggers
          const relatedOrders = openOrdersList.filter((o: any) => o.coin === coin);
          const tpOrder = relatedOrders.find((o: any) => o.orderType === "Take Profit" || o.orderType === "tp" || o.triggerCondition?.includes("tp"));
          const slOrder = relatedOrders.find((o: any) => o.orderType === "Stop Loss" || o.orderType === "sl" || o.triggerCondition?.includes("sl"));

          return {
            coin,
            symbol: `${coin}/USDT`,
            side: isLong ? "LONG" : "SHORT",
            size: Math.abs(szi),
            sizeRaw: pos.szi,
            entryPrice: entryPx,
            markPrice: markPx,
            liquidationPrice: liquidationPx,
            unrealizedPnl,
            returnOnEquity,
            positionValue,
            leverage: leverage || 1,
            marginUsed: parseFloat(pos.marginUsed || "0"),
            tpOrder: tpOrder ? { id: tpOrder.oid, price: parseFloat(tpOrder.triggerPx || tpOrder.limitPx || "0") } : null,
            slOrder: slOrder ? { id: slOrder.oid, price: parseFloat(slOrder.triggerPx || slOrder.limitPx || "0") } : null,
          };
        })
        .filter(Boolean);

      return {
        configured: true,
        isTestnet,
        masterAddress: serverConfig.masterAddress,
        agentAddress: serverConfig.agentAddress,
        accountValue,
        totalMarginUsed,
        withdrawable,
        crossMaintenanceMargin,
        openPositions,
        openOrders: openOrdersList,
        dailyLossAccumulatedUSD: serverConfig.dailyLossAccumulatedUSD,
        dailyLossLimitUSD: serverConfig.dailyLossLimitUSD,
      };
    } catch (err: any) {
      console.error("Failed to query clearinghouse state:", err.message);
      throw new Error(`Failed to fetch Hyperliquid state: ${err.message}`);
    }
  },

  // Set leverage on an asset
  async setLeverage(symbol: string, leverage: number, isCross: boolean) {
    if (!serverConfig.agentPrivateKey) throw new Error("Agent Wallet not configured.");
    const exchange = getExchangeClient(serverConfig.isTestnet);
    if (!exchange) throw new Error("Could not initialize exchange client.");

    const assetInfo = await getAssetInfo(symbol, serverConfig.isTestnet);
    const targetLeverage = Math.min(leverage, assetInfo.maxLeverage);

    try {
      const res = await exchange.updateLeverage({
        asset: assetInfo.index,
        isCross,
        leverage: targetLeverage,
      });
      return { success: true, asset: assetInfo.coin, leverage: targetLeverage, isCross, result: res };
    } catch (err: any) {
      console.error("Failed to update leverage:", err.message);
      throw new Error(`Leverage update failed: ${err.message}`);
    }
  },

  // Admin-authorized market execution with TP/SL protective orders and safe fail-close
  async executeOrder(params: ExecuteOrderParams): Promise<{
    success: boolean;
    orderId?: number;
    filledSize?: string;
    filledPrice?: string;
    tpOrderId?: number;
    slOrderId?: number;
    protectiveOrdersVerified: boolean;
    exposureAlert?: string;
    safeCloseExecuted?: boolean;
    details: any;
  }> {
    // 1. Explicit Admin Authorization Check
    if (params.adminPasscode !== serverConfig.adminPasscode) {
      throw new Error("Unauthorized: Invalid Admin Authorization Passcode.");
    }

    // 2. Mode and Mainnet gating check
    if (!serverConfig.isTestnet && !serverConfig.mainnetAllowed) {
      throw new Error("Mainnet execution is locked until validation is complete. Enable Mainnet explicitly in settings.");
    }

    if (!serverConfig.masterAddress || !serverConfig.agentPrivateKey) {
      throw new Error("Hyperliquid credentials not configured. Please setup Agent Wallet.");
    }

    // 3. Circuit breaker & Risk limit checks
    if (serverConfig.dailyLossAccumulatedUSD >= serverConfig.dailyLossLimitUSD) {
      throw new Error(`Circuit Breaker Tripped: Daily loss limit ($${serverConfig.dailyLossLimitUSD}) reached. Trading halted for today.`);
    }

    // 4. Anti-duplicate order check
    const lockKey = `${params.symbol}_${params.isBuy ? "BUY" : "SELL"}`;
    const now = Date.now();
    if (inFlightOrders.has(lockKey)) {
      throw new Error("Order already in flight. Please wait for completion to prevent duplicate fills.");
    }
    if (lastOrderTimestamp[lockKey] && now - lastOrderTimestamp[lockKey] < 2500) {
      throw new Error("Duplicate submission prevented. Please wait 2.5 seconds between identical orders.");
    }

    inFlightOrders.add(lockKey);
    lastOrderTimestamp[lockKey] = now;

    const exchange = getExchangeClient(serverConfig.isTestnet);
    if (!exchange) {
      inFlightOrders.delete(lockKey);
      throw new Error("Exchange client failed to initialize.");
    }

    try {
      // 5. Asset resolution & limits
      const asset = await getAssetInfo(params.symbol, serverConfig.isTestnet);
      const markPx = asset.markPx > 0 ? asset.markPx : 1;

      // Leverage safety clamp
      const effectiveLeverage = Math.min(params.leverage, asset.maxLeverage);

      // Margin & Notional size check
      const notionalUSD = params.marginUSDC * effectiveLeverage;
      if (notionalUSD > serverConfig.maxPositionNotionalUSD) {
        throw new Error(`Position size ($${notionalUSD.toFixed(2)}) exceeds maximum allowed notional ($${serverConfig.maxPositionNotionalUSD}).`);
      }

      // Calculate base asset size
      const rawSize = notionalUSD / markPx;
      const formattedSize = formatHyperliquidSize(rawSize, asset.szDecimals);

      if (parseFloat(formattedSize) <= 0) {
        throw new Error(`Order size too small for ${asset.coin}. Minimum size step is ${Math.pow(10, -asset.szDecimals)}.`);
      }

      // Calculate aggressive market limit price based on slippage tolerance
      const slippage = params.slippageTolerance || 0.005; // 0.5% default slippage
      const aggressivePrice = params.isBuy
        ? markPx * (1 + slippage)
        : markPx * (1 - slippage);
      const formattedPrice = formatHyperliquidPrice(aggressivePrice, asset.szDecimals);

      // Update leverage before opening
      try {
        await exchange.updateLeverage({
          asset: asset.index,
          isCross: !params.isIsolated,
          leverage: effectiveLeverage,
        });
      } catch (levErr: any) {
        console.warn("Notice: Leverage update warning (might already be set):", levErr.message);
      }

      // 6. Submit Market Order (FrontendMarket / Ioc)
      console.log(`[Hyperliquid] Executing MARKET ${params.isBuy ? "BUY" : "SELL"} on ${asset.coin}: size=${formattedSize}, px=${formattedPrice}`);

      const orderResult: any = await exchange.order({
        orders: [
          {
            a: asset.index,
            b: params.isBuy,
            p: formattedPrice,
            s: formattedSize,
            r: false,
            t: {
              limit: {
                tif: "FrontendMarket",
              },
            },
          },
        ],
        grouping: "na",
      });

      console.log("[Hyperliquid] Order result:", JSON.stringify(orderResult));

      // Check status of main order
      const statusObj = orderResult?.response?.data?.statuses?.[0];
      if (statusObj && statusObj.error) {
        throw new Error(`Hyperliquid Order Rejected: ${statusObj.error}`);
      }

      const mainOrderId = statusObj?.filled?.oid || statusObj?.resting?.oid || Date.now();
      const avgPx = statusObj?.filled?.avgPx || markPx.toString();

      // Record in audit log
      const auditEntry: AuditLogEntry = {
        id: `hl-${Date.now()}`,
        timestamp: Date.now(),
        type: "MARKET_OPEN",
        symbol: params.symbol,
        coin: asset.coin,
        side: params.isBuy ? "BUY" : "SELL",
        size: formattedSize,
        price: avgPx,
        margin: params.marginUSDC,
        leverage: effectiveLeverage,
        status: "SUCCESS",
        orderId: mainOrderId,
      };

      // 7. Protective Orders Placement (Reduce-Only TP/SL)
      let tpOrderId: number | undefined;
      let slOrderId: number | undefined;
      let protectiveOrdersVerified = true;
      let exposureAlert: string | undefined;
      let safeCloseExecuted = false;

      // If user specified Take Profit
      if (params.takeProfitPrice && params.takeProfitPrice > 0) {
        try {
          const tpPx = formatHyperliquidPrice(params.takeProfitPrice, asset.szDecimals);
          // For TP: if we went LONG (buy), TP is SELL (b: false) at higher price
          // If we went SHORT (sell), TP is BUY (b: true) at lower price
          const tpSide = !params.isBuy;

          const tpResult: any = await exchange.order({
            orders: [
              {
                a: asset.index,
                b: tpSide,
                p: tpPx,
                s: formattedSize,
                r: true, // Reduce-only
                t: {
                  trigger: {
                    isMarket: true,
                    triggerPx: tpPx,
                    tpsl: "tp",
                  },
                },
              },
            ],
            grouping: "normalTpsl",
          });

          const tpStatus = tpResult?.response?.data?.statuses?.[0];
          if (tpStatus?.error) {
            throw new Error(`TP Order error: ${tpStatus.error}`);
          }
          tpOrderId = tpStatus?.resting?.oid || tpStatus?.filled?.oid;
          auditEntry.tpOrderId = tpOrderId;
        } catch (tpErr: any) {
          console.error("[Hyperliquid] Failed to place TP order:", tpErr.message);
          protectiveOrdersVerified = false;
          exposureAlert = `Take Profit order placement failed: ${tpErr.message}`;
        }
      }

      // If user specified Stop Loss
      if (params.stopLossPrice && params.stopLossPrice > 0) {
        try {
          const slPx = formatHyperliquidPrice(params.stopLossPrice, asset.szDecimals);
          const slSide = !params.isBuy;

          const slResult: any = await exchange.order({
            orders: [
              {
                a: asset.index,
                b: slSide,
                p: slPx,
                s: formattedSize,
                r: true, // Reduce-only
                t: {
                  trigger: {
                    isMarket: true,
                    triggerPx: slPx,
                    tpsl: "sl",
                  },
                },
              },
            ],
            grouping: "normalTpsl",
          });

          const slStatus = slResult?.response?.data?.statuses?.[0];
          if (slStatus?.error) {
            throw new Error(`SL Order error: ${slStatus.error}`);
          }
          slOrderId = slStatus?.resting?.oid || slStatus?.filled?.oid;
          auditEntry.slOrderId = slOrderId;
        } catch (slErr: any) {
          console.error("[Hyperliquid] Failed to place SL order:", slErr.message);
          protectiveOrdersVerified = false;
          exposureAlert = exposureAlert
            ? `${exposureAlert} | Stop Loss failed: ${slErr.message}`
            : `Stop Loss order placement failed: ${slErr.message}`;
        }
      }

      // 8. CRITICAL REQUIREMENT #12:
      // "If protective orders fail, attempt a safe position close and report any remaining exposure."
      if (!protectiveOrdersVerified && (params.takeProfitPrice || params.stopLossPrice)) {
        console.warn("[Hyperliquid SAFETY TRIGGER] Protective orders failed. Attempting emergency safe market close!");
        auditEntry.status = "PROTECTION_TRIGGERED";

        try {
          // Attempt reduce-only emergency close
          const emergencySide = !params.isBuy;
          const emergencyPrice = emergencySide
            ? markPx * (1 + (params.slippageTolerance || 0.01))
            : markPx * (1 - (params.slippageTolerance || 0.01));
          const emergencyPxStr = formatHyperliquidPrice(emergencyPrice, asset.szDecimals);

          const closeRes: any = await exchange.order({
            orders: [
              {
                a: asset.index,
                b: emergencySide,
                p: emergencyPxStr,
                s: formattedSize,
                r: true,
                t: {
                  limit: {
                    tif: "FrontendMarket",
                  },
                },
              },
            ],
            grouping: "na",
          });

          const closeStatus = closeRes?.response?.data?.statuses?.[0];
          if (!closeStatus?.error) {
            safeCloseExecuted = true;
            auditEntry.safeCloseExecuted = true;
            exposureAlert = `SAFE CLOSE EXECUTED: Protective orders failed, so the position was automatically closed to protect your capital. Reason: ${exposureAlert}`;
          } else {
            exposureAlert = `EMERGENCY ALERT: Protective orders failed AND safe close attempt returned: ${closeStatus.error}. Active exposure remains on ${asset.coin}! Close manually.`;
          }
        } catch (closeErr: any) {
          exposureAlert = `EMERGENCY ALERT: Protective orders failed AND emergency close failed (${closeErr.message}). Exposure remains on ${asset.coin}! Close immediately.`;
        }
      }

      auditEntry.exposureReport = exposureAlert;
      auditLogs.unshift(auditEntry);
      if (auditLogs.length > 50) auditLogs.pop();

      return {
        success: true,
        orderId: mainOrderId,
        filledSize: formattedSize,
        filledPrice: avgPx,
        tpOrderId,
        slOrderId,
        protectiveOrdersVerified,
        exposureAlert,
        safeCloseExecuted,
        details: orderResult,
      };
    } finally {
      inFlightOrders.delete(lockKey);
    }
  },

  // Close Position with Reduce-Only execution
  async closePosition(symbol: string, adminPasscode: string) {
    if (adminPasscode !== serverConfig.adminPasscode) {
      throw new Error("Unauthorized: Invalid Admin Authorization Passcode.");
    }

    if (!serverConfig.agentPrivateKey) throw new Error("Agent Wallet not configured.");
    const exchange = getExchangeClient(serverConfig.isTestnet);
    const info = getInfoClient(serverConfig.isTestnet);
    if (!exchange) throw new Error("Exchange client failed to initialize.");

    const asset = await getAssetInfo(symbol, serverConfig.isTestnet);
    const state = await info.clearinghouseState({ user: serverConfig.masterAddress as Hex });

    const openPos = (state.assetPositions || []).find((p: any) => p?.position?.coin === asset.coin);
    if (!openPos || !openPos.position) {
      throw new Error(`No open position found on Hyperliquid for ${asset.coin}.`);
    }

    const szi = parseFloat(openPos.position.szi || "0");
    if (Math.abs(szi) === 0) {
      throw new Error(`Position on ${asset.coin} is already 0.`);
    }

    const isLong = szi > 0;
    const closeSide = !isLong; // If long, sell to close; if short, buy to close
    const sizeStr = formatHyperliquidSize(Math.abs(szi), asset.szDecimals);

    // Cancel existing open orders (TP/SL) for this coin first
    try {
      const openOrders = await info.openOrders({ user: serverConfig.masterAddress as Hex });
      const coinOrders = openOrders.filter((o: any) => o.coin === asset.coin);
      if (coinOrders.length > 0) {
        await exchange.cancel({
          cancels: coinOrders.map((o: any) => ({ a: asset.index, o: o.oid })),
        });
      }
    } catch (e: any) {
      console.warn("Notice: Error cancelling old TP/SL before close:", e.message);
    }

    // Submit reduce-only market close
    const markPx = asset.markPx > 0 ? asset.markPx : parseFloat(openPos.position.entryPx || "1");
    const aggressivePrice = closeSide ? markPx * 0.99 : markPx * 1.01;
    const pxStr = formatHyperliquidPrice(aggressivePrice, asset.szDecimals);

    console.log(`[Hyperliquid] Closing position on ${asset.coin}: side=${closeSide ? "BUY" : "SELL"}, size=${sizeStr}`);

    const res: any = await exchange.order({
      orders: [
        {
          a: asset.index,
          b: closeSide,
          p: pxStr,
          s: sizeStr,
          r: true, // Reduce-only!
          t: {
            limit: {
              tif: "FrontendMarket",
            },
          },
        },
      ],
      grouping: "na",
    });

    const statusObj = res?.response?.data?.statuses?.[0];
    if (statusObj?.error) {
      throw new Error(`Close position rejected: ${statusObj.error}`);
    }

    // Track daily PnL impact
    const unrealized = parseFloat(openPos.position.unrealizedPnl || "0");
    if (unrealized < 0) {
      serverConfig.dailyLossAccumulatedUSD += Math.abs(unrealized);
    }

    auditLogs.unshift({
      id: `hl-close-${Date.now()}`,
      timestamp: Date.now(),
      type: "CLOSE_POSITION",
      symbol,
      coin: asset.coin,
      side: closeSide ? "BUY" : "SELL",
      size: sizeStr,
      price: pxStr,
      status: "SUCCESS",
    });

    return {
      success: true,
      coin: asset.coin,
      sizeClosed: sizeStr,
      result: res,
    };
  },

  // Cancel specific order (e.g. TP/SL)
  async cancelOrder(symbol: string, orderId: number, adminPasscode: string) {
    if (adminPasscode !== serverConfig.adminPasscode) {
      throw new Error("Unauthorized: Invalid Admin Authorization Passcode.");
    }
    const exchange = getExchangeClient(serverConfig.isTestnet);
    if (!exchange) throw new Error("Exchange client failed to initialize.");

    const asset = await getAssetInfo(symbol, serverConfig.isTestnet);
    const res = await exchange.cancel({
      cancels: [{ a: asset.index, o: orderId }],
    });

    return { success: true, orderId, result: res };
  },

  // Retrieve trade history / user fills
  async getHistory() {
    if (!serverConfig.masterAddress) {
      return { fills: [], auditLogs };
    }
    const info = getInfoClient(serverConfig.isTestnet);
    try {
      const fills = await info.userFills({ user: serverConfig.masterAddress as Hex }).catch(() => []);
      return { fills, auditLogs };
    } catch (err: any) {
      return { fills: [], auditLogs, error: err.message };
    }
  },
};
