# What Are the Odds?

A Chrome extension that finds Gemini prediction markets for the news you’re reading. See what traders expect, check what would settle the contract, and save the passages and images behind your own view.

## UBC 2026 Hackathon

**Builders** · Arnav Chandak and Keshav Ramamurthy, University of Illinois Urbana-Champaign

| Devpost field | Submission status |
| --- | --- |
| Main track | **Consumer Applications.** The extension provides a working consumer frontend. The track also requires blockchain interaction. The current build reads exchange APIs, so that requirement remains open. |
| Chain award | **None** |
| Sponsor bounty | **None for the current build.** The build meets the market-data API requirement for **Best Project built with Gemini Prediction Markets**. Entering that bounty also requires a qualifying main-track entry. |
| Other sponsor bounties | **None** |
| Smart contract or program addresses | **None** |

[Hackathon overview and prizes](https://ubc-hackathon-2026.devpost.com/) · [Organizer guide and technical requirements](https://docs.google.com/document/d/1QaySCo7u3VxMVNdk3C5Ab3ewc2E46AuLntti-Uzx5EY/edit)

## How the extension uses Gemini Prediction Markets

| Gemini endpoint | What the reader sees |
| --- | --- |
| [`GET /v1/prediction-markets/events`](https://developer.gemini.com/rest-api/prediction-markets/events/list-events) | The extension searches active events from the article, groups open contracts by event, and uses Gemini’s outcome labels and quotes to populate the market card. The event description and available terms link appear in **Context**. |
| [`GET /v2/candles/{symbol}/{interval}`](https://developer.gemini.com/trading/rest-api/market-data/list-candles) | The extension uses each Gemini instrument symbol to chart exchange prices over 24 hours, 7 days, or 30 days. Saved briefs retain a chart snapshot and link back to the Gemini source. |

Claude extracts open questions from the article and ranks candidate markets by event, timeframe, and settlement conditions. When results are equally relevant, the extension prefers Gemini. Polymarket provides coverage when it has a closer match or Gemini has none. The **Trade** ticket uses reference prices and simulated cash stored in Chrome.

See the [live Gemini verification results](docs/GEMINI_VERIFICATION.md) and the [Gemini integration code](gemini.js).

## Run the extension

1. Clone this public repository or download it as a ZIP and unzip it. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
2. Open a news article about an unresolved event, such as an upcoming game or an economic decision. Open the extension and enter an Anthropic API key in **Settings**. Live article matching uses Claude API credits and requires a key that permits direct browser requests. Gemini market data uses public endpoints.
3. Open the popup to load matches. Select a chart range or outcome, then open **Context** to see why the contract matches and what would settle it.
4. Choose **Clip from page**, select passages or images, and open **Info Library** to review them alongside the market’s chart and source links. The **Trade** ticket in the popup or library lets you place simulated buys and sells.

## Architecture

1. [`article.js`](article.js) extracts the article headline, up to 5,000 characters of readable text, and the publication date when available.
2. The [Manifest V3 service worker](background.js) runs [article-to-market matching](lookup.js). Gemini and Polymarket searches run in parallel. The matcher reuses recent searches, checks displayed quotes against the article excerpt, and returns markets while history loads.
3. [`history.js`](history.js) normalizes exchange history for the Canvas chart and leaves missing observations blank. [IndexedDB](workspace.js) stores saved clips, market snapshots, and simulated positions.

Live matching sends the extracted article fields to Anthropic. Chrome stores the API key locally and sends it to Anthropic for authentication. Exchange requests use search terms and instrument identifiers. Manually saved clips stay in the Chrome profile.

## Verify the build

Use Node.js 22 or newer.

```sh
npm run check
npm test
npm run verify:gemini
```

The Gemini check searches live Bitcoin events and fetches candles for a sample of active contracts. It uses Gemini’s public market-data endpoints and requires no API keys. Available markets and history vary over time.
