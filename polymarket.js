import { marketText, priceNumber, shortText, unexpired } from './gemini.js';

const SEARCH_URL = 'https://gamma-api.polymarket.com/public-search';
const HISTORY_URL = 'https://clob.polymarket.com/prices-history';

async function search(term, request) {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({
    q: term, events_status: 'active', limit_per_type: '16', search_tags: 'false', search_profiles: 'false',
  });
  const response = await request(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Polymarket search returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body.events == null && body.pagination?.totalResults === 0) return [];
  if (!Array.isArray(body.events)) throw new Error('Invalid Polymarket search results.');
  return body.events;
}

export async function findPolymarket(queries, request = fetch, cached = (_, load) => load()) {
  const responses = await Promise.allSettled(queries.slice(0, 8).map((term) => cached(
    `Polymarket:3:${term.toLowerCase()}`, async () => polymarketGroups(await search(term, request)),
  )));
  const successes = responses.filter((result) => result.status === 'fulfilled');
  if (responses.length && !successes.length) throw new Error('Polymarket search is unavailable.');
  return { groups: successes.flatMap((result) => result.value), partial: responses.length !== successes.length };
}

export async function polymarketHistory(asset, request, range) {
  const url = new URL(HISTORY_URL);
  url.search = new URLSearchParams({
    market: asset, interval: range.polymarket, fidelity: range.minutes,
  });
  const response = await request(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Polymarket history returned HTTP ${response.status}.`);
  const { history } = await response.json();
  if (!Array.isArray(history)) throw new Error('Invalid Polymarket chart data.');
  return history.map(({ t, p }) => [t * 1000, p]);
}

function decodeArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isYesNo(labels) {
  return labels.length === 2 && labels.some((label) => /^yes$/i.test(label))
    && labels.some((label) => /^no$/i.test(label));
}

function comparableCandidates(event, markets) {
  if (markets.length < 2 || !/\b(?:who|which (?:candidates|teams|players|countries))\b/i.test(event.title)) return false;
  const labels = new Set();
  const conditions = new Set();
  for (const market of markets) {
    const label = shortText(market.groupItemTitle, 150).toLowerCase();
    const question = market.question.trim().toLowerCase();
    const prefix = `will ${label} `;
    if (!label || labels.has(label) || !question.startsWith(prefix)
      || !isYesNo(decodeArray(market.outcomes))) return false;
    labels.add(label);
    conditions.add(JSON.stringify([question.slice(prefix.length), market.endDate || event.endDate]));
  }
  return conditions.size === 1;
}

export function polymarketGroups(events, now = Date.now()) {
  const groups = [];
  for (const event of events) {
    if (!event?.slug || event.closed || !Array.isArray(event.markets)) continue;
    const active = event.markets.filter((market) => market?.active && !market.closed
      && market.acceptingOrders !== false && market.question && unexpired(market.endDate, now));
    const singleWinner = event.negRisk === true || (event.negRisk == null
      && active.length > 0 && active.every((market) => market.negRisk === true));
    const shareEvent = Boolean(event.title) && (singleWinner || comparableCandidates(event, active));
    const byGroup = new Map();
    for (const market of active) {
      const marketId = market.conditionId || market.id;
      if (!marketId) continue;
      const labels = decodeArray(market.outcomes);
      const assets = decodeArray(market.clobTokenIds);
      const prices = decodeArray(market.outcomePrices);
      const yesNo = isYesNo(labels);
      const combine = shareEvent && yesNo;
      const id = combine ? event.slug : `${event.slug}:${marketId}`;
      const group = byGroup.get(id) || {
        venue: 'Polymarket',
        group: id,
        title: combine ? event.title : market.question,
        context: shortText(combine ? event.description : market.description, 160),
        rules: marketText(combine ? event.description : market.description),
        resolutionSource: marketText((combine ? event.resolutionSource : market.resolutionSource) || event.resolutionSource),
        eventDate: market.gameStartTime || event.startTime || null,
        source: `https://polymarket.com/event/${encodeURIComponent(event.slug)}`,
        outcomes: [],
      };
      for (const [index, label] of labels.entries()) {
        if (typeof label !== 'string' || (yesNo && /^no$/i.test(label))) continue;
        const quotes = {
          bid: index === 0 ? priceNumber(market.bestBid) : null,
          ask: index === 0 ? priceNumber(market.bestAsk) : null,
          last: index === 0 ? priceNumber(market.lastTradePrice) : null,
          price: priceNumber(prices[index]),
        };
        if (Object.values(quotes).every((value) => value === null)) continue;
        const asset = assets[index];
        group.outcomes.push({
          label: combine ? shortText(market.groupItemTitle || market.question, 150) : label,
          historyId: typeof asset === 'string' && /^\d+$/.test(asset) ? asset : null,
          quotes,
          expiry: market.endDate || event.endDate || null,
        });
      }
      if (group.outcomes.length) byGroup.set(id, group);
    }
    groups.push(...byGroup.values());
  }
  return groups;
}

export async function polymarketBatchHistory(assets, request, range) {
  const response = await request('https://clob.polymarket.com/batch-prices-history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      markets: assets, interval: range.polymarket, fidelity: range.minutes,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Polymarket history returned HTTP ${response.status}.`);
  const { history } = await response.json();
  if (!history || typeof history !== 'object' || Array.isArray(history)) {
    throw new Error('Invalid Polymarket chart data.');
  }
  return new Map(assets.flatMap((asset) => Array.isArray(history[asset])
    ? [[asset, history[asset].map((point) => [point?.t * 1000, point?.p])]]
    : []));
}
