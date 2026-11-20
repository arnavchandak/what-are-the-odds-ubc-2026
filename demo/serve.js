import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const port = 4178;
const root = new URL('../', import.meta.url);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/') {
    response.writeHead(302, { Location: '/demo/' }).end();
    return;
  }
  const file = path === '/demo/' ? '/demo/index.html' : path;
  const type = types[extname(file)];
  if (!type || !/^\/(?:demo\/)?[a-z][a-z0-9-]*\.(?:js|css|html)$/.test(file) || file.endsWith('/serve.js')) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL(file.slice(1), root));
    response.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(content);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Headline Odds judge preview: http://127.0.0.1:${port}/`));
