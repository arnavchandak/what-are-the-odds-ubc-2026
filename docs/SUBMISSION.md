# UBC 2026 submission handoff

The submission deadline is **Friday, November 20 at noon CST**. Finals are in person on **Saturday, November 21**. The organizer requires eligible work built within the hackathon window, a team of one to four, one main track, and in-person finals attendance for prizes. The builder should confirm team details, participation, authorship, and any AI assistance before submitting. [Devpost overview](https://ubc-hackathon-2026.devpost.com/) · [Devpost rules](https://ubc-hackathon-2026.devpost.com/rules) · [Official guide](https://docs.google.com/document/d/1QaySCo7u3VxMVNdk3C5Ab3ewc2E46AuLntti-Uzx5EY/edit)

## Track and bounty

| Selection | Readiness |
| --- | --- |
| Main track | **Consumer Applications** is the closest product fit. The guide requires interaction with a blockchain. The current extension reads exchange HTTP APIs and has no direct blockchain interaction. Resolve this before claiming the track. |
| Chain award | **None** for this build. |
| Gemini Prediction Markets bounty | The extension uses Gemini market-data endpoints, with live search and history checked. The guide also requires a qualifying main-track submission. |
| Other bounties | No qualifying integrations in this build. |

## Submission materials

| Required material | Status |
| --- | --- |
| Project name and summary | Drafted below. |
| Complete team roster and track selection | Confirm in Devpost after addressing the track gap. |
| Public GitHub source and setup | Separate repository prepared with private visibility at the builder’s request. Devpost requires a public repo. |
| Working demo or deployed app | Chrome unpacked extension with live setup documented in the README. A separate key-free local judge preview uses sample data. |
| 2–3 minute video | See the demo walkthrough. The final submission needs a judge-accessible YouTube or Google Drive link. |
| Technical documentation and technologies | README covers architecture, setup, sponsor integration, and data handling. |
| Track-specific evidence | Direct blockchain interaction remains open. |
| In-person finals and event build window | Builder to confirm on submission. |

## Devpost draft

**Project name**

Headline Odds

**Short description**

Prediction market context for the article you are reading, with price history, the latest odds and the complete available settlement rules.

**What did you build?**

Headline Odds is a Chrome extension that surfaces prediction markets relevant to a news article. Each card brings the matching market, history, latest quotes and its settlement context into the popup.

**What problem does it solve?**

Readers have to switch tabs and search across exchanges to see whether there is a market for a story. Even a market with a similar title can answer a different question. Headline Odds brings the quoted event and its settlement rules into the reading flow.

**How does it work?**

With access to the active tab, the extension reads a bounded article excerpt. Claude extracts open questions and reviews candidate markets from Gemini and Polymarket against the article. The popup shows the matched outcomes and exchange price histories over 24 hours, seven days or 30 days.

**What makes it unique?**

The article is the starting point. Matching accounts for the event, actors and timeframe. Readers can then see why the market matches and read the settlement text before drawing conclusions from its odds.

**What would you build next?**

Add onchain provenance for supported markets and evaluate matching quality and latency on an article set with verified matches.

**Technologies and sponsor tools**

Chrome Manifest V3, JavaScript modules, HTML, CSS, Canvas, Claude Messages API, Gemini Prediction Markets event and candle endpoints, Polymarket event and price-history endpoints, and Node.js tests.

**Team**

Arnav Chandak. Confirm the complete roster in Devpost.
