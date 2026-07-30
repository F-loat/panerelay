import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const requestedPort = Number.parseInt(process.env.PANERELAY_FIXTURE_PORT || '41731', 10);
const port =
  Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535
    ? requestedPort
    : 41_731;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function resolveFixturePath(pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(fixtureRoot, relativePath);
  if (filePath !== fixtureRoot && !filePath.startsWith(`${fixtureRoot}${sep}`)) return null;
  return filePath;
}

async function serveStatic(pathname, response) {
  const filePath = resolveFixturePath(pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-length': metadata.size,
      'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

  if (requestUrl.pathname === '/api/echo-headers') {
    sendJson(response, 200, {
      acceptance:
        typeof request.headers['x-panerelay-acceptance'] === 'string'
          ? request.headers['x-panerelay-acceptance']
          : null,
      language:
        typeof request.headers['accept-language'] === 'string'
          ? request.headers['accept-language']
          : null,
    });
    return;
  }

  if (requestUrl.pathname === '/api/auth') {
    const expected = `Basic ${Buffer.from('panerelay:fixture').toString('base64')}`;
    if (request.headers.authorization !== expected) {
      sendJson(
        response,
        401,
        { authenticated: false },
        { 'www-authenticate': 'Basic realm="fixture"' },
      );
      return;
    }
    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (requestUrl.pathname === '/api/download') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="panerelay-download.txt"',
      'content-type': 'text/plain; charset=utf-8',
    });
    createReadStream(resolve(fixtureRoot, 'download.txt')).pipe(response);
    return;
  }

  if (requestUrl.pathname === '/api/slow') {
    const requestedDelay = Number.parseInt(requestUrl.searchParams.get('ms') || '250', 10);
    const delay = Math.min(
      Math.max(Number.isFinite(requestedDelay) ? requestedDelay : 250, 0),
      5_000,
    );
    setTimeout(() => sendJson(response, 200, { delayed: delay }), delay);
    return;
  }

  await serveStatic(requestUrl.pathname, response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Panerelay fixture listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
