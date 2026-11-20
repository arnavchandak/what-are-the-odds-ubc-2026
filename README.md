# What Are the Odds?

What probability are traders putting on the outcome in this article? Open the Chrome extension on a news story to see a matching prediction market, its price history, and the terms that determine the outcome. Clip a passage or image to keep the article evidence alongside the market in your Info Library.

**[Watch the demo on YouTube](https://youtu.be/fDYKdH2Ya20)** · **[Try the extension](#run-the-extension)** · **[Verify both integrations without API keys](#verify-the-build)** · **[Explore the architecture](#architecture)**

## UBC 2026 judging guide

Built by Arnav Chandak and Keshav Ramamurthy, University of Illinois Urbana-Champaign.

| Entry | What to look for | Evidence |
| --- | --- | --- |
| **Consumer Applications** | The Chrome popup brings market odds into the article-reading workflow. On a Polymarket card, open **Context → Check on Polygon** to verify that the market condition exists on Polygon mainnet. | [Popup](popup.js) · [Onchain read](polygon.js) · [Deployed contract](https://polygonscan.com/address/0x4D97DCd97eC945f40cF65F87097ACe5EA0476045#readContract) |
| **Gemini Prediction Markets bounty** | On a Gemini card, switch between 24h, 7d, and 30d to explore price history. Open **Context** for the contract terms and source. | [Gemini API integration](gemini.js) · [Recorded live API results](docs/GEMINI_VERIFICATION.md) |

The project uses Polygon for the main track and seeks no separate chain award. [Organizer guide and technical requirements](https://docs.google.com/document/d/1QaySCo7u3VxMVNdk3C5Ab3ewc2E46AuLntti-Uzx5EY/edit)

## How the extension uses Gemini Prediction Markets

| Gemini endpoint | What the reader sees |
| --- | --- |
| [`GET /v1/prediction-markets/events`](https://developer.gemini.com/rest-api/prediction-markets/events/list-events) | The extension searches active events from the article, groups open contracts by event, and uses Gemini’s outcome labels and quotes to populate the market card. The event description and available terms link appear in **Context**. |
| [`GET /v2/candles/{symbol}/{interval}`](https://developer.gemini.com/trading/rest-api/market-data/list-candles) | The extension uses each Gemini instrument symbol to chart exchange prices over 24 hours, 7 days, or 30 days. Saved briefs retain a chart snapshot and link back to the Gemini source. |

Claude extracts open questions from the article and ranks candidate markets by event, timeframe, and settlement conditions. When results are equally relevant, the extension prefers Gemini. Polymarket provides coverage when it has a closer match or Gemini has none. The **Trade** ticket uses reference prices and simulated cash stored in Chrome.

See the [live Gemini verification results](docs/GEMINI_VERIFICATION.md) and the [Gemini integration code](gemini.js).

## How the extension uses Polygon

Open a Polymarket match and select **Context → Check on Polygon**. For grouped markets, pick the outcome you want to check. The extension reads `getOutcomeSlotCount(bytes32)` on the [Conditional Tokens contract](https://docs.polymarket.com/resources/contracts) through a Polygon mainnet `eth_call`, using the condition ID supplied by Polymarket. A positive count confirms that the condition is registered onchain. This check only needs a public condition ID and works without a wallet or gas.

## Run the extension

1. Clone this public repository or download it as a ZIP and unzip it. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
2. Open a news article about an unresolved event, such as an upcoming game or an economic decision. Open the extension and enter an Anthropic API key in **Settings**. Live article matching uses Claude API credits and requires a key that permits direct browser requests. Gemini market data uses public endpoints.
3. Open the popup to load matches. Select a chart range or outcome, then open **Context** to see why the contract matches and what would settle it.
4. Choose **Clip from page**, select passages or images, and open **Info Library** to review them alongside the market’s chart and source links. The **Trade** ticket in the popup or library lets you place simulated buys and sells.

## Architecture

1. [`article.js`](article.js) extracts the article headline, up to 5,000 characters of readable text, and the publication date when available.
2. The [Manifest V3 service worker](background.js) runs [article-to-market matching](lookup.js). Gemini and Polymarket searches run in parallel. The matcher reuses recent searches, checks displayed quotes against the article excerpt, and returns markets while history loads.
3. [`history.js`](history.js) normalizes exchange history for the Canvas chart and leaves missing observations blank. [IndexedDB](workspace.js) stores saved clips, market snapshots, and simulated positions.

Live matching sends the extracted article fields to Anthropic. Chrome stores the API key locally and sends it to Anthropic for authentication. Exchange requests use search terms and instrument identifiers. The Polygon check sends the public condition ID to dRPC. Manually saved clips stay in the Chrome profile.

## Verify the build

Use Node.js 22 or newer.

```sh
npm run check
npm test
npm run verify:gemini
```

The first two commands run locally. The Gemini check searches live Bitcoin events and fetches candles for a sample of active contracts. It uses Gemini’s public market-data endpoints and requires no API keys. Available markets and history vary over time.

To reproduce the Polygon check from the repository root, run the same function the extension calls. This public condition belongs to the Polymarket question “Xi Jinping out before 2027?” and returned **2** outcome slots in our mainnet check.

```sh
node --input-type=module -e 'import { readCondition } from "./polygon.js"; console.log(await readCondition("0xa467b14d51f01b957109d9cbb1d6c124fab2a089d52ed8f471d23c2812e743b7"));'
```
