import { seriesColors } from './chart.js';
import { historyKey } from './history.js';
import { DEFAULT_RANGE } from './chart-ranges.js';

export const CACHE_PREFIX = 'headline-odds:lookup:';

export function articleKey(address) {
  const url = new URL(address);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Open a web article to see matching markets.');
  if (!/^#(?:!|\/)/.test(url.hash)) url.hash = '';
  for (const param of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(param) || ['fbclid', 'gclid'].includes(param)) url.searchParams.delete(param);
  }
  return CACHE_PREFIX + url.href;
}

export function marketIdentity(market) {
  return JSON.stringify([market.venue, market.group || market.source || market.title]);
}

export function savedMarket(market, at, points, period = DEFAULT_RANGE, selected = market.outcomes) {
  return {
    key:marketIdentity(market), title:market.title, at, period, venue:market.venue,
    source:market.source, terms:market.termsUrl, rules:market.rules,
    lines:selected.map((item, index) => ({
      label:item.label, color:item.color || seriesColors[index],
      price:item.quote ?? item.quotes?.last ?? item.quotes?.price,
      points:points?.[historyKey(market.venue,item)] || [],
    })),
  };
}

// Earlier clips recorded just a market key. Recover their chart from the same
// article lookup the popup already cached, without querying an exchange.
export async function recoverMarket(clips) {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;
  const keys = clips.filter(c => /^https?:\/\//.test(c.url)).map(c => articleKey(c.url));
  const entries = await storage.get([...new Set(keys)]);
  for (const entry of Object.values(entries).sort((a,b) => b.fetchedAt - a.fetchedAt)) {
    const market = entry.markets?.find(m => marketIdentity(m) === clips[0].market.key);
    if (market) return savedMarket(market,entry.fetchedAt,entry.histories);
  }
}
