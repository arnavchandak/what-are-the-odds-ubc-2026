// Small printed bands form a landscape, separate from the odds chart below.
const canvas = document.querySelector('.terrain');
const ctx = canvas.getContext('2d');
const colors = ['#567e80','#77999a','#d5a18a','#df9179','#945b59'];
for (let layer = 0; layer < colors.length; layer++) {
  for (let x = 0; x < canvas.width; x += 4) {
    const crest = 1 - Math.abs(Math.sin(x / 166 + layer * 0.32));
    const height = 42 + layer * 26 + crest * 59 + Math.sin(x / 27 + layer) * 7;
    const top = Math.round(height / 3) * 3;
    ctx.fillStyle = '#293f43';
    ctx.fillRect(x,top,4,canvas.height-top);
    ctx.fillStyle = colors[layer];
    for (let y = top; y < canvas.height; y += 4) ctx.fillRect(x,y,3,2);
  }
}
