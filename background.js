import { readArticle } from './article.js';
import { DEFAULT_RANGE, MAX_PLOTTED, RANGES } from './chart-ranges.js';
import { loadHistories } from './history.js';
import { marketCache } from './market-cache.js';
import { lookupFingerprint, lookupMarkets } from './lookup.js';
import { additionalOutcomes } from './outcomes.js';

const KEY = 'anthropicApiKey';
const CACHE_PREFIX = 'headline-odds:lookup:';
const CACHE_VERSION = 6;
const TTL_MS = 10 * 60 * 1000;
const LOOKUP_LIMIT = 40;
const lookups = new Map();
const charts = new Map();
const cache = marketCache(chrome.storage.local);
let prune = Promise.resolve();

function share(jobs, id, run) {
  if (!jobs.has(id)) {
    const job = run();
    jobs.set(id, job);
    // Keep sharing while the snapshot is being saved, without delaying the popup.
    void job.then(({ saved }) => saved).catch(() => {}).finally(() => jobs.delete(id));
  }
  return jobs.get(id);
}

function articleKey(address) {
  const url = new URL(address);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Open a web article to see matching markets.');
  if (!/^#(?:!|\/)/.test(url.hash)) url.hash = '';
  for (const param of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(param) || ['fbclid', 'gclid'].includes(param)) url.searchParams.delete(param);
  }
  return CACHE_PREFIX + url.href;
}

async function cacheEntry(id, entry) {
  try {
    await chrome.storage.local.set({ [id]: entry });
    prune = prune.then(async () => {
      const keys = (await chrome.storage.local.getKeys()).filter((key) => key.startsWith(CACHE_PREFIX));
      if (keys.length <= LOOKUP_LIMIT) return;
      const previous = await chrome.storage.local.get(keys);
      const oldest = keys.sort((a, b) => previous[b]?.fetchedAt - previous[a]?.fetchedAt).slice(LOOKUP_LIMIT);
      await chrome.storage.local.remove(oldest);
    }).catch(() => {});
  } catch {
    // A Chrome storage failure should still let the current lookup render.
  }
}

async function runLookup(id, tabId, previous, refresh) {
  const key = (await chrome.storage.local.get(KEY))[KEY];
  if (!key) throw new Error('Add a Claude API key to load markets.');
  let article;
  try {
    const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: readArticle });
    article = frame?.result;
  } catch {
    throw new Error('Chrome could not read this tab. Open a regular web article and try again.');
  }
  if (!article?.text) throw new Error('This page has too little readable article text.');
  if (articleKey(article.url) !== id) throw new Error('The page changed. Reopen the extension to try again.');
  const { url: _, ...content } = article;
  const today = new Date().toISOString().slice(0, 10);
  const fingerprint = await lookupFingerprint({ ...content, today });
  const sameArticle = previous?.version >= 5 && previous.fingerprint === fingerprint;
  const { analysis, ...result } = await lookupMarkets({
    article: content,
    key,
    today,
    cached: (query, load) => cache.search(query, load, refresh),
    analysis: sameArticle ? previous.analysis : null,
    review: sameArticle ? previous.review : null,
  });
  const entry = {
    ...result, version: CACHE_VERSION, analysis, fingerprint, fetchedAt: Date.now(), histories: null,
  };
  return { entry, saved: cacheEntry(id, entry) };
}

async function loadCharts(id, entry, refresh, entrySaved) {
  return share(charts, `${id}:${entry.fetchedAt}`, async () => {
    const histories = await loadHistories(entry.markets, { cache, refresh });
    const saved = entrySaved.then(async () => {
      const current = (await chrome.storage.local.get(id).catch(() => ({})))[id];
      if (current?.fetchedAt === entry.fetchedAt) {
        await cacheEntry(id, { ...entry, histories, historyCheckedAt: Date.now() });
      }
    });
    return { histories, saved };
  });
}

async function handleLookup({ tabId, url, refresh }, send) {
  if (!Number.isInteger(tabId) || !url) throw new Error('Open a web article to see matching markets.');
  const id = articleKey(url);
  const previous = (await chrome.storage.local.get(id).catch(() => ({})))[id];
  const now = Date.now();
  const ageLimit = previous?.partial ? 60000 : TTL_MS;
  const cached = !refresh && previous?.version === CACHE_VERSION && now - previous.fetchedAt < ageLimit
    && Array.isArray(previous.markets)
    && !previous.markets.some((market) => [...market.outcomes, ...additionalOutcomes(market)]
      .some(({ expiry }) => Date.parse(expiry) <= now));
  const { entry, saved } = cached ? { entry: previous, saved: Promise.resolve() }
    : await share(lookups, id, () => runLookup(id, tabId, previous, refresh));
  const { analysis, review, fingerprint, version, historyCheckedAt, ...publicEntry } = entry;
  send({ type: 'markets', entry: publicEntry });
  const retry = historyCheckedAt && now - historyCheckedAt > 60000
    && Object.values(entry.histories || {}).includes(null);
  if (entry.markets.length && (!entry.histories || retry)) {
    const chart = await loadCharts(id, entry, refresh, saved);
    send({ type: 'histories', period: DEFAULT_RANGE, histories: chart.histories });
    await chart.saved;
  } else {
    await saved;
  }
  send({ type: 'done' });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'headline-odds') return;
  let connected = true;
  port.onDisconnect.addListener(() => { connected = false; });
  const send = (message) => {
    if (connected) port.postMessage(message);
  };
  port.onMessage.addListener((message) => {
    if (message.type !== 'lookup') return;
    handleLookup(message, send).catch((error) => send({
      type: 'error',
      message: error.message || 'Could not load markets. Try again.',
    }));
  });
});

chrome.runtime.onMessage.addListener((message, sender, send) => {
  if (message.type !== 'chart' || sender.id !== chrome.runtime.id) return;
  const { venue, period, historyIds } = message;
  const validators = { Gemini: /^[\w-]{1,120}$/, Polymarket: /^\d{1,80}$/ };
  if (!Object.hasOwn(RANGES, period) || !Object.hasOwn(validators, venue)
    || !Array.isArray(historyIds) || historyIds.length > MAX_PLOTTED
    || !historyIds.every((id) => typeof id === 'string' && validators[venue].test(id))) return;
  const outcomes = historyIds.map((historyId) => ({ historyId }));
  loadHistories([{ venue, outcomes }], { cache, period }).then(send, () => send({}));
  return true;
});
