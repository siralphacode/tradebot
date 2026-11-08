# Rollback plan — TradeNews frontend replacement

- Rollback branch: `main` at commit `85b6dd2` (pre-integration).
  Do not delete or force-push it.
- Integration branch: `integration/tradenews-tradebot-cloudflare` (this work).
- Rollback = redeploy the last known-good `main` build to
  https://tradenews.live via the existing protected workflow; no D1 or
  DNS changes are made by this integration.
- Production D1 and production DNS must not be modified during
  development or staging verification.
- Before any production attempt: snapshot D1, tag the release, record the
  staging URL + test results in docs/TRADENEWS-INTEGRATION-REPORT.md, and
  obtain explicit owner approval.
