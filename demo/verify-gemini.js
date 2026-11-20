import { eventSource, findEvents } from '../gemini.js';
import { loadHistories } from '../history.js';

const start = Date.now();
const { groups, partial } = await findEvents(['Bitcoin']);
const unique = new Map(groups.filter(({ outcomes }) => outcomes[0]?.historyId)
  .map((market) => [market.group, market]));
const markets = [...unique.values()].slice(0, 4).map((market) => ({ ...market, outcomes: market.outcomes.slice(0, 1) }));
const histories = await loadHistories(markets);
const samples = markets.map(({ group, title, outcomes: [outcome] }) => ({
  ticker: group,
  title,
  eventSource: eventSource(group),
  instrument: outcome.historyId,
  points: histories['Gemini:' + outcome.historyId]?.length ?? null,
}));
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), query: 'Bitcoin', activeEvents: unique.size,
  partial, elapsedMs: Date.now() - start, samples,
}, null, 2));
if (!samples.some(({ points }) => points >= 2)) process.exitCode = 1;
