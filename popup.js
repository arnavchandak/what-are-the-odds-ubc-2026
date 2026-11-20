import { marketIdentity, savedMarket } from './saved-market.js';
import { pickClip } from './capture.js';
import { tradeTicket } from './trade.js';
import { formatOdds, renderChart, seriesColors } from './chart.js';
import { historyKey } from './history.js';
import { DEFAULT_RANGE, MAX_PLOTTED, RANGES } from './chart-ranges.js';
import { marketContexts } from './market-context.js';
import { additionalOutcomes } from './outcomes.js';

const KEY = 'anthropicApiKey';
const settings = document.querySelector('#settings');
const settingsButton = document.querySelector('#settings-button');
const keyInput = document.querySelector('#api-key');
const removeKey = document.querySelector('#remove-key');
const refresh = document.querySelector('#refresh');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const chartSlots = new Map();
const contexts = marketContexts();
let articleTab;
let hasKey = false;
let loading = false;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

function showSettings(open) {
  settings.hidden = !open;
  settingsButton.setAttribute('aria-expanded', String(open));
  if (open) keyInput.focus();
}

function updateControls() {
  removeKey.hidden = !hasKey;
  refresh.disabled = !hasKey || loading;
  settingsButton.disabled = loading;
  keyInput.placeholder = hasKey ? 'Enter a replacement key' : 'Paste your Anthropic API key';
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

const asOfFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

function link(label, href) {
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const anchor = element('a', label);
    anchor.href = url.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  } catch {
    return null;
  }
}

function rangeData(slot, period) {
  if (!slot.histories.has(period)) slot.histories.set(period, { points: {}, pending: new Set() });
  return slot.histories.get(period);
}

function updateChart(slot) {
  const { chart, legend, period, series } = slot;
  const { points, pending } = rangeData(slot, period);
  const selected = series.filter((item) => item.selected);
  const lines = selected.map(({ key, label, color }) => ({ label, color, points: points[key] }));
  const waiting = selected.some(({ key }) => pending.has(key));
  const baseline = rangeData(slot, DEFAULT_RANGE).points;
  legend.replaceChildren(...selected.map((item) => {
    const { label, color, key, quote } = item;
    const row = element('li', '', 'outcome');
    const marker = element('span', '', 'series-marker');
    marker.style.setProperty('--series-color', color);
    marker.setAttribute('aria-hidden', 'true');
    const price = quote ?? baseline[key]?.at(-1)?.[1];
    const odds = element('span', formatOdds(price), 'outcome-odds');
    odds.title = quote != null ? 'Latest market price' : 'Last recorded price in the default history window';
    const name = element('span', label, 'outcome-name');
    name.prepend(marker);
    const button = element('button', '', 'legend-button');
    button.title = 'Trade · ' + label;
    button.append(name, odds);
    button.onclick = () => slot.openTrade(item);
    row.append(button);
    return row;
  }));

  const hasLine = lines.some((line) => (line.points?.length || 0) >= 2);
  if (!selected.length) chart.textContent = 'Choose outcomes to plot.';
  else if (waiting && !hasLine) chart.textContent = 'Loading price history…';
  else renderChart(chart, lines, period);

  slot.latest.hidden = !selected.length;
  chart.setAttribute('aria-busy', String(waiting));
}

async function requestChart(slot, retry = false) {
  const period = slot.period;
  const { points, pending } = rangeData(slot, period);
  const needed = new Map(slot.series.flatMap(({ selected, key, historyId }) =>
    selected && key && !pending.has(key) && (!Object.hasOwn(points, key) || (retry && points[key] === null))
      ? [[key, historyId]] : []));
  for (const key of needed.keys()) pending.add(key);
  updateChart(slot);
  if (!needed.size) return;
  const histories = await chrome.runtime.sendMessage({
    type: 'chart', venue: slot.venue, period, historyIds: [...needed.values()],
  }).catch(() => null);
  for (const key of needed.keys()) {
    points[key] = histories?.[key] ?? null;
    pending.delete(key);
  }
  if ((slot.period === period || period === DEFAULT_RANGE) && chartSlots.get(slot.id) === slot) updateChart(slot);
}

function renderContext(market, back, backButton, source) {
  const header = element('div', '', 'context-heading');
  header.append(element('h2', 'Market context'), backButton);
  const body = element('div', '', 'context-content');
  function paragraph(value, fallback) {
    const text = typeof value === 'string' && value.trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const sentences = [...new Intl.Segmenter('en', { granularity:'sentence' }).segment(text)];
    let excerpt = '';
    for (const { segment } of sentences.slice(0, 2)) {
      if ((excerpt + segment).trim().length > 280) break;
      excerpt += segment;
    }
    return excerpt.trim() || fallback;
  }
  body.append(element('p', market.title, 'context-question'));
  const reason = paragraph(market.articleConnection, market.articleQuote) || market.articleQuote;
  if (reason) body.append(element('p', reason, 'article-context'));
  const rulesLink = link('Full rules ↗', market.termsUrl);
  const resolution = link('Resolution source ↗', market.resolutionSource);
  const rules = paragraph(market.rules || (!resolution && market.resolutionSource), 'See the full settlement terms for this market.');
  if (rules) body.append(element('h3', 'Settlement'), element('p', rules, 'market-rules'));
  if (market.rules && rules !== market.rules.trim() && !rulesLink) {
    const full = element('dialog','', 'rules-dialog');
    const dismiss = element('button','Close');
    dismiss.onclick = () => full.close();
    full.append(element('h2','Full settlement terms'),element('p',market.rules,'market-rules'),dismiss);
    const read = element('button','Read full terms','context-button');
    read.onclick = () => full.showModal();
    body.append(read,full);
  }
  const links = element('div', '', 'context-links');
  const seen = new Set();
  for (const anchor of [rulesLink, resolution, source?.cloneNode(true)]) {
    if (!anchor || seen.has(anchor.href)) continue;
    seen.add(anchor.href);
    links.append(anchor);
  }
  if (links.childElementCount) body.append(links);
  if (!body.childElementCount) body.append(element('p', 'No additional context is available.'));
  back.append(header, body);
}

function renderMarket(market, histories, fetchedAt) {
  const card = element('article', '', 'market');
  const front = element('div', '', 'market-front');
  const back = element('section', '', 'market-back');
  back.id = `market-context-${market.id}`;
  card.append(front, back);
  front.append(element('h2', market.title));

  const chart = element('div', '', 'market-chart');
  const plot = element('div', '', 'market-plot');
  const latest = element('aside', '', 'market-latest');
  latest.setAttribute('aria-label', 'Latest odds');
  const legend = element('ul', '', 'outcomes');
  latest.append(legend);
  plot.append(latest, chart);
  const ticket = element('section', '', 'trade-ticket');
  ticket.hidden = true;
  const marketKey = marketIdentity(market);
  const series = [...market.outcomes, ...additionalOutcomes(market)].map((outcome, index) => ({
    key: historyKey(market.venue, outcome),
    historyId: outcome.historyId,
    label: outcome.label,
    quote: outcome.quotes.last ?? outcome.quotes.price,
    selected: index < market.outcomes.length,
    color: seriesColors[index],
  }));
  const slot = { marketTitle:market.title, ticket, marketKey, id: market.id, venue: market.venue, chart, legend, latest, period: DEFAULT_RANGE, series, histories: new Map() };
  chartSlots.set(slot.id, slot);
  const initial = rangeData(slot, DEFAULT_RANGE);
  if (histories) Object.assign(initial.points, histories);
  else series.filter(({ selected, key }) => selected && key).forEach(({ key }) => initial.pending.add(key));

  const controls = element('div', '', 'market-controls');
  const ranges = element('div', '', 'chart-ranges');
  ranges.setAttribute('role', 'group');
  ranges.setAttribute('aria-label', 'Chart time range');
  for (const period of Object.keys(RANGES)) {
    const button = element('button', period, 'range-button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(period === DEFAULT_RANGE));
    button.addEventListener('click', () => {
      for (const sibling of ranges.children) sibling.setAttribute('aria-pressed', String(sibling === button));
      slot.period = period;
      requestChart(slot, true);
    });
    ranges.append(button);
  }
  controls.append(ranges);

  if (series.length > 1) {
    const picker = element('details', '', 'outcome-picker');
    const options = element('div', '', 'outcome-options');
    const checks = series.map((item) => {
      const label = element('label', '', 'outcome-option');
      const check = element('input', '');
      check.type = 'checkbox';
      check.checked = item.selected;
      check.addEventListener('change', () => {
        item.selected = check.checked;
        if (item.selected) item.color = seriesColors.find((color) =>
          !series.some((other) => other !== item && other.selected && other.color === color));
        updateOptions();
        requestChart(slot);
      });
      label.append(check, element('span', item.label));
      options.append(label);
      return check;
    });
    const summary = element('summary', '', 'outcomes-button');
    function updateOptions() {
      const count = series.filter(({ selected }) => selected).length;
      summary.textContent = `Outcomes (${count})`;
      checks.forEach((check) => { check.disabled = count >= MAX_PLOTTED && !check.checked; });
    }
    updateOptions();
    options.prepend(element('p', `Choose up to ${MAX_PLOTTED}.`));
    picker.append(summary, options);
    controls.append(picker);
  }

  const footer = element('footer', '');
  const contextButton = element('button', 'Context', 'context-button');
  const backButton = element('button', '← Back to odds', 'back-to-odds');
  contextButton.type = backButton.type = 'button';
  contextButton.setAttribute('aria-controls', back.id);
  contextButton.setAttribute('aria-expanded', 'false');
  const source = link('View source ↗', market.source);
  const trade = element('button','Trade','trade-toggle');
  ticket.id = 'trade-' + market.id;
  trade.setAttribute('aria-controls',ticket.id);
  trade.setAttribute('aria-expanded','false');
  const closeTrade = () => {
    ticket.hidden = true;
    trade.setAttribute('aria-expanded','false');
    trade.focus({preventScroll:true});
  };
  slot.openTrade = item => {
    for (const other of chartSlots.values()) {
      if (other !== slot && !other.ticket.hidden) {
        other.ticket.hidden = true;
        other.tradeButton.setAttribute('aria-expanded','false');
      }
    }
    slot.tradeItem = item;
    const price = item.quote ?? rangeData(slot, DEFAULT_RANGE).points[item.key]?.at(-1)?.[1];
    tradeTicket(ticket, marketKey, item, price, series, slot.openTrade, closeTrade);
    trade.setAttribute('aria-expanded','true');
  };
  trade.onclick = () => {
    if (ticket.hidden) slot.openTrade(slot.tradeItem || series.find(item => item.selected) || series[0]);
    else closeTrade();
  };
  slot.tradeButton = trade;
  trade.disabled = !series.length;
  footer.append(trade,contextButton);
  const clip = element('button', 'Clip from page', 'context-button');
  clip.onclick = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
      if (tab?.id !== articleTab?.id || tab?.url?.split('#')[0] !== articleTab?.url?.split('#')[0]) throw Error('Tab changed');
      await chrome.scripting.executeScript({ target:{ tabId:tab.id }, func:pickClip, args:[savedMarket(market, fetchedAt, rangeData(slot,slot.period).points, slot.period, series.filter(item => item.selected))] });
      if (location.protocol === 'chrome-extension:') window.close();
    } catch (error) {
      clip.textContent = 'Retry clip';
      let notice = front.querySelector('.clip-error');
      if (!notice) { notice = element('small','','clip-error'); notice.setAttribute('role','status'); footer.after(notice); }
      notice.textContent = error.message === 'Tab changed' ? 'The article changed. Refresh markets before clipping.' : 'Chrome could not open the article picker. Check extension access to this site and retry.';
    }
  };
  footer.append(clip);
  if (source) footer.append(source);
  front.append(controls, plot, footer, ticket);
  contexts.bind({ card, front, back, contextButton, backButton, prepareContext: () => {
    if (!back.childElementCount) renderContext(market, back, backButton, source);
  } });
  updateChart(slot);
  return card;
}

function renderResults(entry) {
  contexts.close();
  chartSlots.clear();
  results.replaceChildren(...entry.markets.map((market) => renderMarket(market, entry.histories, entry.fetchedAt)));
  const statusText = entry.markets.length
    ? `Updated at ${asOfFormat.format(entry.fetchedAt)}`
    : 'No close market match for this article.';
  showStatus(entry.partial ? `${statusText} Some market data was unavailable.` : statusText);
}

async function startLookup(forceRefresh = false) {
  if (!hasKey || loading) return;
  loading = true;
  updateControls();
  showSettings(false);
  contexts.close();
  showStatus('Loading markets…');
  const finish = () => {
    loading = false;
    updateControls();
  };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    articleTab = tab;
    if (!Number.isInteger(tab?.id) || !/^https?:\/\//.test(tab?.url || '')) {
      showStatus('Open a web article to see matching markets.');
      finish();
      return;
    }
    const port = chrome.runtime.connect({ name: 'headline-odds' });
    port.onMessage.addListener((message) => {
      if (message.type === 'markets') renderResults(message.entry);
      if (message.type === 'histories') {
        for (const slot of chartSlots.values()) {
          const { points, pending } = rangeData(slot, message.period);
          Object.assign(points, message.histories);
          for (const key of Object.keys(message.histories)) pending.delete(key);
          if (slot.period === message.period || message.period === DEFAULT_RANGE) updateChart(slot);
        }
      }
      if (message.type === 'error') showStatus(message.message, true);
      if (message.type === 'done' || message.type === 'error') {
        finish();
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (!loading) return;
      for (const slot of chartSlots.values()) {
        for (const data of slot.histories.values()) data.pending.clear();
        updateChart(slot);
      }
      showStatus('The connection was interrupted. Refresh to try again.', true);
      finish();
    });
    port.postMessage({ type: 'lookup', tabId: tab.id, url: tab.url, refresh: forceRefresh });
  } catch {
    showStatus('Could not open this tab. Refresh to try again.', true);
    finish();
  }
}

settingsButton.addEventListener('click', () => showSettings(settings.hidden));
refresh.addEventListener('click', () => startLookup(true));

settings.addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!/^sk-ant-\S+$/.test(key)) {
    showStatus('Enter an Anthropic API key starting with sk-ant-.', true);
    return;
  }
  try {
    await chrome.storage.local.set({ [KEY]: key });
    keyInput.value = '';
    hasKey = true;
    startLookup();
  } catch {
    showStatus('Chrome could not save the key. Try again.', true);
  }
});

removeKey.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove(KEY);
    keyInput.value = '';
    hasKey = false;
    updateControls();
    contexts.close();
    chartSlots.clear();
    results.replaceChildren();
    showStatus('Key removed. Add a Claude API key to load markets.');
  } catch {
    showStatus('Chrome could not remove the key. Try again.', true);
  }
});

try {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  hasKey = Boolean((await chrome.storage.local.get(KEY))[KEY]);
  updateControls();
  if (hasKey) startLookup();
  else {
    showSettings(true);
    showStatus('Add a Claude API key to load markets.');
  }
} catch {
  showStatus('Chrome could not open local settings. Reload the extension and try again.', true);
}
