import { spawn } from 'node:child_process';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket, { WebSocketServer } from '../../packages/bridge/node_modules/ws/wrapper.mjs';
import { selectBrowserRegistration } from '../../packages/browser-registry/dist/index.js';
import { PANERELAY_PROTOCOL_VERSION } from '../../packages/protocol/dist/index.js';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const runId = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const evidenceDirectory = resolve(
  process.env.PANERELAY_BROWSER_USE_EVIDENCE_DIR ||
    resolve(homedir(), 'verify-evidence', 'panerelay', 'browser-use-0.13.7', runId),
);
const evidenceRelativeToRepository = relative(repositoryRoot, evidenceDirectory);
const pythonExecutable = process.env.PANERELAY_BROWSER_USE_PYTHON;
const scenario = process.env.PANERELAY_BROWSER_USE_SCENARIO || 'initialization';
const expectedBrowserUseVersion = '0.13.7';
const expectedBrowserHarnessVersion = '0.1.8';
const maximumTraceEntries = 10_000;
const trace = [];
const pendingMethods = new Map();
const opaqueValues = new Map();
let traceSequence = 0;
let opaqueSequence = 0;
let traceTruncated = false;

if (!evidenceRelativeToRepository.startsWith('..') && !isAbsolute(evidenceRelativeToRepository)) {
  throw new Error('PANERELAY_BROWSER_USE_EVIDENCE_DIR must be outside the repository');
}
if (!pythonExecutable) {
  throw new Error('Set PANERELAY_BROWSER_USE_PYTHON to the pinned temporary Python executable');
}
if (!new Set(['initialization', 'fixture']).has(scenario)) {
  throw new Error('PANERELAY_BROWSER_USE_SCENARIO must be initialization or fixture');
}

const browserUseExecutable = resolve(dirname(pythonExecutable), 'browser-use');
const fixtureUrl = new URL(
  process.env.PANERELAY_BROWSER_USE_FIXTURE_URL || 'http://127.0.0.1:41741/',
);
const crossSiteUrl = new URL(
  process.env.PANERELAY_BROWSER_USE_CROSS_SITE_URL || 'http://localhost:41743/',
);
if (fixtureUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(fixtureUrl.hostname)) {
  throw new Error('PANERELAY_BROWSER_USE_FIXTURE_URL must be a loopback HTTP URL');
}
if (
  crossSiteUrl.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost'].includes(crossSiteUrl.hostname)
) {
  throw new Error('PANERELAY_BROWSER_USE_CROSS_SITE_URL must be a loopback HTTP URL');
}
const fixtureUploadPath = resolve(
  repositoryRoot,
  'docs/spikes/fixtures/browser-use-0.13.7/upload.txt',
);
await Promise.all([
  access(pythonExecutable),
  access(browserUseExecutable),
  access(fixtureUploadPath),
]);
await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
const runtimeDirectory = resolve(evidenceDirectory, 'runtime');
const temporaryDirectory = resolve(evidenceDirectory, 'tmp');
await Promise.all([
  mkdir(runtimeDirectory, { recursive: true, mode: 0o700 }),
  mkdir(temporaryDirectory, { recursive: true, mode: 0o700 }),
]);

function addTrace(entry) {
  if (trace.length >= maximumTraceEntries) {
    traceTruncated = true;
    return;
  }
  trace.push({ sequence: ++traceSequence, ...entry });
}

function opaque(kind, value) {
  if (value === undefined || value === null) return value;
  const key = `${kind}:${String(value)}`;
  if (!opaqueValues.has(key)) opaqueValues.set(key, `${kind}-${++opaqueSequence}`);
  return opaqueValues.get(key);
}

function urlLabel(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'about:' && url.pathname === 'blank') return 'about:blank';
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return `loopback:${url.port || 'default'}${url.pathname}`;
    }
    return `${url.protocol}//<redacted-host>/`;
  } catch {
    return '<redacted-url>';
  }
}

const identifierKinds = new Map([
  ['targetId', 'target'],
  ['sessionId', 'session'],
  ['browserContextId', 'context'],
  ['frameId', 'frame'],
  ['parentFrameId', 'frame'],
  ['loaderId', 'loader'],
  ['requestId', 'request'],
  ['interceptionId', 'interception'],
  ['executionContextId', 'execution-context'],
  ['objectId', 'object'],
  ['nodeId', 'node'],
  ['backendNodeId', 'backend-node'],
  ['scriptId', 'script'],
  ['uniqueId', 'unique'],
]);
const safeStringKeys = new Set([
  'type',
  'format',
  'transferMode',
  'mode',
  'state',
  'button',
  'resourceType',
  'transitionType',
]);
const safeKeyboardValues = new Set([
  'Alt',
  'Backspace',
  'Control',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'Meta',
  'PageDown',
  'PageUp',
  'Shift',
  'Tab',
]);
const urlKeys = new Set(['url', 'unreachableUrl', 'documentURL']);
const binaryKeys = new Set(['data', 'body', 'postData', 'bytes']);
const excludedContentKeys = new Map([
  ['associatedCookies', '<redacted-cookie-metadata>'],
  ['cookie', '<redacted-cookie>'],
  ['cookies', '<redacted-cookies>'],
  ['headers', '<redacted-headers>'],
  ['postDataEntries', '<redacted-request-body>'],
  ['requestHeaders', '<redacted-headers>'],
  ['responseHeaders', '<redacted-headers>'],
]);
const timeKeys = new Set(['timestamp', 'wallTime', 'requestTime']);

function sanitize(value, key = '', depth = 0) {
  if (depth > 8) return '<max-depth>';
  if (excludedContentKeys.has(key)) return excludedContentKeys.get(key);
  if (timeKeys.has(key) && typeof value === 'number') return '<redacted-time>';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const identifierKind = identifierKinds.get(key);
    if (identifierKind) return opaque(identifierKind, value);
    if (urlKeys.has(key) || key.toLowerCase().includes('url')) return urlLabel(value);
    if (binaryKeys.has(key)) return '<redacted-bytes>';
    if (key === 'key' || key === 'code') {
      return safeKeyboardValues.has(value) ? value : `<redacted-${key}>`;
    }
    if (safeStringKeys.has(key) && value.length <= 128) return value;
    return '<redacted-string>';
  }
  if (Array.isArray(value)) {
    const retained = value.slice(0, 64).map(item => sanitize(item, key, depth + 1));
    if (value.length > retained.length)
      retained.push(`<truncated:${value.length - retained.length}>`);
    return retained;
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = sanitize(childValue, childKey, depth + 1);
    }
    return output;
  }
  return `<${typeof value}>`;
}

function recordClientMessage(data) {
  try {
    const message = JSON.parse(data.toString());
    if (typeof message.id === 'number' && typeof message.method === 'string') {
      pendingMethods.set(message.id, message.method);
    }
    addTrace({
      direction: 'client-to-relay',
      id: typeof message.id === 'number' ? message.id : undefined,
      method: typeof message.method === 'string' ? message.method : '<unknown>',
      sessionId:
        typeof message.sessionId === 'string' ? opaque('session', message.sessionId) : undefined,
      params: sanitize(message.params || {}),
    });
  } catch {
    addTrace({ direction: 'client-to-relay', malformed: true });
  }
}

function recordRelayMessage(data) {
  try {
    const message = JSON.parse(data.toString());
    if (typeof message.id === 'number') {
      const method = pendingMethods.get(message.id);
      pendingMethods.delete(message.id);
      addTrace({
        direction: 'relay-to-client',
        id: message.id,
        method: method || '<unknown-response>',
        sessionId:
          typeof message.sessionId === 'string' ? opaque('session', message.sessionId) : undefined,
        ...(message.error
          ? { error: sanitize(message.error) }
          : { result: sanitize(message.result) }),
      });
      return;
    }
    addTrace({
      direction: 'relay-event',
      method: typeof message.method === 'string' ? message.method : '<unknown-event>',
      sessionId:
        typeof message.sessionId === 'string' ? opaque('session', message.sessionId) : undefined,
      params: sanitize(message.params || {}),
    });
  } catch {
    addTrace({ direction: 'relay-to-client', malformed: true });
  }
}

function runProcess(command, argumentsList, environment, input = '') {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const outputLimit = 64 * 1024;
    child.stdout.on('data', chunk => {
      if (stdout.length < outputLimit) stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < outputLimit) stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (status, signal) => {
      resolveProcess({ status, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function releaseParticipant() {
  if (releaseStatus !== undefined) return releaseStatus;
  try {
    const response = await fetch(
      `http://127.0.0.1:${bridge.port}/sessions/${encodeURIComponent(participant.sessionId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${bridge.token}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    releaseStatus = response.status;
  } catch {
    releaseStatus = 'bridge-unavailable';
  }
  return releaseStatus;
}

async function packageVersion(distribution) {
  const result = await runProcess(
    pythonExecutable,
    ['-c', `import importlib.metadata as m; print(m.version(${JSON.stringify(distribution)}))`],
    {},
  );
  if (result.status !== 0) throw new Error(`Could not resolve ${distribution} version`);
  return result.stdout.trim();
}

const [browserUseVersion, browserHarnessVersion] = await Promise.all([
  packageVersion('browser-use'),
  packageVersion('browser-harness'),
]);
if (
  browserUseVersion !== expectedBrowserUseVersion ||
  browserHarnessVersion !== expectedBrowserHarnessVersion
) {
  throw new Error(
    `Expected browser-use ${expectedBrowserUseVersion} / browser-harness ${expectedBrowserHarnessVersion}; ` +
      `received ${browserUseVersion} / ${browserHarnessVersion}`,
  );
}

const selection = await selectBrowserRegistration();
const bridge = selection.state;
if (bridge.capabilities?.cdpRelay === false) {
  throw new Error(`${bridge.browserName} registration does not provide the CDP relay capability`);
}

const createResponse = await fetch(`http://127.0.0.1:${bridge.port}/sessions`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${bridge.token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    protocol: PANERELAY_PROTOCOL_VERSION,
    actor: {
      kind: 'automation',
      name: 'Browser Use spike',
      sessionLabel: `browser-use-0.13.7-${scenario}`,
    },
  }),
  signal: AbortSignal.timeout(5_000),
});
const participant = await createResponse.json();
if (
  createResponse.status !== 201 ||
  participant.protocol !== PANERELAY_PROTOCOL_VERSION ||
  typeof participant.sessionId !== 'string' ||
  typeof participant.cdpUrl !== 'string'
) {
  throw new Error(
    participant.error || `Panerelay participant allocation failed (${createResponse.status})`,
  );
}

let upstreamClient;
let downstreamClient;
let websocketAccepted = false;
let commandResult;
let reuseResult;
let fixtureCleanupResult;
let concurrentResults;
let revocationResult;
let reloadResult;
let releaseStatus;
let probeResults;
let bootstrapCountAfterHealthyReuse;
const webSocketServer = new WebSocketServer({ noServer: true });
const bootstrapServer = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/json/version') {
    response.writeHead(404, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  addTrace({ direction: 'http-bootstrap', method: 'GET', path: '/json/version' });
  const address = bootstrapServer.address();
  if (!address || typeof address === 'string') {
    response.writeHead(503);
    response.end();
    return;
  }
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(
    JSON.stringify({
      Browser: 'Panerelay Browser Use spike',
      'Protocol-Version': '1.3',
      webSocketDebuggerUrl: `ws://127.0.0.1:${address.port}/devtools/browser/panerelay-spike`,
    }),
  );
});

bootstrapServer.on('upgrade', (request, socket, head) => {
  if (
    websocketAccepted ||
    request.url !== '/devtools/browser/panerelay-spike' ||
    request.headers.origin
  ) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  websocketAccepted = true;
  upstreamClient = new WebSocket(participant.cdpUrl, { autoPong: false });
  upstreamClient.once('open', () => {
    webSocketServer.handleUpgrade(request, socket, head, client => {
      webSocketServer.emit('connection', client);
    });
  });
  upstreamClient.once('error', () => {
    if (!socket.destroyed) socket.destroy();
  });
});

webSocketServer.on('connection', client => {
  downstreamClient = client;
  addTrace({ direction: 'websocket', state: 'connected' });
  client.on('message', data => {
    recordClientMessage(data);
    if (upstreamClient?.readyState === WebSocket.OPEN) upstreamClient.send(data);
  });
  client.on('pong', data => {
    if (upstreamClient?.readyState === WebSocket.OPEN) upstreamClient.pong(data);
  });
  upstreamClient.on('ping', data => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping(data);
    } else {
      upstreamClient.close(1011);
    }
  });
  upstreamClient.on('message', data => {
    recordRelayMessage(data);
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
  client.once('close', (code, reason) => {
    addTrace({
      direction: 'websocket',
      state: 'client-closed',
      code,
      reason: reason.length > 0 ? '<redacted>' : '',
    });
    if (upstreamClient?.readyState === WebSocket.OPEN) upstreamClient.close(1000);
  });
  upstreamClient.once('close', (code, reason) => {
    addTrace({
      direction: 'websocket',
      state: 'relay-closed',
      code,
      reason: reason.length > 0 ? '<redacted>' : '',
    });
    if (client.readyState === WebSocket.OPEN) {
      const forwardedCode =
        code >= 1000 && code <= 4999 && ![1005, 1006, 1015].includes(code) ? code : 1011;
      client.close(forwardedCode);
    }
  });
});

try {
  await new Promise((resolveReady, reject) => {
    bootstrapServer.once('listening', resolveReady);
    bootstrapServer.once('error', reject);
    bootstrapServer.listen(0, '127.0.0.1');
  });
  const bootstrapAddress = bootstrapServer.address();
  if (!bootstrapAddress || typeof bootstrapAddress === 'string') {
    throw new Error('Temporary CDP bootstrap did not bind to loopback');
  }

  const harnessEnvironment = {
    BH_DOMAIN_SKILLS: '0',
    BH_RECORD: '0',
    BH_RUNTIME_DIR: runtimeDirectory,
    BH_RUNTIME_DIR_SHARED: '0',
    BH_TMP_DIR: temporaryDirectory,
    BU_CDP_URL: `http://127.0.0.1:${bootstrapAddress.port}`,
    BU_NAME: 'panerelay-browser-use-spike',
    DO_NOT_TRACK: '1',
    NO_COLOR: '1',
  };

  const fixtureCode = [
    'import json, os, time',
    'results = {}',
    'created_targets = []',
    'fixture_target = None',
    'popup_target = None',
    'def probe(name, action):',
    '    try:',
    '        action()',
    '        if name not in results:',
    '            results[name] = "Verified"',
    '    except Exception:',
    '        results[name] = "Failed"',
    'def denied(name, action, expected):',
    '    try:',
    '        action()',
    '        results[name] = "UnexpectedSuccess"',
    '    except Exception as error:',
    '        results[name] = "Unsupported" if expected in str(error) else "Failed"',
    'def click_selector(selector):',
    '    point = js(f"(()=>{{const r=document.querySelector({json.dumps(selector)}).getBoundingClientRect();return {{x:r.left+r.width/2,y:r.top+r.height/2}}}})()")',
    '    click_at_xy(point["x"], point["y"])',
    'def open_fixture():',
    '    global fixture_target',
    `    fixture_target = new_tab(${JSON.stringify(fixtureUrl.href)})`,
    '    created_targets.append(fixture_target)',
    '    assert wait_for_load()',
    `    assert page_info()["url"].startswith(${JSON.stringify(fixtureUrl.origin)})`,
    'probe("navigation", open_fixture)',
    'def form_interaction():',
    '    expected = "browser-use-spike"',
    "    js(\"(()=>{window.__panerelayProbe={};for(const name of ['keydown','keypress','keyup','input','change','mousedown','mouseup','click','submit']){window.__panerelayProbe[name]=0;document.addEventListener(name,()=>window.__panerelayProbe[name]++,true)}})()\")",
    '    fill_input("#fixture-value", expected)',
    '    actual = js("document.querySelector(\'#fixture-value\').value")',
    '    results["formObservedLength"] = len(actual)',
    '    results["formObservedEmpty"] = actual == ""',
    '    results["formObservedExpected"] = actual == expected',
    '    results["formObservedDoubled"] = actual == "".join(character * 2 for character in expected)',
    '    results["formFocusedAfterFill"] = js("document.activeElement && document.activeElement.id") == "fixture-value"',
    '    results["formDocumentHasFocus"] = js("document.hasFocus()")',
    '    initial_input_failed = actual != expected',
    "    reset_input = \"(()=>{const input=document.querySelector('#fixture-value');input.value='';input.focus();for(const name of Object.keys(window.__panerelayProbe)){window.__panerelayProbe[name]=0}})()\"",
    '    if initial_input_failed:',
    '        cdp("Input.setIgnoreInputEvents", ignore=False)',
    '        js(reset_input)',
    '        fill_input("#fixture-value", expected)',
    '        actual = js("document.querySelector(\'#fixture-value\').value")',
    '        results["formAfterIgnoreInputReset"] = actual == expected',
    '    if actual != expected:',
    '        cdp("Emulation.setFocusEmulationEnabled", enabled=True)',
    '        js(reset_input)',
    '        fill_input("#fixture-value", expected)',
    '        actual = js("document.querySelector(\'#fixture-value\').value")',
    '        results["formAfterFocusEmulation"] = actual == expected',
    '    if actual != expected:',
    '        type_text(expected)',
    '        actual = js("document.querySelector(\'#fixture-value\').value")',
    '        results["formObservedAfterInsertLength"] = len(actual)',
    '        results["formObservedAfterInsertEmpty"] = actual == ""',
    '    if actual != expected:',
    '        results["formInteraction"] = "Partial"',
    '        return',
    '    submit_point = js("(()=>{const r=document.querySelector(\'#submit\').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()")',
    '    results["formSubmitHitTarget"] = js(f"document.elementFromPoint({submit_point[\'x\']},{submit_point[\'y\']}).id") == "submit"',
    '    click_selector("#submit")',
    '    time.sleep(0.1)',
    '    if js("(window.__panerelayProbe && window.__panerelayProbe.click) || 0") == 0:',
    '        results["formMouseFirstIgnored"] = True',
    '        click_selector("#submit")',
    '        time.sleep(0.1)',
    '    event_counts = js("window.__panerelayProbe")',
    '    for event_name, event_count in event_counts.items():',
    '        results["formEvent" + event_name.title()] = event_count',
    '    submitted = js("document.querySelector(\'#status\').textContent") == "Submitted: browser-use-spike"',
    '    results["formSubmitObserved"] = submitted',
    '    if initial_input_failed or not submitted:',
    '        results["formInteraction"] = "Partial"',
    'probe("formInteraction", form_interaction)',
    'def same_origin_frame():',
    "    value = js(\"document.querySelector('#same-origin-frame').contentDocument.querySelector('#same-frame-value').value\")",
    '    assert value == "same-origin"',
    'probe("sameOriginFrame", same_origin_frame)',
    'def screenshot():',
    `    path = capture_screenshot(${JSON.stringify(resolve(temporaryDirectory, 'fixture.png'))})`,
    '    assert os.path.getsize(path) > 0',
    'probe("screenshot", screenshot)',
    'def upload():',
    `    upload_file("#upload", ${JSON.stringify(fixtureUploadPath)})`,
    '    assert js("document.querySelector(\'#upload\').files[0].name") == "upload.txt"',
    'probe("upload", upload)',
    'def popup():',
    '    global popup_target',
    '    assert not [tab for tab in list_tabs() if tab.get("url", "").endswith("/popup.html")]',
    '    before_clicks = js("(window.__panerelayProbe && window.__panerelayProbe.click) || 0")',
    '    click_selector("#popup")',
    '    assert js("(window.__panerelayProbe && window.__panerelayProbe.click) || 0") > before_clicks',
    '    deadline = time.time() + 5',
    '    while time.time() < deadline:',
    '        matches = [tab for tab in list_tabs() if tab.get("url", "").endswith("/popup.html")]',
    '        if matches:',
    '            popup_target = matches[0]["targetId"]',
    '            break',
    '        time.sleep(0.1)',
    '    assert popup_target',
    '    created_targets.append(popup_target)',
    '    switch_tab(popup_target)',
    '    assert "popup" in page_info()["title"].lower()',
    '    close_tab(popup_target)',
    '    created_targets.remove(popup_target)',
    '    switch_tab(fixture_target)',
    'probe("popup", popup)',
    'def tab_navigation():',
    `    goto_url(${JSON.stringify(new URL('complete.html', fixtureUrl).href)})`,
    '    assert wait_for_load()',
    '    assert js("document.querySelector(\'h1\').textContent") == "Navigation complete"',
    `    goto_url(${JSON.stringify(fixtureUrl.href)})`,
    '    assert wait_for_load()',
    'probe("tabLifecycle", tab_navigation)',
    'def cross_origin_frame():',
    `    goto_url(${JSON.stringify(new URL('oopif.html', fixtureUrl).href)})`,
    '    assert wait_for_load()',
    '    deadline = time.time() + 3',
    '    target = None',
    '    while time.time() < deadline:',
    `        target = iframe_target(${JSON.stringify(crossSiteUrl.host)})`,
    '        if target:',
    '            break',
    '        time.sleep(0.1)',
    '    if not target:',
    '        results["crossOriginFrame"] = "Unsupported"',
    '        return',
    '    try:',
    '        assert js("document.querySelector(\'#cross-frame-value\').value", target_id=target) == "cross-origin"',
    '        results["crossOriginFrame"] = "Verified"',
    '    except Exception:',
    '        results["crossOriginFrame"] = "Failed"',
    'cross_origin_frame()',
    'denied(',
    '    "downloadBehavior",',
    `    lambda: cdp("Browser.setDownloadBehavior", behavior="allow", downloadPath=${JSON.stringify(temporaryDirectory)}),`,
    '    "browser-process ownership",',
    ')',
    'denied("isolatedContext", lambda: cdp("Target.createBrowserContext"), "not supported")',
    'denied("wholeProfileCookies", lambda: cdp("Storage.getCookies"), "entire daily Chrome profile")',
    'print(json.dumps(results, sort_keys=True))',
    '',
  ].join('\n');

  addTrace({ direction: 'phase', name: scenario });
  commandResult = await runProcess(
    browserUseExecutable,
    [],
    harnessEnvironment,
    scenario === 'fixture' ? fixtureCode : 'print("browser-use-initialized")\n',
  );
  if (scenario === 'fixture') {
    const lastLine = commandResult.stdout.trim().split('\n').filter(Boolean).at(-1);
    try {
      probeResults = JSON.parse(lastLine || '');
    } catch {
      probeResults = { runnerOutput: 'Failed' };
    }
  }

  addTrace({ direction: 'phase', name: 'healthy-daemon-reuse-and-unsupported-browser-method' });
  reuseResult = await runProcess(
    browserUseExecutable,
    [],
    {
      ...harnessEnvironment,
      BU_CDP_URL: 'http://127.0.0.1:9/replacement-must-be-ignored',
    },
    [
      'try:',
      '    cdp("Browser.close")',
      'except Exception as error:',
      '    assert "browser-process ownership" in str(error)',
      '    print("browser-ownership-rejected")',
      'else:',
      '    raise AssertionError("Browser.close unexpectedly succeeded")',
      '',
    ].join('\n'),
  );
  bootstrapCountAfterHealthyReuse = trace.filter(
    entry => entry.direction === 'http-bootstrap',
  ).length;
  if (scenario === 'fixture') {
    addTrace({ direction: 'phase', name: 'fixture-tab-cleanup' });
    fixtureCleanupResult = await runProcess(
      browserUseExecutable,
      [],
      harnessEnvironment,
      [
        `fixture_origin = ${JSON.stringify(fixtureUrl.origin)}`,
        'for tab in list_tabs():',
        '    if tab.get("url", "").startswith(fixture_origin):',
        '        try:',
        '            close_tab(tab)',
        '        except Exception:',
        '            pass',
        'print("fixture-tabs-cleaned")',
        '',
      ].join('\n'),
    );
  }
  addTrace({ direction: 'phase', name: 'simultaneous-shared-daemon-invocation' });
  concurrentResults = await Promise.all(
    ['a', 'b'].map(label =>
      runProcess(
        browserUseExecutable,
        [],
        harnessEnvironment,
        [
          'import time',
          'assert isinstance(list_tabs(), list)',
          'time.sleep(0.2)',
          `print(${JSON.stringify(`concurrent-${label}`)})`,
          '',
        ].join('\n'),
      ),
    ),
  );
  addTrace({ direction: 'phase', name: 'participant-revocation' });
  await releaseParticipant();
  if (upstreamClient?.readyState !== WebSocket.CLOSED) {
    await Promise.race([
      new Promise(resolveClose => upstreamClient?.once('close', resolveClose)),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 2_000)),
    ]);
  }
  revocationResult = await runProcess(
    browserUseExecutable,
    [],
    harnessEnvironment,
    'print("unexpected-command-after-revocation")\n',
  );
  reloadResult = await runProcess(browserUseExecutable, ['--reload'], harnessEnvironment);
} finally {
  if (downstreamClient?.readyState === WebSocket.OPEN) downstreamClient.close(1000);
  if (upstreamClient?.readyState === WebSocket.OPEN) upstreamClient.close(1000);
  await new Promise(resolveClosed => bootstrapServer.close(resolveClosed));
  webSocketServer.close();
  await releaseParticipant();
  await Promise.all([
    rm(runtimeDirectory, { recursive: true, force: true }),
    rm(temporaryDirectory, { recursive: true, force: true }),
  ]);
}

const result = {
  schema: 'panerelay.browser-use-spike.v1',
  scenario,
  recordedAt: new Date().toISOString(),
  versions: {
    browserUse: browserUseVersion,
    browserHarness: browserHarnessVersion,
    panerelayProtocol: PANERELAY_PROTOCOL_VERSION,
  },
  browser: {
    family: bridge.browserFamily || 'unknown',
    extensionVersion: bridge.extensionReleaseVersion,
    selectionSource: selection.source,
  },
  bootstrap: {
    requestCount: trace.filter(entry => entry.direction === 'http-bootstrap').length,
    websocketAccepted,
  },
  command: {
    status: commandResult?.status,
    signal: commandResult?.signal,
    stdoutMatched:
      scenario === 'fixture'
        ? Boolean(probeResults) && !('runnerOutput' in probeResults)
        : commandResult?.stdout.trim() === 'browser-use-initialized',
    stdoutBytes: Buffer.byteLength(commandResult?.stdout || ''),
    stderrBytes: Buffer.byteLength(commandResult?.stderr || ''),
    ...(scenario === 'fixture' ? { probes: probeResults } : {}),
  },
  healthyDaemonReuse: {
    status: reuseResult?.status,
    signal: reuseResult?.signal,
    stdoutMatched: reuseResult?.stdout.trim() === 'browser-ownership-rejected',
    stdoutBytes: Buffer.byteLength(reuseResult?.stdout || ''),
    stderrBytes: Buffer.byteLength(reuseResult?.stderr || ''),
    replacementBootstrapIgnored: bootstrapCountAfterHealthyReuse === 1,
  },
  ...(scenario === 'fixture'
    ? {
        fixtureCleanup: {
          status: fixtureCleanupResult?.status,
          signal: fixtureCleanupResult?.signal,
          stdoutMatched: fixtureCleanupResult?.stdout.trim() === 'fixture-tabs-cleaned',
          stdoutBytes: Buffer.byteLength(fixtureCleanupResult?.stdout || ''),
          stderrBytes: Buffer.byteLength(fixtureCleanupResult?.stderr || ''),
        },
      }
    : {}),
  simultaneousInvocation: (concurrentResults || []).map((processResult, index) => ({
    label: index === 0 ? 'a' : 'b',
    status: processResult.status,
    signal: processResult.signal,
    stdoutMatched: processResult.stdout.trim() === `concurrent-${index === 0 ? 'a' : 'b'}`,
    stdoutBytes: Buffer.byteLength(processResult.stdout || ''),
    stderrBytes: Buffer.byteLength(processResult.stderr || ''),
  })),
  revocation: {
    releaseStatus,
    commandStatus: revocationResult?.status,
    commandSignal: revocationResult?.signal,
    commandRejected:
      revocationResult?.status !== 0 &&
      !revocationResult?.stdout.includes('unexpected-command-after-revocation'),
    stdoutBytes: Buffer.byteLength(revocationResult?.stdout || ''),
    stderrBytes: Buffer.byteLength(revocationResult?.stderr || ''),
  },
  reload: {
    status: reloadResult?.status,
    signal: reloadResult?.signal,
    stdoutMatched: reloadResult?.stdout.includes('daemon stopped'),
    stdoutBytes: Buffer.byteLength(reloadResult?.stdout || ''),
    stderrBytes: Buffer.byteLength(reloadResult?.stderr || ''),
  },
  cleanup: {
    releaseStatus,
    runtimeRemoved: true,
  },
  traceTruncated,
  trace,
};

await writeFile(
  resolve(evidenceDirectory, `${scenario}-trace.json`),
  `${JSON.stringify(result, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(`Browser Use ${scenario}: ${commandResult?.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(`Healthy daemon reuse: ${reuseResult?.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(
  `Simultaneous shared-daemon invocation: ${
    concurrentResults?.every(processResult => processResult.status === 0) ? 'PASS' : 'FAIL'
  }`,
);
console.log(
  `Participant revocation: ${
    revocationResult?.status !== 0 && releaseStatus === 204 ? 'PASS' : 'FAIL'
  }`,
);
console.log(`Scoped daemon reload: ${reloadResult?.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(`Bootstrap requests: ${result.bootstrap.requestCount}`);
console.log(`Sanitized trace entries: ${trace.length}`);
console.log(`Evidence: ${evidenceDirectory}`);

const failedFixtureProbe =
  scenario === 'fixture' &&
  Object.values(probeResults || {}).some(
    value => value === 'Failed' || value === 'UnexpectedSuccess',
  );

if (
  commandResult?.status !== 0 ||
  reuseResult?.status !== 0 ||
  (scenario === 'fixture' && fixtureCleanupResult?.status !== 0) ||
  !concurrentResults?.every(processResult => processResult.status === 0) ||
  revocationResult?.status === 0 ||
  releaseStatus !== 204 ||
  reloadResult?.status !== 0 ||
  failedFixtureProbe ||
  traceTruncated
) {
  process.exitCode = 1;
}
