import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const primaryPort = parsePort(process.env.PANERELAY_BROWSER_USE_FIXTURE_PORT, 41_741);
const crossOriginPort = parsePort(process.env.PANERELAY_BROWSER_USE_CROSS_ORIGIN_PORT, 41_742);
const crossSitePort = parsePort(process.env.PANERELAY_BROWSER_USE_CROSS_SITE_PORT, 41_743);
const crossSiteHost = process.env.PANERELAY_BROWSER_USE_CROSS_SITE_HOST || '127.0.0.2';

if (new Set([primaryPort, crossOriginPort, crossSitePort]).size !== 3) {
  throw new Error('Primary, cross-origin, and cross-site fixture ports must differ');
}

let chromeDebuggerProbeResult;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function parsePort(raw, fallback) {
  const value = Number.parseInt(raw || String(fallback), 10);
  return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : fallback;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(value));
}

function resolveFixturePath(pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(fixtureRoot, relativePath);
  if (filePath !== fixtureRoot && !filePath.startsWith(`${fixtureRoot}${sep}`)) return null;
  return filePath;
}

async function serveStatic(pathname, response, replacements = new Map()) {
  const filePath = resolveFixturePath(pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error('Not a file');
    const contentType = contentTypes.get(extname(filePath)) || 'application/octet-stream';
    if (replacements.size > 0 && contentType.startsWith('text/html')) {
      let body = await readFile(filePath, 'utf8');
      for (const [from, to] of replacements) body = body.replaceAll(from, to);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
        'content-type': contentType,
      });
      response.end(body);
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-length': metadata.size,
      'content-type': contentType,
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const primaryServer = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

  if (requestUrl.pathname === '/api/chrome-debugger-result') {
    if (request.method === 'GET') {
      sendJson(
        response,
        chromeDebuggerProbeResult === undefined ? 404 : 200,
        chromeDebuggerProbeResult ?? { status: 'pending' },
      );
      return;
    }
    if (request.method === 'DELETE') {
      chromeDebuggerProbeResult = undefined;
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }
    if (request.method === 'POST') {
      const chunks = [];
      let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 16 * 1024) {
          sendJson(response, 413, { error: 'Result too large' });
          return;
        }
        chunks.push(chunk);
      }
      try {
        chromeDebuggerProbeResult = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        sendJson(response, 202, { accepted: true });
      } catch {
        sendJson(response, 400, { error: 'Invalid JSON' });
      }
      return;
    }
    response.writeHead(405, { allow: 'DELETE, GET, POST' });
    response.end();
    return;
  }

  if (requestUrl.pathname === '/api/delay') {
    const requested = Number.parseInt(requestUrl.searchParams.get('ms') || '250', 10);
    const delay = Math.min(Math.max(Number.isFinite(requested) ? requested : 250, 0), 1_000);
    setTimeout(() => sendJson(response, 200, { delayed: delay }), delay);
    return;
  }

  if (requestUrl.pathname === '/api/download') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="browser-use-spike.txt"',
      'content-type': 'text/plain; charset=utf-8',
    });
    createReadStream(resolve(fixtureRoot, 'download.txt')).pipe(response);
    return;
  }

  await serveStatic(
    requestUrl.pathname,
    response,
    new Map([
      ['__CROSS_ORIGIN__', `http://127.0.0.1:${crossOriginPort}`],
      ['__CROSS_SITE__', `http://${crossSiteHost}:${crossSitePort}`],
    ]),
  );
});

const crossOriginServer = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  const allowed = new Set(['/cross-frame.html', '/boundary.html']);
  if (!allowed.has(requestUrl.pathname)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  await serveStatic(requestUrl.pathname, response);
});

const crossSiteServer = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || crossSiteHost}`);
  if (requestUrl.pathname !== '/cross-frame.html') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  await serveStatic(requestUrl.pathname, response);
});

await Promise.all([
  new Promise((resolveReady, reject) => {
    primaryServer.once('listening', resolveReady);
    primaryServer.once('error', reject);
    primaryServer.listen(primaryPort, '127.0.0.1');
  }),
  new Promise((resolveReady, reject) => {
    crossOriginServer.once('listening', resolveReady);
    crossOriginServer.once('error', reject);
    crossOriginServer.listen(crossOriginPort, '127.0.0.1');
  }),
  new Promise((resolveReady, reject) => {
    crossSiteServer.once('listening', resolveReady);
    crossSiteServer.once('error', reject);
    crossSiteServer.listen(crossSitePort, crossSiteHost);
  }),
]);

console.log(`Browser Use fixture: http://127.0.0.1:${primaryPort}/`);
console.log(`Cross-origin fixture: http://127.0.0.1:${crossOriginPort}/`);
console.log(`Cross-site iframe fixture: http://${crossSiteHost}:${crossSitePort}/cross-frame.html`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    Promise.all([
      new Promise(resolveClosed => primaryServer.close(resolveClosed)),
      new Promise(resolveClosed => crossOriginServer.close(resolveClosed)),
      new Promise(resolveClosed => crossSiteServer.close(resolveClosed)),
    ]).then(() => process.exit(0));
  });
}
