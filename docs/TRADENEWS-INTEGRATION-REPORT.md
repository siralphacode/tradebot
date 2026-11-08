# TradeNews ↔ TradeBot Integration Report

Branch: `integration/tradenews-tradebot-cloudflare`
Date: 2026-11-08
Production site (unchanged DNS): https://tradenews.live
Production API (unchanged): https://api.tradenews.live

## 0. Blocking constraint (must read)

The old TradeNews repository (`siralphacode/tradenews`,
branch `migration/cloudflare-d1-backend`) is **not accessible** to this
workspace identity: GitHub only lists `siralphacode/tradebot` for
`siralphacode`, and cloning `siralphacode/tradenews` returns either
"repository not found" or 403. I completed the full **frontend half** of
the replacement against documented contracts and made every backend touch
degrade to an explicit unavailable state. Final route mapping and staging
URL issuance must be done by someone with `tradenews` access.

## 1. Integrated features (this repo)

- TradeBot UI preserved: terminal, TATS PRO signal engine (local
  computation), charts, sidebar, price alerts, watchlists, history layout.
- New `src/tradenews/` backend layer (no second auth system):
  - `config.ts` — API base resolution (VITE_TRADENEWS_API_BASE →
    window.__TRADENEWS_API_BASE__ → same-origin /api), Turnstile key,
    FINANCIAL_OPERATIONS_ENABLED=false.
  - `apiClient.ts` — typed fetch with timeout, Bearer token, typed
    disabled/missing/unreachable failures. Never fabricates data.
  - `api.ts` / `apiExtended.ts` — auth, market, demo, positions/history,
    referrals, wallets, account wrappers against Cloudflare routes.
  - `AuthContext.tsx` + `AuthModal.tsx` — email/password + Cloudflare
    Turnstile (no reCAPTCHA), single token store.
  - `BackendBanner.tsx` — global backend status (online/offline/checking).
  - `DemoTradingPanel.tsx` — sign-in-gated demo positions backed by the
    backend only; isolated-demo labeling.
  - `ReferralPanel.tsx` — backend referral code display + apply.
- History page is now backend-first (`/positions/history`,
  `/trades/history`) with an explicit unavailable notice.
- Removed fabrications:
  - Fake $18,450 wallet, random-address connect, seeded 8-trade history,
    hardcoded symbol prices, +1.45% changes, simulated bot fills,
    wallet credit/debit on bot events, profit-secured event pipeline.
- Removed Google: `@google/genai` uninstalled, Gemini call replaced with a
  local-technical fallback in the legacy dev server, GEMINI_APP_URL env
  removed, no Firebase/reCAPTCHA/Cloud Run references in the new frontend
  path (only font CDN + `fonts.googleapis.com` remain, which is a font
  provider and not a Google Cloud backend dependency).
- Cloudflare files: `wrangler.jsonc` (staging assets), `public/_headers`
  (security headers + Turnstile CSP), `.github/workflows/` staging
  workflow (never production).

## 2. Missing / disabled features

- Exact upstream Worker route paths cannot be verified here (no
  `tradenews` repo access). Wrappers use the documented contracts and
  degrade gracefully (404/501/405 → "unavailable" UI).
- MEXC live trading, Hyperliquid live trading, copy-trading execution,
  deposits, withdrawals: **intentionally disabled** in UI
  (FINANCIAL_OPERATIONS_ENABLED=false).
- Copy-trading bots are a display-only strategy directory in this build.
- Wallet panel is record-only; balances render only from backend.

## 3. API connection status

- `VITE_TRADENEWS_API_BASE` defaults to `https://api.tradenews.live`;
  same-origin `/api` works when the Worker/Pages proxy is configured.
- Direct `api.tradenews.live` probing from this sandbox was inconclusive
  (egress-limited); the UI exposes live status via BackendBanner.
- Auth/me, demo, history, referrals, wallets: wired; show typed
  unavailable states when endpoints are missing/disabled.

## 4. Test results

- `npm run lint` (tsc --noEmit): PASS.
- `npm run build` (vite): PASS (~391 kB JS, ~109 kB gzip).
- New vitest suites: `tests/api-contracts.test.ts`,
  `tests/financial-safety.test.ts`, `tests/no-google-deps.test.ts`.
  (vitest install could not be confirmed — sandbox shell stalled on npm;
  run `npm install && npm test` where network is reliable.)
- Backend/auth/demo/market integration tests against the real Worker
  must run from staging with `tradenews` access.

## 5. Staging URL

Not yet issued — requires the `tradenews` repo's Pages/Worker project
(`tradenews-frontend-staging`) or a preview deploy of this branch.
Use the included workflow
`.github/workflows/tradenews-frontend-staging.yml`.

## 6. Production readiness

NOT READY for production. Gates still closed:
- [ ] Confirm Worker route paths against `migration/cloudflare-d1-backend`.
- [ ] Point staging `VITE_TRADENEWS_API_BASE` at staging backend.
- [ ] Turnstile site key configured; backend verification confirmed.
- [ ] D1 backup + rollback branch/tag captured.
- [ ] Security review (CSP, token storage, rate limits).
- [ ] Owner explicit approval. Do NOT deploy to production before this.

## 7. Remaining blockers / next actions for the owner

1. Grant this identity (or a CI identity) read access to
   `siralphacode/tradenews` @ `migration/cloudflare-d1-backend`.
2. Reconcile route paths in `src/tradenews/api*.ts` with the Worker.
3. Add staging secrets: STAGING_TRADENEWS_API_BASE,
   STAGING_TURNSTILE_SITE_KEY, CLOUDFLARE_API_TOKEN/ACCOUNT_ID.
4. Deploy staging, run auth/demo/market/history checks, capture staging URL.
5. Keep `main` as rollback; production only via the protected workflow.
