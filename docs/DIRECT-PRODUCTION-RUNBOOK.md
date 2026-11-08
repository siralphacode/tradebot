# DIRECT PRODUCTION RUNBOOK — TradeNews frontend replacement

Owner order: deploy the TradeBot interface DIRECTLY to production.
No staging. No staging database. Preserve all existing data.

## Deployed source (tradebot repo — the only repo this identity can access)

- Repo: siralphacode/tradebot (private)
- Branch: main
- Merge commit: f3a8119 ("TradeNews direct production: TradeBot interface
  on tradenews.live (backend untouched)")
- Integration commits: 4761af2 (frontend replacement), 844fdfb
  (production path + green tests)
- Previous rollback point: 85b6dd2 (pre-integration main)

NOTE: siralphacode/tradenews (migration/cloudflare-d1-backend) is NOT
visible to this identity (GraphQL "Could not resolve", REST 404). All
backend/D1/secret inspection steps below must be executed by the owner or
an identity with tradenews access. Nothing below modifies D1 or DNS.

## What "production deploy" consists of

1. Static frontend only: `dist/` built from tradebot@main is published to
   the Cloudflare Pages project `tradenews-frontend` (custom domains
   tradenews.live + www.tradenews.live).
2. Backend untouched: api.tradenews.live Worker + production D1 + secrets
   + env vars are NOT changed by this deploy. No D1 commands run in the
   workflow. No DNS edits. No wallet reassignment. No backfill.
3. Runtime wiring: the new UI calls `VITE_TRADENEWS_API_BASE`
   (production secret PROD_TRADENEWS_API_BASE, e.g.
   https://api.tradenews.live) or same-origin /api behind the Worker
   proxy. Missing/disabled endpoints render "unavailable" — no
   fabrication.

## Authorized deploy path (resolves the HTTP 401)

- Direct `wrangler` from this sandbox is NOT authorized: no
  CLOUDFLARE_API_TOKEN here, `wrangler whoami` = unauthenticated, Pages
  calls fail with 401 ("set a CLOUDFLARE_API_TOKEN"). This is the exact
  HTTP 401 class referenced in the order: no valid token in this
  environment.
- Authorized path: GitHub Actions workflow
  `.github/workflows/tradenews-frontend-production.yml` in tradebot@main:
  validate (tsc + vitest + build) → `cloudflare-production` environment
  (manual approval gate) → `pages deploy dist
  --project-name=tradenews-frontend --branch=main` using secrets
  CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
- A workflow_dispatch was attempted from this sandbox; GitHub API calls
  from the sandbox are timing out, so the owner should trigger it in the
  GitHub UI: tradebot → Actions → "tradenews-frontend-production" → Run
  workflow (main) → approve `cloudflare-production`.

## Owner pre-flight checklist (mandatory, in tradenews repo / Cloudflare)

1. Identify the authoritative production D1 (name/id/binding) in the
   tradenews Worker wrangler config; verify expected tables/row counts.
2. Check whether historical data still lives in Google Cloud MySQL; do
   NOT assume D1 already has user/financial records.
3. Take a verified recoverable production D1 backup (export/snapshot +
   restore test procedure) and record backup id.
4. Confirm Cloudflare secrets + env vars unchanged; confirm Turnstile
   keys; fix the API token 401 by issuing a token with Pages:Write +
   Workers:Read and storing it as CLOUDFLARE_API_TOKEN.
5. Set repo/environment secrets: CLOUDFLARE_API_TOKEN,
   CLOUDFLARE_ACCOUNT_ID, PROD_TRADENEWS_API_BASE,
   PROD_TURNSTILE_SITE_KEY. Keep VITE_FINANCIAL_OPERATIONS_ENABLED=false.
6. If any required historical data is missing/inaccessible: STOP — do not
   proceed with replacement; resolve data access first.

## Deploy + verify sequence

1. Approve + run the production workflow (see above).
2. Confirm validate job green (tsc, 11/11 vitest, vite build).
3. Confirm Pages deployment claims tradenews-frontend / branch main.
4. Verify live: https://tradenews.live shows the TradeBot interface
   (TradeNews branding, Signal Terminal / Strategies / History nav).
5. Verify https://www.tradenews.live serves the same build.
6. Verify https://api.tradenews.live health + auth/me with a real
   account; verify existing accounts, balances, positions, referrals,
   wallets, history return stored data (never empty seeded rows).
7. Verify demo trading is isolated; deposits/withdrawals/live/copy
   remain disabled in UI.
8. Record: deployed commit SHA, Pages deployment id, Worker version,
   verification timestamps in docs/PRODUCTION-DEPLOYMENT.md.

## Rollback

- Redeploy previous Pages build (pre-change) to tradenews-frontend, or
  `git revert f3a8119` / redeploy tradebot@85b6dd2 via the same workflow.
- No D1 restore is expected (D1 untouched by this deploy). If any data
  issue is found, restore from the verified backup taken above.
