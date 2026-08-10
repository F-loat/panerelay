import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const HOST = '127.0.0.1';
const PORT = 43_919;
const COOKIE_NAME = 'panerelay_fetch_fixture';
const STORAGE_SECRET = 'panerelay-fetch-v3-local-storage-fixture';
const index = await readFile(new URL('./index.html', import.meta.url), 'utf8');
let storageRequestCount = 0;

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,HEAD,OPTIONS',
      'access-control-allow-origin': '*',
    });
    response.end();
    return;
  }
  if (url.pathname === '/') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(index);
    return;
  }
  if (url.pathname === '/redirect') {
    response.writeHead(302, { location: '/final' });
    response.end();
    return;
  }
  if (url.pathname === '/final') {
    json(response, 200, { final: true });
    return;
  }
  if (url.pathname === '/set-cookie') {
    json(
      response,
      200,
      { stored: true },
      { 'set-cookie': `${COOKIE_NAME}=fixture-cookie-value; Path=/; SameSite=Lax` },
    );
    return;
  }
  if (url.pathname === '/clear-cookie') {
    json(
      response,
      200,
      { cleared: true },
      { 'set-cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax` },
    );
    return;
  }
  if (url.pathname === '/cookie') {
    json(response, 200, {
      present: String(request.headers.cookie ?? '')
        .split(';')
        .some(value => value.trim().startsWith(`${COOKIE_NAME}=`)),
    });
    return;
  }
  if (url.pathname === '/metrics') {
    json(response, 200, { storageRequestCount });
    return;
  }
  if (url.pathname === '/storage/status') {
    storageRequestCount += 1;
    json(response, 200, {
      authorized: request.headers.authorization === `Bearer ${STORAGE_SECRET}`,
      reflected: request.headers.authorization ?? '',
    });
    return;
  }
  json(response, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`browser-fetch-v3 fixture ready at http://${HOST}:${PORT}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
