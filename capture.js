// Chrome serializes this function into the article's isolated world.
export function pickClip(market, demoSave) {
  document.dispatchEvent(new Event('headline-odds-close-picker'));
  const host = document.createElement('div');
  host.popover = 'manual';
  host.style.cssText = 'position:fixed!important;inset:12px 12px auto auto!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;max-width:calc(100vw - 24px)!important;z-index:2147483647!important';
  const root = host.attachShadow({mode:'closed'});
  const css = document.createElement('style');
  css.textContent = 'section{box-sizing:border-box;width:min(330px,calc(100vw - 24px));padding:14px;background:white;color:#1d3028;border:1px solid #b7c8be;border-radius:9px;box-shadow:0 4px 20px #1233;font:14px/1.4 system-ui}strong,p{display:block;margin:0 0 7px}section{user-select:none}button{padding:5px 9px;margin-right:5px;cursor:pointer;border-radius:5px;border:1px solid #acc1b4;background:white;color:#164632}button:disabled{opacity:.55}[hidden]{display:none}';
  const bar = document.createElement('section');
  const heading = document.createElement('strong');
  heading.textContent = market.title;
  const status = document.createElement('p');
  status.setAttribute('role','status');
  status.hidden = true;
  const text = document.createElement('p');
  const save = document.createElement('button');
  const library = document.createElement('button');
  const cancel = document.createElement('button');
  library.textContent = 'Open Info Library';
  library.hidden = true;
  save.textContent = 'Save text';
  cancel.textContent = 'Cancel';
  bar.append(heading,status,text,save,library,cancel);
  root.append(css,bar);
  document.documentElement.append(host);
  host.showPopover?.();
  const controller = new AbortController();
  const options = {capture:true,signal:controller.signal};
  const close = () => { controller.abort(); host.remove(); };
  document.addEventListener('headline-odds-close-picker',close,options);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); },options);
  cancel.onclick = close;
  library.onclick = () => {
    if (demoSave) window.open('/library.html?market=' + encodeURIComponent(market.key),'_blank','noopener');
    else chrome.runtime.sendMessage({type:'open-clip-library',marketKey:market.key});
    close();
  };
  let busy = false;
  let selection = '';
  let savedCount = 0;
  function readSelection() {
    if (busy) return;
    selection = window.getSelection()?.toString().trim() || '';
    save.disabled = !selection;
    text.textContent = selection ? 'Selected: ' + selection.slice(0,90) + (selection.length > 90 ? '…' : '') :
      'Highlight a passage to save text, or click an article image.';
  }
  readSelection();
  document.addEventListener('selectionchange',readSelection,options);
  save.onpointerdown = e => e.preventDefault();
  save.onclick = () => { if (selection) submit({kind:'text',value:selection}); };
  async function submit(payload) {
    if (busy) return;
    busy = save.disabled = library.disabled = true;
    status.hidden = false;
    status.textContent = 'Saving clip…';
    try {
      if (payload.kind === 'image') {
        host.style.setProperty('visibility','hidden','important');
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }
      const clip = {...payload,market,url:location.href,article:document.title};
      if (demoSave) await demoSave(clip);
      else {
        const response = await chrome.runtime.sendMessage({type:'save-clip',clip});
        if (!response?.saved) throw Error(response?.error || 'The extension disconnected. Reopen it and try again.');
      }
      savedCount++;
      status.textContent = savedCount + (savedCount === 1 ? ' clip saved.' : ' clips saved.');
      if (payload.kind === 'text' && window.getSelection()?.toString().trim() === payload.value) {
        window.getSelection().removeAllRanges();
      }
      library.hidden = false;
      cancel.textContent = 'Done';
    } catch (error) {
      status.textContent = error.message || 'Could not save. Try again.';
    } finally {
      host.style.removeProperty('visibility');
      busy = library.disabled = false;
      readSelection();
    }
  }
  document.addEventListener('click',e => {
    if (busy || e.target === host) return;
    const image = e.composedPath().find(node => node instanceof HTMLImageElement) ||
      document.elementsFromPoint(e.clientX,e.clientY).find(node => node instanceof HTMLImageElement);
    if (!image) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = image.getBoundingClientRect();
    const rect = [Math.max(0,r.left)/innerWidth,Math.max(0,r.top)/innerHeight,
      Math.min(innerWidth,r.right)/innerWidth,Math.min(innerHeight,r.bottom)/innerHeight];
    submit({kind:'image',alt:image.alt,imageUrl:image.currentSrc,rect});
  },options);
  return true;
}
