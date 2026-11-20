const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const shortDateTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric' });
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const seriesColors = ['#176d56', '#345eb0', '#a85d1b', '#7851a5', '#b43d62'];

export function formatOdds(value) {
  if (value == null) return '—';
  return value > 0 && value < 0.0001 ? `<${percent.format(0.0001)}` : percent.format(value);
}

function chartScale(min, max) {
  const padding = Math.max((max - min) * 0.12, (0.08 - (max - min)) / 2);
  const floor = Math.max(0, min - padding);
  const ceiling = Math.min(1, max + padding);
  const target = (ceiling - floor) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].find((size) => size * magnitude >= target) * magnitude;
  const round = (value) => Math.round(value * 10_000) / 10_000;
  const bottom = Math.max(0, round(Math.floor(floor / step) * step));
  const top = Math.min(1, round(Math.ceil(ceiling / step) * step));
  const ticks = [bottom];
  for (let level = round(bottom + step); level < top; level = round(level + step)) ticks.push(level);
  if (top - ticks.at(-1) < step * 0.5) ticks.pop();
  ticks.push(top);
  return { bottom, top, ticks };
}

export function renderChart(element, series, period) {
  const available = series.filter(({ points }) => Array.isArray(points) && points.length >= 2);
  if (!available.length) {
    element.textContent = series.some(({ points }) => points === null)
      ? 'Price history couldn’t be loaded.' : 'No recent price history.';
    return;
  }

  const firstTime = Math.min(...available.map(({ points }) => points[0][0]));
  const lastTime = Math.max(...available.map(({ points }) => points.at(-1)[0]));
  const prices = available.flatMap(({ points }) => points.map(([, price]) => price));
  const { bottom, top, ticks } = chartScale(Math.min(...prices), Math.max(...prices));

  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = available.length > 1 ? 280 : 226;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Recent market odds. ${available.map(({ label, points }) =>
    `${label}: ${formatOdds(points[0][1])} to ${formatOdds(points.at(-1)[1])}`).join('. ')}`);
  const ctx = canvas.getContext('2d');
  const left = 7;
  const right = canvas.width - 84;
  const high = 18;
  const low = canvas.height - 19;
  const x = (timestamp) => left + ((timestamp - firstTime) / (lastTime - firstTime)) * (right - left);
  const y = (value) => low - ((value - bottom) / (top - bottom)) * (low - high);

  ctx.font = '19px system-ui';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#43564e';
  ctx.strokeStyle = '#d9e1dd';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  for (const level of ticks) {
    const row = y(level);
    ctx.fillText(formatOdds(level), right + 24, row);
    ctx.beginPath();
    ctx.moveTo(left, row);
    ctx.lineTo(right, row);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const { points, color } of available) {
    ctx.beginPath();
    ctx.moveTo(x(points[0][0]), y(points[0][1]));
    let previous = points[0][1];
    for (const [timestamp, value] of points.slice(1)) {
      ctx.lineTo(x(timestamp), y(previous));
      ctx.lineTo(x(timestamp), y(value));
      previous = value;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const [timestamp, value] = points.at(-1);
    ctx.beginPath();
    ctx.arc(x(timestamp), y(value), 4.7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const axis = document.createElement('div');
  axis.className = 'chart-axis';
  axis.style.marginInline = `${left / canvas.width * 100}% ${(canvas.width - right) / canvas.width * 100}%`;
  let format = date;
  if (date.format(firstTime) === date.format(lastTime)) format = time;
  else if (period === '24H') format = shortDateTime;
  for (const timestamp of [firstTime, lastTime]) {
    const label = document.createElement('span');
    label.textContent = format.format(timestamp);
    axis.append(label);
  }
  element.replaceChildren(canvas, axis);
}
