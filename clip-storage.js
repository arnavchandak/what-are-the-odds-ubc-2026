import { saveClip } from './workspace.js';

export async function storePageClip(clip, sender) {
  if (!sender.tab || sender.frameId !== 0 || sender.url !== clip.url || !/^https?:/.test(clip.url)) throw Error('Page changed.');
  const { market, article, url, kind } = clip;
  const record = { market, article, url, kind };
  if (kind === 'text' && clip.value?.trim()) record.value = clip.value;
  else if (kind === 'image') {
    const visible = async () => {
      const [tab] = await chrome.tabs.query({ active:true, windowId:sender.tab.windowId });
      if (tab?.id !== sender.tab.id || tab.url !== url) throw Error('Tab changed.');
    };
    await visible();
    const data = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format:'png' });
    await visible();
    const bitmap = await createImageBitmap(await (await fetch(data)).blob());
    try {
      const [left,top,right,bottom] = clip.rect;
      const w = bitmap.width * (right-left), h = bitmap.height * (bottom-top);
      const scale = Math.min(1, 1200 / Math.max(w,h));
      const canvas = new OffscreenCanvas(Math.max(1,Math.round(w*scale)), Math.max(1,Math.round(h*scale)));
      canvas.getContext('2d').drawImage(bitmap,left*bitmap.width,top*bitmap.height,w,h,0,0,canvas.width,canvas.height);
      record.image = await canvas.convertToBlob({ type:'image/webp', quality:0.85 });
      record.alt = clip.alt;
    } finally { bitmap.close(); }
  } else throw Error('Empty clipping.');
  await saveClip(record);
}
