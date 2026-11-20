// Both the popup and the standalone library share the extension origin.
let database;
async function transact(storeName, mode, action) {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('headline-odds-workspace', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('clips', { keyPath: 'id' });
      request.result.createObjectStore('accounts');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { database = undefined; throw error; });
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let value;
    let failure;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(failure || tx.error);
    action(tx.objectStore(storeName), result => { value = result; }, error => { failure = error; tx.abort(); });
  });
}

export function saveClip(clip) {
  return transact('clips', 'readwrite', store => store.add({ ...clip, id: crypto.randomUUID(), saved: Date.now() }));
}
export function listClips() {
  return transact('clips', 'readonly', (store, done) => {
    const req = store.getAll();
    req.onsuccess = () => done(req.result.sort((a,b) => b.saved - a.saved));
  });
}

export function demoAccount(order) {
  return transact('accounts', order ? 'readwrite' : 'readonly', (store, done, fail) => {
    const req = store.get('paper');
    req.onsuccess = () => {
      const account = req.result || { cash: 10000000, positions: {} }; // $1,000 in hundredths of a cent
      try {
        if (order) {
          const { position, action, price, amountCents } = order;
          const amount = amountCents * 100;
          if (!Number.isInteger(price) || price <= 0 || price >= 10000 ||
              !Number.isSafeInteger(amountCents) || !Number.isSafeInteger(amount) || amount <= 0 ||
              !['Buy','Sell'].includes(action)) throw Error('Enter a positive dollar amount in cents.');
          const holding = account.positions[position] || 0;
          if (action === 'Sell' && amount > Math.floor(holding * price + 1e-6)) throw Error('Amount exceeds the value held.');
          if (action === 'Buy' && amount > account.cash) throw Error('Amount exceeds your cash balance.');
          const debit = action === 'Buy' ? amount : -amount;
          account.cash -= debit;
          account.positions[position] = Math.max(0, holding + debit / price);
          store.put(account, 'paper');
        }
        done(account);
      } catch (error) { fail(error); }
    };
  });
}
