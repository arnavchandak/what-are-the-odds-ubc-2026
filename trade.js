import { demoAccount } from './workspace.js';

export function tradeTicket(panel, marketKey, item, price) {
  panel.replaceChildren();
  panel.hidden = false;
  const make = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
  const header = make('div', '');
  const close = make('button', '×');
  close.type = 'button';
  close.className = 'text-button';
  close.setAttribute('aria-label','Close demo trade');
  close.onclick = () => { panel.hidden = true; panel.replaceChildren(); };
  header.className = 'trade-line';
  header.append(make('strong', item.label), close);
  panel.append(header);
  const body = make('div','');
  panel.append(body);
  const yes = Math.round(price * 10000);
  if (!Number.isFinite(price) || yes <= 0 || yes >= 10000) {
    body.textContent = 'Demo trading needs a price between 0% and 100%.';
    return;
  }
  let side = 'Yes';
  let account;
  let busy = false;
  const choices = make('div','');
  choices.className = 'trade-line';
  choices.append(make('span','Demo trade'));
  const controls = make('div','');
  for (const name of ['Yes','No']) {
    const cents = (name === 'Yes' ? yes : 10000 - yes) / 100;
    const button = make('button', name + ' ' + cents + '¢');
    button.className = 'side ' + name.toLowerCase();
    button.onclick = () => { side = name; feedback.textContent = ''; update(); };
    controls.append(button);
  }
  choices.append(controls);
  const label = make('label','Shares ');
  const qty = document.createElement('input');
  Object.assign(qty, { type:'number', min:1, max:100000, step:1, value:'1' });
  label.append(qty);
  const actions = make('div','');
  actions.className = 'trade-line';
  actions.append(label);
  const buttons = make('div','');
  actions.append(buttons);
  const position = () => JSON.stringify([marketKey,item.historyId || item.label,side]);
  const balance = make('small','');
  const feedback = make('small','');
  feedback.setAttribute('role','status');
  function update() {
    const holding = account?.positions[position()] || 0;
    const units = qty.valueAsNumber;
    const unitPrice = side === 'Yes' ? yes : 10000 - yes;
    for (const [idx,button] of [...controls.children].entries()) {
      button.setAttribute('aria-pressed', String(side === ['Yes','No'][idx]));
      button.disabled = busy;
    }
    for (const button of buttons.children) {
      button.disabled = busy || !account || !qty.validity.valid || !Number.isInteger(units) ||
        (button.textContent === 'Buy' ? units * unitPrice > account.cash : units > holding);
    }
    if (account) balance.textContent = '$' + (account.cash / 10000).toFixed(2) + ' demo cash · ' + holding + ' ' + side + ' shares held';
  }
  for (const action of ['Buy','Sell']) {
    const button = make('button', action);
    button.onclick = async () => {
      busy = true;
      update();
      const quantity = qty.valueAsNumber;
      try {
        account = await demoAccount({ position: position(), action, price: side === 'Yes' ? yes : 10000 - yes, quantity });
        feedback.textContent = (action === 'Buy' ? 'Bought ' : 'Sold ') + quantity + ' ' + side + (quantity === 1 ? ' share.' : ' shares.');
      } catch (error) { feedback.textContent = error.message; }
      busy = false;
      update();
    };
    buttons.append(button);
  }
  qty.oninput = update;
  body.append(choices, actions, balance, feedback);
  update();
  demoAccount().then(result => { account = result; update(); }).catch(() => { feedback.textContent = 'Could not open your demo account.'; });
}
