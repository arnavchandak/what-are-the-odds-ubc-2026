import { demoAccount } from './workspace.js';

const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' });

export function tradeTicket(panel, marketKey, item, price, series, openTrade, closeTrade) {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="ticket-head"><label>Outcome <select></select></label><button class="text-button" aria-label="Close ticket">×</button></div>
    <div class="ticket-sides"><button class="side yes"></button><button class="side no"></button></div>
    <label class="ticket-amount">Amount (USD)<span>$ <input aria-label="Amount in dollars" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></span></label>
    <div class="ticket-actions"><button>Buy</button><button>Sell</button></div>
    <div class="ticket-balance"><span>Cash balance</span><strong>—</strong></div>
    <div class="position-line" hidden></div>
    <small role="status"></small>`;
  const find = selector => panel.querySelector(selector);
  const sides = [...panel.querySelectorAll('.side')];
  const [buy, sell] = panel.querySelectorAll('.ticket-actions button');
  const balance = find('.ticket-balance strong');
  const input = find('input');
  const feedback = find('small');
  const positionLine = find('.position-line');
  const select = find('select');
  series.forEach((outcome,index) => select.add(new Option(outcome.label,String(index),false,outcome === item)));
  select.onchange = () => {
    openTrade(series[select.selectedIndex]);
    panel.querySelector('select').focus();
  };
  find('.text-button').onclick = closeTrade;
  const yes = Math.round(price * 10000);
  const quoted = Number.isFinite(price) && yes > 0 && yes < 10000;
  let side = 0;
  let sideChosen = false;
  let account;
  let busy = false;
  const unitPrice = () => side ? 10000 - yes : yes;
  const sideName = index => index ? 'No' : 'Yes';
  const position = () => JSON.stringify([marketKey, item.historyId || item.label, sideName(side)]);
  function update() {
    const cents = Math.round(input.valueAsNumber * 100);
    const valid = quoted && !busy && account && input.validity.valid && Number.isSafeInteger(cents) && cents > 0;
    buy.disabled = !valid || cents * 100 > account.cash;
    sell.disabled = !valid || cents * 100 > Math.floor((account.positions[position()] || 0) * unitPrice() + 1e-6);
    sides.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(side === index));
      button.disabled = busy;
    });
    input.disabled = busy;
    select.disabled = busy;
    const shares = account?.positions[position()] || 0;
    positionLine.hidden = !shares;
    if (shares) {
      const entry = account.averageEntry?.[position()];
      const value = quoted ? money.format(shares * unitPrice() / 10000) : 'Value unavailable';
      const average = Number.isFinite(entry) ? ' · Avg entry ' + Number((entry / 100).toFixed(2)) + '¢' : '';
      positionLine.textContent = sideName(side) + ' position ' + value + average;
    }
    if (account) balance.textContent = money.format(account.cash / 10000);
  }
  sides.forEach((button, index) => {
    button.textContent = sideName(index) + (quoted ? '  ' + (index ? 10000 - yes : yes) / 100 + '¢' : '');
    button.onclick = () => { sideChosen = true; side = index; feedback.textContent = ''; update(); };
  });
  async function submit(action) {
    const amountCents = Math.round(input.valueAsNumber * 100);
    busy = true;
    update();
    try {
      account = await demoAccount({ position:position(), action, price:unitPrice(), amountCents });
      feedback.textContent = (action === 'Buy' ? 'Bought ' : 'Sold ') + money.format(amountCents / 100) + ' of ' + sideName(side) + '.';
    } catch (error) { feedback.textContent = error.message; }
    busy = false;
    update();
  }
  buy.onclick = () => submit('Buy');
  sell.onclick = () => submit('Sell');
  input.oninput = () => { feedback.textContent = ''; update(); };
  if (!quoted) feedback.textContent = 'Trading unavailable at this price.';
  update();
  demoAccount().then(result => {
    account = result;
    if (!sideChosen && !account.positions[position()]) {
      side = 1;
      if (!account.positions[position()]) side = 0;
    }
    update();
  })
    .catch(() => { feedback.textContent = 'Could not load your cash balance.'; });
}
