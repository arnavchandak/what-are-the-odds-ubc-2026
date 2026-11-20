import test from 'node:test';
import assert from 'node:assert/strict';
import { findEvents, geminiGroups, searchQueries } from './gemini.js';
import { lookupMarkets } from './lookup.js';
import { findPolymarket, polymarketGroups } from './polymarket.js';
import { marketCache } from './market-cache.js';
import { loadHistories, priceHistory } from './history.js';

test('retrieves both Bitcoin spellings and follows Gemini pagination', async () => {
  const calls = [];
  const { groups, partial } = await findEvents(['Bitcoin', 'bitcoin'], async (url) => {
    const query = url.searchParams.get('search');
    const offset = url.searchParams.get('offset');
    calls.push([query, offset]);
    const ticker = query === 'Bitcoin' || offset === '0' ? 'BTC-A' : 'BTC-B';
    return Response.json({ data: [{ ...exchangeEvent, ticker }], pagination: { total: query === 'BTC' ? 2 : 1 } });
  });
  assert.deepEqual(calls, [['Bitcoin', '0'], ['BTC', '0'], ['BTC', '1']]);
  assert.deepEqual(groups.map((event) => event.group), ['BTC-A', 'BTC-A', 'BTC-B']);
  assert.equal(partial, false);
  assert.deepEqual(searchQueries(['Federal Reserve decision']), ['Federal Reserve decision', 'Federal Reserve', 'Fed', 'FOMC']);
});

const target = { questions: ['Will Bitcoin finish the year above $100,000?'], terms: ['Bitcoin'] };
const article = { title: 'Can Bitcoin reach $100,000 at year-end?', text: 'An article discussing Bitcoin prices.' };
const exchangeEvent = {
  ticker: 'BTCYEAR',
  title: 'Bitcoin above $100,000 at year-end?',
  status: 'active',
  contracts: [{
    label: 'Above $100,000', marketState: 'open', status: 'active', instrumentSymbol: 'GEMI-BTCYEAR-HI',
    prices: { bestBid: '0', bestAsk: '0.47', lastTradePrice: null },
  }],
};

const polyEvent = {
  slug: 'year-end-bitcoin',
  markets: [{
    id: 'p1', active: true, closed: false, question: 'Will Bitcoin hit $100,000 by year-end?',
    outcomes: '["Yes","No"]', clobTokenIds: '["123","456"]', outcomePrices: '["0.45","0.55"]',
    bestBid: 0.44, bestAsk: 0.46, lastTradePrice: 0.46,
  }],
};

function providers(matches, { onRequest = () => {} } = {}) {
  let first = true;
  return async (url, options) => {
    onRequest(url);
    if (url.host === 'api.gemini.com') {
      assert.equal(options.headers, undefined);
      return Response.json({ data: [exchangeEvent], pagination: { total: 1 } });
    }
    if (url.host === 'gamma-api.polymarket.com') {
      assert.equal(options.headers, undefined);
      return Response.json({ events: [polyEvent] });
    }
    const payload = JSON.parse(options.body);
    assert.equal(options.headers['x-api-key'], 'fake-key');
    const input = JSON.parse(payload.messages[0].content);
    const output = first ? target : { matches: matches.map((match) => ({ relevance: 'primary', ...match })) };
    if (first) assert.deepEqual(input, article);
    else assert.deepEqual(
      input.candidates.map(({ id, venue }) => [id, venue]), [[1, 'Gemini'], [2, 'Polymarket']],
    );
    first = false;
    return Response.json({ content: [{ type: 'tool_use', name: 'record_result', input: output }] });
  };
}

test('prefers qualifying Gemini markets and ignores unknown or duplicate match IDs', async () => {
  const request = providers([{ id: 0 }, { id: 34 }, { id: 2 }, { id: 1, price: 0.99 }, { id: 1 }]);
  const { markets } = await lookupMarkets({ article, key: 'fake-key', request });
  assert.equal(markets.length, 1);
  assert.equal(markets[0].group, 'BTCYEAR');
  assert.deepEqual(markets[0].outcomes[0].quotes, { bid: 0, ask: 0.47, last: null });
});

test('falls back to the Polymarket outcome token when Gemini has no close match', async () => {
  const { markets } = await lookupMarkets({ article, key: 'fake-key', request: providers([{ id: 2 }]) });
  assert.equal(markets.length, 1);
  assert.equal(markets[0].venue, 'Polymarket');
  assert.equal(markets[0].outcomes[0].historyId, '123');
  assert.equal(markets[0].source, 'https://polymarket.com/event/year-end-bitcoin');
  assert.deepEqual(markets[0].outcomes[0].quotes, { bid: 0.44, ask: 0.46, last: 0.46, price: 0.45 });
});

test('normalizes both exchanges’ real chart formats without substituting prices', async () => {
  const now = 1800000000000;
  const t = now - 60000;
  const gemini = await priceHistory({ venue: 'Gemini', historyId: 'GEMI-TEST' }, async (url) => {
    assert.match(url, /\/GEMI-TEST\/1hr$/);
    return Response.json([[now, 0.7, 0.8, 0.6, 0.78], [t, 0.6, 0.7, 0.5, 0.65]]);
  }, now);
  const poly = await priceHistory({ venue: 'Polymarket', historyId: '123' }, async (url) => {
    assert.equal(url.searchParams.get('market'), '123');
    return Response.json({ history: [{ t: t / 1000, p: 0.22 }, { t: now / 1000, p: 0.3 }] });
  }, now);
  assert.deepEqual(gemini, [[t, 0.65], [now, 0.78]]);
  assert.deepEqual(poly, [[t, 0.22], [now, 0.3]]);
});

test('keeps an empty match list and surfaces partial search failures', async () => {
  const { markets } = await lookupMarkets({ article, key: 'fake-key', request: providers([]) });
  assert.deepEqual(markets, []);
  const partial = await findEvents(['Bitcoin'], async (url) => {
    return url.searchParams.get('search') === 'BTC'
      ? Response.json({ data: [] })
      : new Response(null, { status: 429 });
  });
  assert.deepEqual(partial, { groups: [], partial: true });
});

test('presents several Gemini contracts in one event even when multiple search terms return it', async () => {
  const election = {
    ticker: 'PRES2028',
    title: 'Presidential Election Winner 2028?',
    type: 'categorical',
    contracts: ['Jon Ossoff', 'Marco Rubio', 'Other'].map((label, index) => ({
      instrumentSymbol: `GEMI-PRES2028-${index}`, label, prices: { lastTradePrice: [0.17, 0.15, 0.08][index] },
    })),
  };
  const { markets } = await lookupMarkets({
    article: { title: 'Marco Rubio and the 2028 presidential election', text: 'The race remains open.' },
    key: 'fake-key',
    analysis: { questions: ['Will Marco Rubio win the 2028 presidential election?'], terms: ['US President', '2028'] },
    request: async (url, options) => {
      if (url.host === 'api.gemini.com') return Response.json({ data: [election] });
      if (url.host === 'gamma-api.polymarket.com') return Response.json({ events: [] });
      const { candidates } = JSON.parse(JSON.parse(options.body).messages[0].content);
      assert.equal(candidates.length, 1);
      assert.deepEqual(candidates[0].outcomes, ['Marco Rubio', 'Jon Ossoff', 'Other']);
      return Response.json({ content: [{ type: 'tool_use', name: 'record_result', input: {
        matches: [{ id: candidates[0].id, relevance: 'primary' }],
      } }] });
    },
  });
  assert.equal(markets.length, 1);
  assert.equal(markets[0].group, 'PRES2028');
  assert.deepEqual(markets[0].outcomes.map(({ historyId }) => historyId),
    ['GEMI-PRES2028-1', 'GEMI-PRES2028-0', 'GEMI-PRES2028-2']);
});

test('shows primary Polymarket matches when Gemini only answers a secondary question', async () => {
  const { markets } = await lookupMarkets({
    article, key: 'fake-key',
    request: providers([{ id: 1, relevance: 'secondary' }, { id: 2, relevance: 'primary' }]),
  });
  assert.equal(markets[0].venue, 'Polymarket');
});

test('combines single-winner Polymarket outcomes and keeps overlapping thresholds separate', async () => {
  const yesNo = (id, label) => ({ ...polyEvent.markets[0], id, groupItemTitle: label, clobTokenIds: [id, '99'] });
  const response = await findPolymarket(['winner'], async () => Response.json({ events: [
    { slug: 'winner', title: 'Election winner', negRisk: true, markets: [yesNo('1', 'Candidate A'), yesNo('2', 'Candidate B')] },
    { slug: 'thresholds', title: 'Bitcoin thresholds', negRisk: false, markets: [yesNo('3', '$90,000'), yesNo('4', '$100,000')] },
  ] }));
  assert.deepEqual(response.groups.map(({ group, outcomes }) => [group, outcomes.map(({ label }) => label)]), [
    ['winner', ['Candidate A', 'Candidate B']], ['thresholds:3', ['Yes']], ['thresholds:4', ['Yes']],
  ]);
});

test('batches Polymarket series, retries a missing series and reuses history across articles', async () => {
  const now = 1800000000000;
  const point = { t: now / 1000, p: 0.24 };
  const markets = [{ venue: 'Polymarket', outcomes: [{ historyId: '11' }, { historyId: '22' }] }];
  const cache = testCache();
  const calls = [];
  const request = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/batch-prices-history') {
      assert.deepEqual(JSON.parse(options.body).markets, ['11', '22']);
      return Response.json({ history: { 11: [point] } });
    }
    assert.equal(new URL(url).searchParams.get('market'), '22');
    return Response.json({ history: [point] });
  };
  const expected = { 'Polymarket:11': [[now, 0.24]], 'Polymarket:22': [[now, 0.24]] };
  assert.deepEqual(await loadHistories(markets, { cache, request, now }), expected);
  assert.deepEqual(await loadHistories(markets, { cache, request, now }), expected);
  assert.deepEqual(calls, ['/batch-prices-history', '/prices-history']);
});

function testCache() {
  const records = {};
  return marketCache({
    get: async (keys) => Object.fromEntries(keys.map((key) => [key, records[key]])),
    set: async (values) => Object.assign(records, values),
    getKeys: async () => Object.keys(records),
    remove: async (keys) => keys.forEach((key) => delete records[key]),
  });
}

test('shares a search in flight, reuses it and bypasses it on refresh', async () => {
  const cache = testCache();
  let calls = 0;
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.search('Gemini:bitcoin', load), cache.search('Gemini:bitcoin', load)]), [1, 1]);
  assert.equal(await cache.search('Gemini:bitcoin', load), 1);
  assert.equal(await cache.search('Gemini:bitcoin', load, true), 2);
});

test('skips exchange requests for an article with no unresolved question', async () => {
  const result = await lookupMarkets({
    article, key: 'fake-key', analysis: { questions: [], terms: [] },
    request: async () => assert.fail('No network call is needed'),
  });
  assert.deepEqual(result.markets, []);
});

test('reuses both exchanges’ search results when another article returns the same terms', async () => {
  const cache = testCache();
  const exchanges = [];
  const onRequest = (url) => {
    if (url.host) exchanges.push(url.host);
  };
  for (let index = 0; index < 2; index++) {
    const { markets } = await lookupMarkets({
      article: { ...article, text: `Article ${index} discussing Bitcoin prices.` },
      key: 'fake-key',
      analysis: target,
      cached: cache.search,
      request: async (url, options) => {
        if (url.host) return providers([], { onRequest })(url, options);
        return Response.json({ content: [{ type: 'tool_use', name: 'record_result', input: {
          matches: [{ id: 1, relevance: 'primary' }],
        } }] });
      },
    });
    assert.equal(markets.length, 1);
  }
  assert.deepEqual(exchanges.sort(),
    ['api.gemini.com', 'api.gemini.com', 'gamma-api.polymarket.com', 'gamma-api.polymarket.com']);
});

test('groups comparable runoff candidates while preserving separate settlement questions', async () => {
  const candidate = (id, label, condition, expiry = '2099-04-19T03:59:00Z') => ({
    ...polyEvent.markets[0], id, groupItemTitle: label, clobTokenIds: [id, '99'],
    question: `Will ${label} ${condition}?`, endDate: expiry,
  });
  const runoff = [
    candidate('21', 'Candidate A', 'advance to the second round'),
    candidate('22', 'Candidate B', 'advance to the second round'),
  ];
  const elections = [
    { slug: 'runoff', title: 'Who will advance to the second round?', negRisk: false, markets: runoff },
    { slug: 'other', title: 'Who will win or advance?', negRisk: false, markets: [
      ...runoff, candidate('23', 'Candidate C', 'win the election'),
    ] },
  ];
  const { groups } = await findPolymarket(['election'], async () => Response.json({ events: elections }));
  assert.deepEqual(groups.map(({ group, outcomes }) => [group, outcomes.map(({ label }) => label)]), [
    ['runoff', ['Candidate A', 'Candidate B']], ['other:21', ['Yes']], ['other:22', ['Yes']], ['other:23', ['Yes']],
  ]);
});

test('keeps verified article evidence and drops quotes that were absent from the input', async () => {
  const valid = await lookupMarkets({
    article, key: 'fake-key',
    request: providers([{ id: 1, reason: 'The article asks about the year-end price.', evidence: article.title }]),
  });
  assert.equal(valid.markets[0].articleConnection, 'The article asks about the year-end price.');
  assert.equal(valid.markets[0].articleQuote, article.title);

  const invalid = await lookupMarkets({
    article, key: 'fake-key',
    request: providers([{ id: 1, reason: 'The article asks about the year-end price.', evidence: 'Bitcoin hit a record.' }]),
  });
  assert.equal(invalid.markets[0].articleQuote, '');
});

test('uses provider-specific intervals and keeps cached ranges separate', async () => {
  const now = 1800000000000;
  const twoDaysAgo = now - 2 * 86_400_000;
  const markets = [
    { venue: 'Gemini', outcomes: [{ historyId: 'GEMI-TEST' }] },
    { venue: 'Polymarket', outcomes: [{ historyId: '11' }, { historyId: '22' }] },
  ];
  const cache = testCache();
  const calls = [];
  const request = async (url, options) => {
    if (String(url).includes('api.gemini.com')) {
      calls.push(String(url).split('/').at(-1));
      return Response.json([[now, 0, 0, 0, 0.4], [twoDaysAgo, 0, 0, 0, 0.3]]);
    }
    const { markets: tokens, interval, fidelity } = JSON.parse(options.body);
    calls.push([interval, fidelity]);
    const series = [{ t: twoDaysAgo / 1000, p: 0.4 }, { t: now / 1000, p: 0.45 }];
    return Response.json({ history: Object.fromEntries(tokens.map((id) => [id, series])) });
  };
  const short = await loadHistories(markets, { cache, request, now, period: '24H' });
  const long = await loadHistories(markets, { cache, request, now, period: '30D' });
  assert.deepEqual(short['Gemini:GEMI-TEST'], [[now, 0.4]]);
  assert.deepEqual(long['Gemini:GEMI-TEST'], [[twoDaysAgo, 0.3], [now, 0.4]]);
  assert.deepEqual(short['Polymarket:11'], [[now, 0.45]]);
  assert.deepEqual(long['Polymarket:11'], [[twoDaysAgo, 0.4], [now, 0.45]]);
  assert.deepEqual(await loadHistories(markets, { cache, request, now, period: '24H' }), short);
  assert.deepEqual(calls, ['15m', ['1d', 15], '6hr', ['1m', 360]]);
});

test('reuses a recent match judgment for identical candidates while displaying refreshed quotes', async () => {
  let reviewCalls = 0;
  let lastTradePrice = '0.42';
  let title = exchangeEvent.title;
  const request = async (url, options) => {
    if (url.host === 'api.gemini.com') {
      return Response.json({ data: [{ ...exchangeEvent, title, contracts: exchangeEvent.contracts.map((contract) => ({
        ...contract, prices: { ...contract.prices, lastTradePrice },
      })) }] });
    }
    if (url.host === 'gamma-api.polymarket.com') return Response.json({ events: [] });
    reviewCalls++;
    const input = JSON.parse(JSON.parse(options.body).messages[0].content);
    assert.equal(input.candidates[0].title, title);
    return Response.json({ content: [{ type: 'tool_use', name: 'record_result', input: {
      matches: [{ id: 1, relevance: 'primary', reason: 'Both ask about the year-end price.' }],
    } }] });
  };
  const args = { article, key: 'fake-key', analysis: target, request };
  const first = await lookupMarkets(args);
  assert.equal(first.markets[0].outcomes[0].quotes.last, 0.42);
  assert.equal(reviewCalls, 1);

  lastTradePrice = '0.49';
  const second = await lookupMarkets({ ...args, review: first.review });
  assert.equal(second.markets[0].outcomes[0].quotes.last, 0.49);
  assert.equal(second.review.checkedAt, first.review.checkedAt);
  assert.equal(reviewCalls, 1);

  title = 'Bitcoin above $110,000 at year-end?';
  await lookupMarkets({ ...args, review: second.review });
  assert.equal(reviewCalls, 2);
});


test('preserves provider settlement descriptions beyond the former cutoff', () => {
  const rules = 'Opening paragraph.\n\n' + 'Detailed condition. '.repeat(55) + 'Final condition.';
  const [gemini] = geminiGroups([{ ...exchangeEvent, description: rules }]);
  const [polymarket] = polymarketGroups([{
    ...polyEvent, markets: [{ ...polyEvent.markets[0], description: rules }],
  }]);
  assert.equal(gemini.rules, rules);
  assert.equal(polymarket.rules, rules);
  assert.ok(polymarket.context.length < rules.length);
});
