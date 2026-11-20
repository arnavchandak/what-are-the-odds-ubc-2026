// This page runs outside the extension with synthetic data. The installed popup
// uses the real Chrome APIs and never imports this fixture.
const now = Date.now();
const labels = ['North Wharf', 'Central Square', 'Oak Junction'];
const market = {
  id: 1, venue: 'Gemini', title: 'Which site will Harbor City select?',
  outcomes: labels.map((label, index) => ({ label, historyId: 'SAMPLE-' + index, quotes: { last: [0.56, 0.28, 0.16][index] } })),
  articleConnection: 'The article identifies the three finalists. The market tracks which site the transit board officially selects.',
  articleQuote: 'The transit board is expected to announce its final selection after a public meeting.',
  rules: [
    'This sample market resolves to the station site named in the Harbor City Transit Board’s final public announcement. The three eligible sites are North Wharf, Central Square, and Oak Junction.',
    'The resolution source is the official transit board decision notice. Staff recommendations, public comments, and informal votes do not resolve the market. If the board changes a preliminary decision before publishing its final notice, the final notice governs.',
    'If the board cancels the project before naming a site, or does not select one of the three listed sites by the published deadline, the sample market is void. An official correction issued before settlement takes precedence over the original announcement. This is the final paragraph of the sample rules.',
  ].join('\n\n'),
  resolutionSource: 'Fictional Harbor City Transit Board decision notice.',
};
const windows = { '24H': 1, '7D': 7, '30D': 30 };

function histories(period, instruments) {
  return Object.fromEntries(instruments.map((instrument) => {
    const index = Number(instrument.split('-').at(-1));
    const quote = market.outcomes[index].quotes.last;
    const days = windows[period];
    const points = Array.from({ length: 25 }, (_, step) => {
      const progress = step / 24;
      const trend = (1 - progress) * (index === 0 ? -0.14 : 0.08) * (days === 1 ? 0.3 : 1);
      const bump = Math.sin(step * 0.92 + index * 2 + days) * 0.026 * (1 - progress);
      return [now - (1 - progress) * days * 86_400_000, quote + trend + bump];
    });
    return ['Gemini:' + instrument, points];
  }));
}

const entry = { markets: [market], fetchedAt: now, histories: histories('7D', market.outcomes.map(({ historyId }) => historyId)) };
const response = await fetch('../popup.html');
if (!response.ok) throw new Error('Could not load the popup markup.');
const documentFromPopup = new DOMParser().parseFromString(await response.text(), 'text/html');
document.body.replaceChildren(...[...documentFromPopup.body.children].filter((child) => child.tagName !== 'SCRIPT'));
const fakeKey = { anthropicApiKey: 'fixture' };
Object.assign(globalThis.chrome ??= {}, {
  storage: { local: { setAccessLevel: async () => {}, get: async () => fakeKey, set: async () => {}, remove: async () => {} } },
  tabs: { query: async () => [{ id: 1, url: 'https://sample.invalid/article' }] },
  runtime: {
    connect() {
      let receive;
      return {
        onMessage: { addListener: (listener) => { receive = listener; } },
        onDisconnect: { addListener() {} },
        disconnect() {},
        postMessage() {
          queueMicrotask(() => {
            receive({ type: 'markets', entry });
            receive({ type: 'done' });
          });
        },
      };
    },
    sendMessage: async ({ period, historyIds }) => histories(period, historyIds),
  },
});
await import('../popup.js');
document.querySelector('#settings-button').hidden = true;
