const PREFIX = 'headline-odds:market-data:1:';
const POLICIES = {
  search: { ttl: 90_000, limit: 32, maxSize: 80_000 },
  history: { ttl: 5 * 60_000, limit: 100, maxSize: 8_000 },
};

export function marketCache(storage) {
  const pending = new Map();
  let cleanup = Promise.resolve();

  async function read(kind, keys) {
    const prefix = PREFIX + kind + ':';
    const entries = await storage.get(keys.map((key) => prefix + key)).catch(() => ({}));
    const now = Date.now();
    return new Map(keys.flatMap((key) => {
      const entry = entries[prefix + key];
      return entry && now - entry.at < POLICIES[kind].ttl ? [[key, entry.value]] : [];
    }));
  }

  async function write(kind, values) {
    const prefix = PREFIX + kind + ':';
    const { limit, maxSize } = POLICIES[kind];
    const at = Date.now();
    const updates = Object.fromEntries([...values]
      .filter(([, value]) => JSON.stringify(value).length <= maxSize)
      .map(([key, value]) => [prefix + key, { at, value }]));
    if (!Object.keys(updates).length) return;
    await storage.set(updates).catch(() => {});
    cleanup = cleanup.then(async () => {
      const keys = (await storage.getKeys()).filter((key) => key.startsWith(prefix));
      if (keys.length <= limit) return;
      const entries = await storage.get(keys);
      keys.sort((a, b) => (entries[b]?.at || 0) - (entries[a]?.at || 0));
      await storage.remove(keys.slice(limit));
    }).catch(() => {});
  }

  async function search(key, load, refresh = false) {
    if (!refresh) {
      const previous = await read('search', [key]);
      if (previous.has(key)) return previous.get(key);
    }
    if (!pending.has(key)) {
      pending.set(key, Promise.resolve().then(load).then(async (value) => {
        await write('search', new Map([[key, value]]));
        return value;
      }).finally(() => pending.delete(key)));
    }
    return pending.get(key);
  }

  return { read, write, search };
}
