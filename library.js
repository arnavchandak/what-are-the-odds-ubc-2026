import { listClips, saveRecoveredMarket } from './workspace.js';
import { formatOdds, renderChart } from './chart.js';
import { hasChart, recoverMarket } from './saved-market.js';

const main = document.querySelector('#clips');
const title = document.querySelector('h1');
const key = new URLSearchParams(location.search).get('market');
const make = (tag,text = '',className = '') => Object.assign(document.createElement(tag),{textContent:text,className});
const dates = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'});
const sentences = new Intl.Segmenter('en',{granularity:'sentence'});
const upcoming = /\b(?:scheduled|expected|deadline|upcoming|plans to|due to|will announce|will meet|will vote|set to|by (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))\b/i;
let urls = [];
let loadVersion = 0;

function excerpt(value, prefer) {
  const parts = [...sentences.segment((value || '').replace(/\s+/g,' ').trim())].map(x => x.segment.trim());
  const part = prefer ? parts.find(s => prefer.test(s)) : parts[0];
  if (!part) return '';
  return part.length <= 260 ? part : part.slice(0,257).replace(/\s+\S*$/,'') + '…';
}

function link(label,url) {
  const a = make('a',label);
  if (/^https?:\/\//i.test(url)) {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

function chart(market) {
  const box = make('div','','snapshot');
  if (!market.lines?.length) {
    box.append(make('small','No chart saved with this clipping.'));
    return box;
  }
  box.append(make('small',market.period + ' · Snapshot ' + dates.format(market.at)));
  const legend = make('div','','legend');
  for (const line of market.lines) {
    const label = make('span',line.label + ' ' + formatOdds(line.price ?? line.points.at(-1)?.[1]));
    label.style.setProperty('--line',line.color);
    legend.append(label);
  }
  const plot = make('div','','market-chart');
  renderChart(plot,market.lines,market.period);
  box.append(legend,plot);
  return box;
}

function marketTile(market,clips) {
  const tile = make('a','','market-tile');
  tile.href = '?market=' + encodeURIComponent(market.key);
  tile.append(make('h2',market.title),chart(market),make('span',clips.length + (clips.length === 1 ? ' clipping' : ' clippings') + ' · Open brief →','meta'));
  return tile;
}

function detail(market,clips) {
  const summary = make('section','','brief');
  const points = make('ul');
  const watch = make('ul');
  const sources = new Map();
  const evidence = make('section','','evidence');
  evidence.append(make('h2','Saved evidence'));
  const seen = new Set();
  const watched = new Set();
  function bullet(list,text,source,isExternal = false) {
    const li = make('li',text + ' ');
    if (isExternal) li.append(link('Market rules ↗',source));
    else {
      const ref = make('a','[' + source + ']');
      ref.href = '#source-' + source;
      li.append(ref);
    }
    list.append(li);
  }
  for (const clip of clips) {
    if (!sources.has(clip.url)) sources.set(clip.url,{id:sources.size+1,article:clip.article});
    const id = sources.get(clip.url).id;
    const passage = clip.kind === 'text' ? clip.value : clip.alt;
    const point = excerpt(passage);
    if (point && !seen.has(point) && points.children.length < 5) {
      bullet(points,clip.kind === 'image' ? 'Image caption: ' + point : point,id);
      seen.add(point);
    }
    const event = clip.kind === 'text' && excerpt(clip.value,upcoming);
    if (event && !watched.has(event) && watch.children.length < 3) {
      bullet(watch,event,id);
      watched.add(event);
    }
    const block = make('div','','clip');
    block.append(link(clip.article || 'Source article',clip.url),make('small',' · Saved ' + dates.format(clip.saved),'meta'));
    if (clip.kind === 'image') {
      const img = document.createElement('img');
      img.alt = clip.alt || 'Saved article image';
      img.src = URL.createObjectURL(clip.image);
      urls.push(img.src);
      block.append(img);
    } else {
      const full = make('details');
      full.append(make('summary','Read saved passage'),make('blockquote',clip.value));
      block.append(full);
    }
    evidence.append(block);
  }
  const rule = excerpt(market.rules);
  if (rule && !watched.has(rule)) {
    if (market.terms || market.source) bullet(watch,rule,market.terms || market.source,true);
    else watch.append(make('li',rule + ' (Saved market rules)'));
  }
  summary.append(make('h2','Key points'));
  summary.append(points.childElementCount ? points : make('p','Saved images appear in the evidence below.'));
  if (watch.childElementCount) summary.append(make('h2','What to watch'),watch);
  const sourceList = make('ol');
  for (const [url,{id,article}] of sources) {
    const row = make('li');
    row.id = 'source-' + id;
    row.append(link(article || url,url));
    sourceList.append(row);
  }
  if (market.source) {
    const row = make('li');
    row.append(link('Market data · ' + market.venue,market.source));
    sourceList.append(row);
  }
  summary.append(make('h2','Sources'),sourceList);
  return [chart(market),summary,evidence];
}

async function load() {
  const version = ++loadVersion;
  try {
    const groups = new Map();
    for (const clip of await listClips()) {
      if (!groups.has(clip.market.key)) groups.set(clip.market.key,[]);
      groups.get(clip.market.key).push(clip);
    }
    const selected = key ? [groups.get(key)].filter(Boolean) : [...groups.values()];
    const markets = selected.map(clips => clips.find(c => hasChart(c.market))?.market || clips[0].market);
    if (version !== loadVersion) return;
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    document.querySelector('#back').hidden = !key;
    main.classList.toggle('market-grid',!key);
    if (!selected.length) {
      main.textContent = key ? 'No saved evidence for this market.' : 'Choose Clip from page on a market to start your library.';
    } else if (key) {
      title.textContent = markets[0].title;
      document.title = title.textContent + ' · Info Library';
      main.replaceChildren(...detail(markets[0],selected[0]));
    } else main.replaceChildren(...selected.map((clips,i) => marketTile(markets[i],clips)));
    const boxes = [...main.querySelectorAll('.snapshot')];
    await Promise.all(selected.map(async (clips,index) => {
      if (hasChart(markets[index])) return;
      const box = boxes[index];
      box.textContent = 'Restoring market chart…';
      const restored = await recoverMarket(clips).catch(() => null);
      if (version !== loadVersion) return;
      if (!restored) {
        box.textContent = 'Price history is unavailable for this saved market. ';
        const retry = make('button','Retry','text-button');
        retry.onclick = load;
        box.append(retry);
        return;
      }
      await saveRecoveredMarket(clips[0].id,restored).catch(() => {});
      if (version !== loadVersion) return;
      if (key) {
        urls.forEach(url => URL.revokeObjectURL(url));
        urls = [];
        main.replaceChildren(...detail(restored,clips));
      } else box.replaceWith(chart(restored));
    }));
  } catch { main.textContent = 'Could not open saved clippings.'; }
}
window.addEventListener('focus',load);
await load();
