// Chrome serializes this function when injecting it into the active tab.
export function readArticle() {
  const heading = document.querySelector('article h1, main h1, [role="main"] h1')
    || document.querySelector('h1');
  const title = (heading?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 260);
  const date = document.querySelector('meta[property="article:published_time"]')
    || document.querySelector('meta[itemprop="datePublished"]')
    || document.querySelector('article time[datetime]');
  const published = Date.parse(date?.getAttribute('content') || date?.getAttribute('datetime'));
  const publishedAt = Number.isFinite(published) ? new Date(published).toISOString() : undefined;
  const roots = [
    ...document.querySelectorAll('article'),
    ...document.querySelectorAll('[role="main"], main'),
    document.body,
  ];
  const selectors = 'p, h2, h3, blockquote';
  const ignored = 'aside, nav, footer, dialog, [role="dialog"], [hidden], [aria-hidden="true"]';

  for (const root of roots) {
    if (!root) continue;
    const paragraphs = new Set();
    let size = 0;
    for (const node of root.querySelectorAll(selectors)) {
      if (node.closest(ignored) || !node.getClientRects().length) continue;
      const line = node.textContent.replace(/\s+/g, ' ').trim().slice(0, 1400);
      if (line.length < 24 || paragraphs.has(line)) continue;
      paragraphs.add(line);
      size += line.length;
      if (size >= 5000) break;
    }
    if (size >= 140) {
      return { url: location.href, title, publishedAt, text: [...paragraphs].join('\n').slice(0, 5000) };
    }
  }
  return null;
}
