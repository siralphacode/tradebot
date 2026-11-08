# TradeNews frontend — API contract map

Frontend base: `VITE_TRADENEWS_API_BASE` (default
`https://api.tradenews.live`), or same-origin `/api` behind the Cloudflare
proxy. All calls are JSON with `Authorization: Bearer <token>` (except
register/login).

| TradeBot feature | Method + path | Notes |
|---|---|---|
| Register | POST /auth/register {email,password,turnstileToken?,referralCode?} | Turnstile, not reCAPTCHA |
| Login | POST /auth/login {email,password,turnstileToken?} | returns {token,user} |
| Me | GET /auth/me | Bearer required |
| Tickers | GET /market/tickers | TradeBot carousel + alerts |
| Price | GET /market/price?symbol= | optional |
| Klines | GET /market/klines?symbol=&interval=&limit= | TradingView-style chart |
| Signals | GET /signals?symbol= | Signal Scope feed (local TATS fallback if missing) |
| Demo balance | GET /demo/balance | isolated demo funds only |
| Demo positions | GET /demo/positions | open demo positions |
| Open demo | POST /demo/positions {symbol,side,sizeUsdt,leverage} | no real money |
| Close demo | POST /demo/positions/:id/close | no real money |
| Position history | GET /positions/history | backend truth for HISTORY page |
| Trade history | GET /trades/history | backend truth for HISTORY page |
| My referral | GET /referrals/me | code + counts + rewards |
| Apply referral | POST /referrals/apply {code} | |
| Wallets | GET /wallets | verified wallet records |
| Link wallet | POST /wallets/link {address,chain?} | verification server-side |
| Trading account | GET /account/balance | real-money reads stay disabled in UI |

Missing/disabled (404/501/405 or FINANCIAL_OPERATIONS_ENABLED=false)
render as explicit "unavailable" UI. Nothing is simulated.
