# Gemini integration verification

**November 20, 2026 at 2:10 a.m. CST.** A read-only smoke check queried the live Gemini event API using Bitcoin and then retrieved seven-day history for one instrument per sampled event. The query returned five distinct usable groups, with complete search responses. Two of four sampled instruments returned chartable history. Two short-window instruments had unavailable history.

| Event ticker | Instrument | Normalized history points |
| --- | --- | ---: |
| `BTC2611202200` | `GEMI-BTC2611202200-HI60500` | 6 |
| `BTC2611302200` | `GEMI-BTC2611302200-HI57500` | 54 |
| `BTC15M2611200815` | `GEMI-BTC15M2611200815-UP` | Unavailable |
| `BTC2611200900` | `GEMI-BTC2611200900-HI61500` | Unavailable |

Reproduce with `npm run verify:gemini`. The active contracts and response counts change. The check uses Gemini’s public endpoints and makes no Claude or trading calls.

[Gemini Prediction Markets event search](https://developer.gemini.com/rest-api/prediction-markets/events/list-events) · [Sample event response](https://api.gemini.com/v1/prediction-markets/events/BTC2611302200)
