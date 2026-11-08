# PRODUCTION DEPLOYMENT LOG

- Target: https://tradenews.live (+ https://www.tradenews.live), API https://api.tradenews.live
- Source: siralphacode/tradebot@main
- Production merge commit: f3a8119
- Integration commits: 4761af2, 844fdfb
- Rollback commit: 85b6dd2
- Workflow: .github/workflows/tradenews-frontend-production.yml
- Validation (sandbox, 2026-11-08):
  - tsc --noEmit: PASS
  - vite build: PASS (dist 0.98 kB html / 90.41 kB css / 394.07 kB js)
  - vitest: 11/11 PASS (api-contracts 7, no-google-deps 3, financial-safety 1)

## Live verification (to be filled at deploy time — DO NOT FABRICATE)

- [ ] tradenews.live shows TradeBot interface (timestamp: ______)
- [ ] www.tradenews.live serves same build (timestamp: ______)
- [ ] api.tradenews.live health (status/body: ______)
- [ ] Auth + existing account records verified (user: ______)
- [ ] Balances/positions/referrals/wallets/history = stored data (notes: ______)
- [ ] Financial operations remain disabled (screenshot/note: ______)
- [ ] Pages deployment id: ______
- [ ] Worker version: ______
- [ ] D1 backup id + restore test: ______
