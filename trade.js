import { demoAccount } from './workspace.js';

const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' });

export function tradeTicket(panel, marketKey, item, price, marketTitle) {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="ticket-head"><strong></strong><button class="text-button" aria-label="Close ticket">×</button></div>
    <div class="ticket-sides"><button class="side yes"></button><button class="side no"></button></div>
    <label class="ticket-amount">Amount (USD)<span>$ <input aria-label="Amount in dollars" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></span></label>
    <div class="ticket-actions"><button>Buy</button><button>Sell</button></div>
    <div class="ticket-balance"><span>Cash balance</span><strong>—</strong></div>
    <small role="status"></small>`;
  const find = selector => panel.querySelector(selector);
  const sides = [...panel.querySelectorAll('.side')];
  const [buy, sell] = panel.querySelectorAll('.ticket-actions button');
  const balance = find('.ticket-balance strong');
  const input = find('input');
  const feedback = find('small');
  find('strong').textContent = /^(yes|no)$/i.test(item.label) ? marketTitle : item.label;
  find('.text-button').onclick = () => { panel.hidden = true; panel.replaceChildren(); };
  const yes = Math.round(price * 10000);
  const quoted = Number.isFinite(price) && yes > 0 && yes < 10000;
  let side = 0;
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
    if (account) balance.textContent = money.format(account.cash / 10000);
  }
  sides.forEach((button, index) => {
    button.textContent = sideName(index) + (quoted ? '  ' + (index ? 10000 - yes : yes) / 100 + '¢' : '');
    button.onclick = () => { side = index; feedback.textContent = ''; update(); };
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
  demoAccount().then(result => { account = result; update(); })
    .catch(() => { feedback.textContent = 'Could not load your cash balance.'; });
}
