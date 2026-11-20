# What Are the Odds

**UBC 2026 Hackathon · Prediction market context for the news**

What Are the Odds is a Chrome extension that finds prediction markets related to the article you are reading. It brings Gemini odds, price history, and settlement criteria into the same reading flow. Save passages and images to a market brief in the Info Library, or try positions with simulated cash.

## Run the extension

1. Clone or download this repository. In Chrome, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the repository folder.
2. Open a news article, click the extension icon, and enter an Anthropic API key in **Settings**. The key needs Claude API access and permission for direct browser requests. Live matching uses Anthropic API credits.
3. Open the popup to see matching markets. Switch chart ranges or outcomes, open **Context** for the article connection and settlement rules, or use **Clip from page** to save evidence. Keep selecting passages or clicking images in the same session, then choose **Done** or **Open Info Library**.
4. Choose **Trade**, select a side and dollar amount, and place a simulated buy or sell. The ticket shows cash, the open position, and the last completed order for that market.

## Gemini Prediction Markets

- **Discovery.** The Gemini event API supplies event titles, contract labels and symbols, quotes, and available terms links. Gemini wins when both venues have matches at the same relevance level. Additional coverage comes from Polymarket when its matches are closer or Gemini has none.
- **Price history.** Instrument symbols drive 24-hour, seven-day, and 30-day candle requests. Charts show exchange observations, with venue attribution in the Info Library’s Sources.
- **Simulated positions.** The ticket uses reference prices and a local cash balance. All fills are simulated in the browser.

[Gemini event API](https://developer.gemini.com/rest-api/prediction-markets/events/list-events) · [Gemini candles API](https://developer.gemini.com/trading/rest-api/market-data/list-candles) · [Gemini verification notes](docs/GEMINI_VERIFICATION.md)

## Architecture

1. `article.js` reads a bounded excerpt from the active tab. The Manifest V3 service worker orchestrates lookup, market requests, and caching.
2. `lookup.js` uses Claude to extract unresolved questions and rank candidates by event, conditions, and timeframe. An exact article quote is checked against the input before display.
3. `history.js` normalizes exchange history. The popup renders charts in Canvas and pairs article context with provider settlement terms.
4. IndexedDB stores evidence, chart snapshots, and simulated positions in the Chrome profile. Older clips can recover a chart from the local cache or public venue history.

Live lookup sends the article headline, up to 5,000 characters of readable text, and its publication date when available to Anthropic. The key stays in the Chrome profile and is sent to Anthropic for authentication. Market lookups send search terms and instrument identifiers to exchanges. Manually saved clips stay in the local library.

With Node.js 22 or newer, run `npm run check` and `npm test`. `npm run verify:gemini` checks live Gemini discovery and history using public endpoints.

[UBC 2026 submission notes](docs/SUBMISSION.md)
