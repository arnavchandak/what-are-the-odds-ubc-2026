# UBC 2026 submission notes

**What Are the Odds** brings Gemini Prediction Markets into the article you are reading. See the README for the unpacked Chrome setup, data flow, and Gemini integration.

## Devpost checklist

The published deadline is **Friday, November 20, 2026 at noon CST**. The rules cover builds made during the event, teams of one to four, and in-person finals attendance for prize eligibility. [Devpost overview](https://ubc-hackathon-2026.devpost.com/) · [Official rules](https://ubc-hackathon-2026.devpost.com/rules) · [Organizer guide](https://docs.google.com/document/d/1QaySCo7u3VxMVNdk3C5Ab3ewc2E46AuLntti-Uzx5EY/edit)

| Required | Status |
| --- | --- |
| Project name, short description, and complete team roster | Draft below. Confirm the roster in Devpost. |
| Written responses and technologies used | Draft below. |
| Public repository with source and setup | Source and instructions are ready. Repository visibility is private. |
| Working demo or deployed app | Run the unpacked Chrome extension using the README. |
| Judge-accessible 2–3 minute video | Add a YouTube or Google Drive link showing the current extension in action. |
| Technical documentation | README includes setup, architecture, data handling, and the Gemini integration. |
| Exactly one main track and its technical requirements | Consumer Applications is the closest fit. It requires blockchain interaction. This build uses exchange HTTP APIs and does not yet meet that requirement. |
| Chain award and optional bounties | Chain award selection would be None. Gemini market data meets the API criterion. The bounty also requires a qualifying main-track entry. |

## Devpost draft

**Project name**

What Are the Odds

**Short description**

Gemini prediction market odds in the article you are reading, with price history, settlement rules, and a library for the evidence you collect.

**What did you build?**

A Chrome extension that finds prediction markets tied to a news article. Readers can see how odds changed, check what settles each market, and save excerpts or images to a market brief. They can also try simulated positions.

**What problem does it solve?**

A story can raise a question that a prediction market tracks, but finding the right contract takes time. Similar-looking markets can have different deadlines or settlement conditions. The extension shows the quoted event and its rules alongside the article.

**How does it work?**

Claude extracts unresolved questions from an article excerpt and evaluates candidate markets by event, participants, and timeframe. The Gemini event API supplies contract metadata, quotes, and available terms. Gemini candles provide price history for the matching instruments. The browser stores clips and simulated positions locally.

**What makes it unique?**

The article is the starting point. Readers can check what the article reports against a contract’s terms, then build a sourced brief around the same market. This keeps the evidence, the odds, and the resolution criteria in one place.

**What would you build next?**

Add onchain provenance for supported markets and evaluate matching against a set of articles with independently verified outcomes and contract matches.

**Technologies and sponsor tools**

Gemini Prediction Markets event and candle endpoints, Chrome Manifest V3, Claude Messages API, JavaScript, Canvas, IndexedDB, and Node.js.

**Team**

Arnav Chandak. Confirm the full roster before submission.
