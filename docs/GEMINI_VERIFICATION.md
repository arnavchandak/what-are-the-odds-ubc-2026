# Gemini integration verification

**November 20, 2026 at 11:36 a.m. CST.** The live Gemini API check found seven distinct active events using the Bitcoin and BTC search terms. The search reported a partial response. Five of eight sampled instruments returned at least two usable points for the seven-day chart.

| Event ticker | Instrument | Normalized history points |
| --- | --- | ---: |
| `BTC2611202200` | `GEMI-BTC2611202200-HI62000` | 129 |
| `BTC2611202200` | `GEMI-BTC2611202200-HI60000` | 4 |
| `BTC2611302200` | `GEMI-BTC2611302200-HI60000` | 147 |
| `BTC2611302200` | `GEMI-BTC2611302200-HI57500` | 63 |
| `BTC2611272200` | `GEMI-BTC2611272200-HI60500` | 2 |
| `BTC2611272200` | `GEMI-BTC2611272200-HI59000` | 1 |
| `BTC2611201800` | `GEMI-BTC2611201800-HI59100` | Unavailable |
| `BTC2611201800` | `GEMI-BTC2611201800-HI59300` | Unavailable |

Run `npm run verify:gemini` with Node.js 22 or newer. The check uses Gemini’s public endpoints and prefers contracts with a reported last trade. It passes when at least one sampled instrument has enough points to chart. Active contracts and available history vary between runs.

[Gemini Prediction Markets event search](https://developer.gemini.com/rest-api/prediction-markets/events/list-events) · [Sample event response](https://api.gemini.com/v1/prediction-markets/events/BTC2611302200)
