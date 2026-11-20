const EVENTS_URL = 'https://api.gemini.com/v1/prediction-markets/events';
const CANDLES_URL = 'https://api.gemini.com/v2/candles';
const SEARCH_LIMIT = 100;
const MAX_PAGES = 2;
const ALIASES = [
  ['Bitcoin', 'BTC'],
  ['Ethereum', 'ETH'],
  ['Solana', 'SOL'],
  ['Dogecoin', 'DOGE'],
  ['Nvidia', 'NVDA'],
  ['Federal Reserve', 'Fed', 'FOMC'],
  ['Super Bowl', 'Big Game'],
];
const edges = (term) => new RegExp(`\\b${term}\\b`, 'i');

export function searchQueries(terms) {
  const queries = new Map();
  function add(value) {
    const term = value.trim().replace(/\s+/g, ' ').slice(0, 70);
    if (term.length >= 2 && !queries.has(term.toLowerCase())) queries.set(term.toLowerCase(), term);
  }
  const seeds = terms.filter((term) => typeof term === 'string').slice(0, 4);
  for (const term of seeds) add(term);
  // Keep short aliases as separate queries, even when Claude supplied a longer phrase.
  for (const group of ALIASES) {
    if (seeds.some((term) => group.some((alias) => edges(alias).test(term)))) {
      for (const alias of group) add(alias);
    }
  }
  return [...queries.values()].slice(0, 9);
}

export function eventSource(ticker) {
  return `${EVENTS_URL}/${encodeURIComponent(ticker)}`;
}

async function listEvents(term, request) {
  const events = [];
  for (let page = 0; page < MAX_PAGES && events.length < SEARCH_LIMIT; page++) {
    const url = new URL(EVENTS_URL);
    const limit = SEARCH_LIMIT - events.length;
    url.search = new URLSearchParams({ status: 'active', search: term, limit, offset: events.length });
    const response = await request(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Gemini search returned HTTP ${response.status}.`);
    const { data, pagination } = await response.json();
    if (!Array.isArray(data)) throw new Error('Gemini returned an unexpected search response.');
    events.push(...data);
    const total = pagination?.total;
    if (!data.length || (Number.isFinite(total) ? events.length >= total : data.length < limit)) break;
  }
  return events;
}

export async function findEvents(terms, request = fetch, cached = (_, load) => load()) {
  const queries = searchQueries(terms);
  const responses = await Promise.allSettled(queries.map((term) => cached(
    `Gemini:3:${term.toLowerCase()}`, async () => geminiGroups(await listEvents(term, request)),
  )));
  const successes = responses.filter((result) => result.status === 'fulfilled');
  if (queries.length && !successes.length) {
    throw new Error('Gemini market search is unavailable. Try again in a moment.');
  }
  return { groups: successes.flatMap((result) => result.value), partial: successes.length !== queries.length };
}

export function priceNumber(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 1 ? price : null;
}

export function contractQuotes(contract) {
  return {
    bid: priceNumber(contract.prices?.bestBid),
    ask: priceNumber(contract.prices?.bestAsk),
    last: priceNumber(contract.prices?.lastTradePrice),
  };
}

export async function geminiHistory(symbol, request, { gemini }) {
  const response = await request(`${CANDLES_URL}/${encodeURIComponent(symbol)}/${gemini}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Gemini history returned HTTP ${response.status}.`);
  const candles = await response.json();
  if (!Array.isArray(candles)) throw new Error('Invalid Gemini chart data.');
  return candles.map((candle) => [candle?.[0], candle?.[4]]);
}

export function unexpired(expiry, now) {
  return !(Date.parse(expiry) <= now);
}

export function marketText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function shortText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function geminiGroups(events, now = Date.now()) {
  const groups = [];
  for (const root of events) {
    if (!root || (root.status && root.status !== 'active')) continue;
    const children = Array.isArray(root.events) ? root.events : [];
    for (const event of [root, ...children]) {
      if (!event?.ticker || !event.title || (event.status && event.status !== 'active')) continue;
      const outcomes = (Array.isArray(event.contracts) ? event.contracts : []).flatMap((contract) => {
        const expiry = contract?.expiryDate || event.expiryDate || null;
        if (!contract?.instrumentSymbol || (contract.status && contract.status !== 'active')
          || (contract.marketState && contract.marketState !== 'open') || !unexpired(expiry, now)) return [];
        const quotes = contractQuotes(contract);
        if (Object.values(quotes).every((value) => value === null)) return [];
        return [{
          label: shortText(contract.label || contract.abbreviatedName, 150) || 'Yes',
          historyId: contract.instrumentSymbol,
          quotes,
          expiry,
        }];
      });
      if (!outcomes.length) continue;
      const { type, subject, scope, metric } = event.sportsMarket || {};
      groups.push({
        venue: 'Gemini',
        group: event.ticker,
        title: root === event || root.title === event.title ? event.title : `${root.title} · ${event.title}`,
        context: [type, subject, scope?.type, metric, shortText(event.description, 160)].filter(Boolean).join(' '),
        rules: marketText(event.description),
        termsUrl: event.termsLink || (outcomes.length === 1 ? event.contracts.find(
          (contract) => contract?.instrumentSymbol === outcomes[0].historyId,
        )?.termsAndConditionsUrl : null),
        eventDate: event.startTime || event.effectiveDate || root.startTime || null,
        source: eventSource(event.ticker),
        outcomes,
      });
    }
  }
  return groups;
}
