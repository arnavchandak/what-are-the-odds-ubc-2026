// Serialized by chrome.scripting, so the picker is self-contained.
export function pickClip(market, demoSave) {
  document.dispatchEvent(new Event('headline-odds-close-picker'));
  const host = document.createElement('div');
  host.style.cssText = 'all:initial!important;position:fixed!important;bottom:16px!important;right:16px!important;z-index:2147483647!important';
  const root = host.attachShadow({ mode:'closed' });
  const bar = document.createElement('div');
  bar.style.cssText = 'max-width:320px;padding:14px;background:#153d33;color:white;border-radius:10px;font:14px/1.45 system-ui;box-shadow:0 3px 18px #0004';
  const text = document.createElement('div');
  text.textContent = market.title + ' · Select text and press Save, or click an image.';
  const save = document.createElement('button');
  const cancel = document.createElement('button');
  save.textContent = 'Save selection';
  cancel.textContent = 'Cancel';
  for (const btn of [save,cancel]) btn.style.cssText = 'cursor:pointer;margin:8px 5px 0 0;padding:5px 9px';
  bar.append(text,save,cancel);
  root.append(bar);
  document.documentElement.append(host);
  const controller = new AbortController();
  const options = { capture:true, signal:controller.signal };
  const close = () => { controller.abort(); host.remove(); };
  document.addEventListener('headline-odds-close-picker', close, options);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, options);
  cancel.onclick = close;
  let busy = false;
  async function submit(payload) {
    if (busy) return;
    busy = true;
    host.style.visibility = 'hidden';
    try {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const clip = { ...payload, market, url:location.href, article:document.title };
      const result = demoSave ? await demoSave(clip) : await chrome.runtime.sendMessage({type:'save-clip',clip});
      if (result?.error) throw Error(result.error);
      text.textContent = 'Saved to ' + market.title + '.';
      save.hidden = true;
      cancel.textContent = 'Done';
      setTimeout(close, 1800);
    } catch {
      busy = false;
      text.textContent = 'Could not save. Keep this tab visible and try again.';
    } finally { host.style.visibility = ''; }
  }
  save.onmousedown = e => e.preventDefault();
  save.onclick = () => {
    const value = window.getSelection()?.toString().trim();
    if (value) submit({ kind:'text', value });
    else text.textContent = 'Select a passage first, or click an image.';
  };
  document.addEventListener('click', e => {
    const image = e.target.closest?.('img');
    if (!image || busy) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = image.getBoundingClientRect();
    const left = Math.max(0,r.left), top = Math.max(0,r.top);
    const right = Math.min(innerWidth,r.right), bottom = Math.min(innerHeight,r.bottom);
    submit({ kind:'image', alt:image.alt, imageUrl:image.currentSrc, rect:[left/innerWidth,top/innerHeight,right/innerWidth,bottom/innerHeight] });
  }, options);
}
