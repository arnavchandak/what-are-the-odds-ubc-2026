import { geminiHistory, priceNumber } from './gemini.js';
import { polymarketBatchHistory, polymarketHistory } from './polymarket.js';
import { DEFAULT_RANGE, RANGES } from './chart-ranges.js';

function normalize(rows, now, range) {
  const prices = new Map();
  for (const [time, value] of rows) {
    if (!Number.isFinite(time) || time < now - range.duration || time > now + 60000) continue;
    const price = priceNumber(value);
    if (price !== null) prices.set(time, price);
  }
  const points = [...prices].sort(([first], [second]) => first - second);
  const step = Math.ceil(points.length / 175);
  return points.filter((_, index) => index === points.length - 1 || index % step === 0);
}

export async function priceHistory(market, request = fetch, now = Date.now(), range = RANGES[DEFAULT_RANGE]) {
  if (!market.historyId) return [];
  const load = market.venue === 'Gemini' ? geminiHistory : polymarketHistory;
  return normalize(await load(market.historyId, request, range), now, range);
}

export function historyKey(venue, outcome) {
  return outcome.historyId ? `${venue}:${outcome.historyId}` : null;
}

export async function loadHistories(markets, { cache, refresh, request = fetch, now = Date.now(), period = DEFAULT_RANGE } = {}) {
  if (!Object.hasOwn(RANGES, period)) throw new Error('Unsupported chart range.');
  const range = RANGES[period];
  const all = new Map(markets.flatMap(({ venue, outcomes }) => outcomes.flatMap((outcome) => {
    const key = historyKey(venue, outcome);
    return key ? [[key, { venue, historyId: outcome.historyId }]] : [];
  })));
  const stored = cache && !refresh
    ? await cache.read('history', [...all.keys()].map((key) => `${period}:${key}`))
    : new Map();
  const histories = new Map([...stored].map(([key, points]) => [key.slice(period.length + 1), points]));
  const missing = [...all].filter(([key]) => !histories.has(key));
  const poly = missing.filter(([, market]) => market.venue === 'Polymarket');
  const gemini = missing.filter(([, market]) => market.venue === 'Gemini');
  const single = async ([key, market]) => [key, await priceHistory(market, request, now, range).catch(() => null)];
  const [geminiData, polyData] = await Promise.all([
    Promise.all(gemini.map(single)),
    (async () => {
      const batch = poly.length > 1
        ? await polymarketBatchHistory(poly.map(([, market]) => market.historyId), request, range).catch(() => new Map())
        : new Map();
      return Promise.all(poly.map(([key, market]) => batch.has(market.historyId)
        ? [key, normalize(batch.get(market.historyId), now, range)]
        : single([key, market])));
    })(),
  ]);
  const fresh = [...geminiData, ...polyData];
  if (cache) await cache.write('history', fresh.flatMap(([key, points]) =>
    points === null ? [] : [[`${period}:${key}`, points]]));

  return Object.fromEntries([...histories, ...fresh]);
}
