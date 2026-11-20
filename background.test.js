import test from 'node:test';
import assert from 'node:assert/strict';

test('sends markets and histories before a delayed snapshot write and opens cached markets with optional outcomes', { timeout: 3000 }, async (t) => {
  const url = 'https://example.test/article';
  const snapshotKey = 'headline-odds:lookup:' + url;
  const records = {};
  const holdWrite = Promise.withResolvers();
  t.after(holdWrite.resolve);
  let onConnect;
  let articleReads = 0;
  let modelCalls = 0;
  const now = Date.now();
  const chromeFixture = {
    storage: { local: {
      get: async (keys) => Object.fromEntries([keys].flat().map((key) => [key, records[key]])),
      set: async (updates) => {
        if (updates[snapshotKey]) await holdWrite.promise;
        Object.assign(records, updates);
      },
      getKeys: async () => Object.keys(records),
      remove: async () => {},
    } },
    scripting: { executeScript: async () => {
      articleReads++;
      return [{ result: { url, title: 'A race goes to a runoff', text: 'Which candidate will enter the runoff?' } }];
    } },
    runtime: {
      onConnect: { addListener: (listener) => { onConnect = listener; } },
      onMessage: { addListener: () => {} },
    },
  };
  globalThis.chrome = chromeFixture;
  t.after(() => { delete globalThis.chrome; });
  t.mock.method(globalThis, 'fetch', async (address) => {
    const endpoint = new URL(address);
    if (endpoint.host === 'api.anthropic.com') {
      const input = ++modelCalls === 1
        ? { questions: ['Which candidate will enter the runoff?'], terms: ['runoff'] }
        : { matches: [{ id: 1, relevance: 'primary' }] };
      return Response.json({ content: [{ type: 'tool_use', name: 'record_result', input }] });
    }
    if (endpoint.pathname.startsWith('/v2/candles/')) {
      return Response.json([[now - 60000, 0, 0, 0, 0.42], [now, 0, 0, 0, 0.5]]);
    }
    if (endpoint.host === 'api.gemini.com') {
      return Response.json({ data: [{
        ticker: 'RUNOFF', title: 'Which candidate will enter the runoff?', status: 'active',
        contracts: [{ instrumentSymbol: 'GEMI-RUNOFF', label: 'Candidate', prices: { lastTradePrice: '0.5' } }],
      }], pagination: { total: 1 } });
    }
    if (endpoint.host === 'gamma-api.polymarket.com') return Response.json({ events: [] });
    assert.fail('Unexpected endpoint ' + endpoint);
  });

  records.anthropicApiKey = 'fixture';
  await import('./background.js');

  function lookup() {
    const messages = [];
    const chartsArrived = Promise.withResolvers();
    const finished = Promise.withResolvers();
    let receive;
    onConnect({
      name: 'headline-odds', onDisconnect: { addListener: () => {} },
      onMessage: { addListener: (listener) => { receive = listener; } },
      postMessage(message) {
        messages.push(message);
        if (message.type === 'histories') chartsArrived.resolve();
        if (message.type === 'done') finished.resolve();
        if (message.type === 'error') {
          const error = new Error(message.message);
          chartsArrived.resolve();
          finished.resolve(error);
        }
      },
    });
    receive({ type: 'lookup', tabId: 1, url, refresh: false });
    return { messages, chartsArrived: chartsArrived.promise, finished: finished.promise };
  }

  const cold = lookup();
  await cold.chartsArrived;
  assert.deepEqual(cold.messages.map(({ type }) => type), ['markets', 'histories']);
  assert.equal(cold.messages[0].entry.markets[0].outcomes[0].quotes.last, 0.5);
  assert.equal(cold.messages[1].histories['Gemini:GEMI-RUNOFF'].length, 2);
  assert.equal(cold.messages[0].entry.review, undefined);
  assert.equal(records[snapshotKey], undefined);

  holdWrite.resolve();
  assert.equal(await cold.finished, undefined);
  delete records[snapshotKey].markets[0].otherOutcomes;
  const warm = lookup();
  assert.equal(await warm.finished, undefined);
  assert.deepEqual(warm.messages.map(({ type }) => type), ['markets', 'done']);
  assert.equal(articleReads, 1);
  assert.equal(modelCalls, 2);
});
