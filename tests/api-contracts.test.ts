import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiFailure } from "../src/tradenews/apiClient.ts";
import { authLogin, authRegister, getKlines, getTickers } from "../src/tradenews/api.ts";
import {
  closeDemoPosition,
  getDemoBalance,
  openDemoPosition,
} from "../src/tradenews/apiExtended.ts";

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
});

describe("TradeNews Cloudflare API contracts", () => {
  it("auth/login posts credentials and returns a typed failure on 401", async () => {
    mockFetchOnce(401, { error: "Invalid credentials" });
    const res = await authLogin({ email: "a@b.c", password: "password123" });
    expect(res.ok).toBe(false);
    const fail = res as unknown as ApiFailure;
    expect(fail.kind).toBe("unauthorized");
    expect(fail.endpointDisabled).toBe(false);
  });

  it("auth/register sends turnstile token + referral code", async () => {
    const fetchMock = mockFetchOnce(200, {
      data: { token: "tok", user: { id: "1", email: "a@b.c" } },
    });
    const res = await authRegister({
      email: "a@b.c",
      password: "password123",
      turnstileToken: "ts-token",
      referralCode: "TN-1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as any).body);
    expect(body.turnstileToken).toBe("ts-token");
    expect(body.referralCode).toBe("TN-1");
    expect(res.ok).toBe(true);
  });

  it("market tickers: empty array is valid, failures are typed", async () => {
    mockFetchOnce(200, { data: [] });
    const okRes = await getTickers();
    expect(okRes.ok).toBe(true);

    mockFetchOnce(404, { error: "Not found" });
    const missing = await getTickers();
    expect(missing.ok).toBe(false);
    expect((missing as unknown as ApiFailure).endpointDisabled).toBe(true);
  });

  it("market klines passes symbol/interval/limit", async () => {
    const fetchMock = mockFetchOnce(200, { data: [] });
    await getKlines("BTC/USDT", "15m", 120);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("symbol=BTC%2FUSDT");
    expect(String(url)).toContain("interval=15m");
  });

  it("demo balance never fabricates: 500 surfaces as server failure", async () => {
    mockFetchOnce(500, { error: "boom" });
    const res = await getDemoBalance();
    expect(res.ok).toBe(false);
    const fail = res as unknown as ApiFailure;
    expect(fail.kind).toBe("server");
    expect(fail.endpointDisabled).toBe(false);
  });

  it("demo open/close shape", async () => {
    mockFetchOnce(200, {
      data: { id: "p1", symbol: "BTC/USDT", side: "LONG", entryPrice: 1, sizeUsdt: 100, leverage: 10, status: "OPEN" },
    });
    const opened = await openDemoPosition({ symbol: "BTC/USDT", side: "LONG", sizeUsdt: 100, leverage: 10 });
    expect(opened.ok).toBe(true);

    mockFetchOnce(200, { data: { closed: true } });
    const closed = await closeDemoPosition("p1");
    expect(closed.ok).toBe(true);
  });

  it("tradenewsFetch attaches Bearer token when present", async () => {
    const store: Record<string, string> = { tradenews_auth_token: "secret-token" };
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    } as any);
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as any);
    const fetchMock = mockFetchOnce(200, { data: [] });
    await getTickers();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).headers.Authorization).toBe("Bearer secret-token");
  });
});
