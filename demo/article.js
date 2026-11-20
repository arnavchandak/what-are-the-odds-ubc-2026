import { pickClip } from '../capture.js';
import { saveClip } from '../workspace.js';

const map = document.querySelector('#station-map');
const canvas = document.createElement('canvas');
canvas.width = 540;
canvas.height = 110;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#edf2ed';
ctx.fillRect(0,0,540,110);
ctx.strokeStyle = '#568275';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(84,59);
ctx.lineTo(260,38);
ctx.lineTo(447,52);
ctx.stroke();
ctx.font = '15px system-ui';
ctx.textAlign = 'center';
for (const [x,y,name] of [[84,59,'North Wharf'],[260,38,'Central Square'],[447,52,'Oak Junction']]) {
  ctx.fillStyle = '#195a47';
  ctx.beginPath();
  ctx.arc(x,y,6,0,2*Math.PI);
  ctx.fill();
  ctx.fillText(name,x,y+25);
}
map.src = canvas.toDataURL();
document.addEventListener('sample-clip', event => {
  pickClip(event.detail, async clip => {
    if (clip.kind === 'image') clip.image = await (await fetch(clip.imageUrl)).blob();
    await saveClip(clip);
  });
});
