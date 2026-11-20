import { seriesColors } from './chart.js';
import { eventSource, geminiGroups } from './gemini.js';
import { polymarketGroups } from './polymarket.js';
import { historyKey, loadHistories } from './history.js';
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
      historyId:item.historyId, label:item.label, color:item.color || seriesColors[index],
      price:item.quote ?? item.quotes?.last ?? item.quotes?.price,
      points:points?.[historyKey(market.venue,item)] || [],
    })),
  };
}

export function hasChart(market) {
  return market?.lines?.some(line => line.points?.length >= 2);
}

async function exchangeMarket(key, request) {
  const [venue,id] = JSON.parse(key);
  if (typeof id !== 'string' || !id) return;
  const slug = id.split(':')[0];
  let url;
  if (venue === 'Polymarket') url = 'https://gamma-api.polymarket.com/events/slug/' + encodeURIComponent(slug);
  else if (venue === 'Gemini') url = eventSource(id);
  else return;
  const response = await request(url,{signal:AbortSignal.timeout(8000)});
  if (!response.ok) return;
  const body = await response.json();
  const data = body.data ?? body;
  const events = Array.isArray(data) ? data : [data];
  const groups = venue === 'Polymarket' ? polymarketGroups(events) : geminiGroups(events);
  const market = groups.find(m => marketIdentity(m) === key);
  if (market) {
    const price = item => item.quotes.last ?? item.quotes.price ?? 0;
    market.outcomes = market.outcomes.sort((a,b) => price(b) - price(a)).slice(0,5);
  }
  return market;
}

export async function recoverMarket(clips, storage = globalThis.chrome?.storage?.local, request = fetch) {
  if (!storage) return;
  const { key } = clips[0].market;
  const keys = await storage.getKeys();
  const entries = await storage.get(keys.filter(k => k.startsWith(CACHE_PREFIX)));
  let cached;
  for (const entry of Object.values(entries).sort((a,b) => b.fetchedAt - a.fetchedAt)) {
    const market = entry.markets?.find(m => marketIdentity(m) === key);
    if (!market) continue;
    const snapshot = savedMarket(market,entry.fetchedAt,entry.histories);
    if (hasChart(snapshot)) return snapshot;
    cached ??= market;
  }
  const previous = clips.find(c => c.market.lines?.some(line => line.historyId))?.market;
  const market = cached || (previous && {
    ...previous, group:JSON.parse(key)[1], termsUrl:previous.terms,
    outcomes:previous.lines.map(line => ({...line,quotes:{}})),
  }) || await exchangeMarket(key,request);
  if (!market) return;
  const period = previous?.period || DEFAULT_RANGE;
  const at = Date.now();
  const points = await loadHistories([market],{period,request,now:at});
  const snapshot = savedMarket(market,at,points,period);
  for (const line of snapshot.lines) line.price = line.points.at(-1)?.[1];
  return hasChart(snapshot) ? snapshot : undefined;
}
