import { listClips } from './workspace.js';
const select = document.querySelector('#markets');
const section = document.querySelector('#clips');
const make = (tag,text) => Object.assign(document.createElement(tag),{textContent:text});
let initialMarket = new URLSearchParams(location.search).get('market');
let clips = [], urls = [];
function render() {
  urls.forEach(url => URL.revokeObjectURL(url));
  urls = [];
  section.replaceChildren();
  for (const clip of clips.filter(c => !select.value || c.market.key === select.value)) {
    const card = make('article','');
    card.append(make('h2',clip.market.title));
    if (clip.kind === 'image') {
      const img = make('img','');
      img.alt = clip.alt || 'Saved article image';
      img.src = URL.createObjectURL(clip.image);
      urls.push(img.src);
      card.append(img);
    } else card.append(make('blockquote',clip.value));
    const source = make('a',clip.article || 'Source article');
    if (/^https?:\/\//.test(clip.url)) source.href = clip.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    card.append(source, make('small',' · ' + new Date(clip.saved).toLocaleDateString()));
    section.append(card);
  }
  if (!clips.length) section.textContent = 'Use “Clip from page” on a market to save text or an image here.';
}
async function load() {
  try {
    clips = await listClips();
    const current = initialMarket || select.value;
    initialMarket = '';
    select.length = 1;
    for (const [key,title] of new Map(clips.map(c => [c.market.key,c.market.title]))) select.add(new Option(title,key));
    select.value = current;
    render();
  } catch { section.textContent = 'Could not open saved clippings.'; }
}
select.onchange = render;
window.addEventListener('focus',load);
await load();
