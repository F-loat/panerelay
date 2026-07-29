import { spawnSync } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';

const expectedAgentBrowserVersion = '0.33.0';
const fixtureUrl = new URL(process.env.PANERELAY_FIXTURE_URL || 'http://127.0.0.1:41731/');
const sessionName = process.env.PANERELAY_ACCEPTANCE_SESSION || 'panerelay-advanced-0-33-0';
const requestedGroup = process.argv[2] || 'baseline';
const supportedGroups = new Set([
  'baseline',
  'state-network',
  'artifacts',
  'emulation',
  'diagnostics',
  'all',
]);

if (!supportedGroups.has(requestedGroup)) {
  throw new Error(`Unknown group "${requestedGroup}". Use ${[...supportedGroups].join(', ')}.`);
}

if (fixtureUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(fixtureUrl.hostname)) {
  throw new Error('PANERELAY_FIXTURE_URL must use a local HTTP fixture');
}

const repositoryRoot = resolve(import.meta.dirname, '../..');
const runId = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const evidenceDirectory = resolve(
  process.env.PANERELAY_EVIDENCE_DIR ||
    resolve(homedir(), 'verify-evidence', 'panerelay', 'agent-browser-advanced', runId),
);
const evidenceRelativeToRepository = relative(repositoryRoot, evidenceDirectory);

if (!evidenceRelativeToRepository.startsWith('..') && !isAbsolute(evidenceRelativeToRepository)) {
  throw new Error('PANERELAY_EVIDENCE_DIR must be outside the PaneRelay repository');
}

await mkdir(evidenceDirectory, { recursive: true });

const results = [];
const baseArguments = ['--session', sessionName, '--provider', 'panerelay'];
if (requestedGroup === 'emulation' || requestedGroup === 'all') {
  baseArguments.push('--user-agent', 'PaneRelayAcceptance/0.33.0');
}
let harStarted = false;
let traceStarted = false;
let profilerStarted = false;
let fixtureConfirmed = false;

function invoke(argumentsList, timeout = 90_000) {
  return spawnSync('agent-browser', argumentsList, {
    encoding: 'utf8',
    timeout,
  });
}

async function recordStep(label, argumentsList, options = {}) {
  const { allowFailure = false, recordOutput = true, timeout } = options;
  const startedAt = new Date().toISOString();
  const execution = invoke([...baseArguments, ...argumentsList], timeout);
  const succeeded = execution.status === 0 && !execution.error;
  const output = `${execution.stdout || ''}${execution.stderr || ''}`;

  if (recordOutput) {
    await writeFile(resolve(evidenceDirectory, `${label}.txt`), output, 'utf8');
  }

  results.push({
    label,
    command: argumentsList,
    startedAt,
    succeeded,
    exitCode: execution.status,
    signal: execution.signal,
    error: execution.error?.message,
  });

  console.log(`${succeeded ? 'PASS' : 'FAIL'} ${label}`);
  if (!succeeded && !allowFailure) {
    throw new Error(`Acceptance step failed: ${label}`);
  }
  return { ...execution, output, succeeded };
}

async function assertFixtureTarget() {
  const result = await recordStep('fixture-precondition', ['get', 'url'], {
    recordOutput: false,
  });
  const currentUrl = result.stdout.trim();
  let current;
  try {
    current = new URL(currentUrl);
  } catch {
    throw new Error('The selected PaneRelay target did not return a valid URL');
  }
  if (current.origin !== fixtureUrl.origin) {
    throw new Error(
      'The selected PaneRelay target is not the local fixture. Open and authorize the fixture tab before running acceptance.',
    );
  }
}

async function runBaseline() {
  await recordStep('baseline-snapshot', ['snapshot', '-i']);
  await recordStep('baseline-title', ['get', 'title']);
  await recordStep('baseline-eval', [
    'eval',
    'JSON.stringify({origin: location.origin, ready: document.readyState})',
  ]);
}

async function runStateAndNetwork() {
  await recordStep('storage-local-set', [
    'storage',
    'local',
    'set',
    'panerelay-acceptance',
    'local',
  ]);
  await recordStep('storage-local-get', [
    '--json',
    'storage',
    'local',
    'get',
    'panerelay-acceptance',
  ]);
  await recordStep('storage-session-set', [
    'storage',
    'session',
    'set',
    'panerelay-acceptance',
    'session',
  ]);
  await recordStep('storage-session-get', [
    '--json',
    'storage',
    'session',
    'get',
    'panerelay-acceptance',
  ]);

  await recordStep('cookie-set', [
    'cookies',
    'set',
    'panerelay_acceptance',
    'verified',
    '--url',
    fixtureUrl.href,
  ]);
  await recordStep('cookie-observe', [
    'eval',
    'document.cookie.includes("panerelay_acceptance=verified")',
  ]);
  const cookieResult = await recordStep('cookie-list', ['--json', 'cookies', 'get'], {
    recordOutput: false,
  });
  const cookiePayload = JSON.parse(cookieResult.stdout);
  const cookies = cookiePayload?.data?.cookies;
  await writeFile(
    resolve(evidenceDirectory, 'cookie-list.json'),
    `${JSON.stringify(
      {
        fixtureCookieFound:
          Array.isArray(cookies) &&
          cookies.some(
            cookie =>
              cookie?.name === 'panerelay_acceptance' && cookie?.domain === fixtureUrl.hostname,
          ),
        returnedCookieCount: Array.isArray(cookies) ? cookies.length : null,
        onlyFixtureHost:
          Array.isArray(cookies) && cookies.every(cookie => cookie?.domain === fixtureUrl.hostname),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await recordStep('requests-clear', ['network', 'requests', '--clear']);
  await recordStep('headers-set', ['set', 'headers', '{"X-PaneRelay-Acceptance":"verified"}']);
  await recordStep('headers-fetch', ['click', '#headers']);
  await recordStep('headers-observe', ['get', 'text', '#diagnostic-result']);
  await recordStep('headers-reset', ['set', 'headers', '{}']);

  await recordStep('har-start', ['network', 'har', 'start', '--content', 'text']);
  harStarted = true;
  await recordStep('request-fetch', ['click', '#request']);
  await recordStep('request-observe', ['get', 'text', '#diagnostic-result']);
  const requestList = await recordStep('requests-list', [
    '--json',
    'network',
    'requests',
    '--filter',
    fixtureUrl.hostname,
  ]);
  const requestPayload = JSON.parse(requestList.stdout);
  const requests = requestPayload?.data?.requests;
  const fixtureRequest = Array.isArray(requests)
    ? requests.find(request => {
        try {
          return new URL(request.url).pathname === '/data.json';
        } catch {
          return false;
        }
      })
    : undefined;
  if (typeof fixtureRequest?.requestId !== 'string') {
    throw new Error('The fixture request was not present in the agent-browser request log');
  }
  await recordStep('request-detail', ['--json', 'network', 'request', fixtureRequest.requestId]);
  await recordStep('har-stop', [
    'network',
    'har',
    'stop',
    resolve(evidenceDirectory, 'fixture.har'),
  ]);
  harStarted = false;

  await recordStep('offline-on', ['set', 'offline', 'on']);
  await recordStep('offline-observe', ['eval', 'navigator.onLine']);
  await recordStep('offline-off', ['set', 'offline', 'off']);

  await recordStep('credentials-set', ['set', 'credentials', 'panerelay', 'fixture']);
  await recordStep('credentials-fetch', ['click', '#auth']);
  await recordStep('credentials-observe', ['get', 'text', '#diagnostic-result']);
  await recordStep('credentials-reset', ['set', 'headers', '{}']);

  await recordStep('route-set', [
    'network',
    'route',
    '**/data.json',
    '--body',
    '{"message":"Routed response"}',
  ]);
  await recordStep('route-fetch', ['click', '#request']);
  await recordStep('route-observe', ['get', 'text', '#diagnostic-result']);
  await recordStep('route-remove', ['network', 'unroute', '**/data.json']);
  await recordStep('route-restored-fetch', ['click', '#request']);
  await recordStep('route-restored-observe', ['get', 'text', '#diagnostic-result']);
}

async function runArtifacts() {
  const uploadPath = resolve(evidenceDirectory, 'upload-fixture.txt');
  const pdfPath = resolve(evidenceDirectory, 'fixture.pdf');
  const largePdfPath = resolve(evidenceDirectory, 'fixture-large.pdf');
  const downloadPath = resolve(evidenceDirectory, 'panerelay-download.txt');
  await writeFile(uploadPath, 'PaneRelay upload fixture.\n', 'utf8');

  await recordStep('pdf', ['pdf', pdfPath]);
  await recordStep('large-artifact-open', ['open', new URL('/artifact.html', fixtureUrl).href]);
  await recordStep('large-artifact-ready', ['wait', 'body[data-ready="true"]']);
  await recordStep('large-pdf', ['pdf', largePdfPath], { timeout: 120_000 });
  await recordStep('fixture-return', ['open', fixtureUrl.href]);
  await recordStep('upload', ['upload', '#upload', uploadPath]);
  await recordStep('upload-observe', ['get', 'text', '#upload-result']);
  await recordStep('download', ['download', '#download', downloadPath], {
    allowFailure: true,
    timeout: 120_000,
  });

  const artifacts = {};
  for (const [name, path] of Object.entries({
    pdf: pdfPath,
    largePdf: largePdfPath,
    download: downloadPath,
  })) {
    try {
      const metadata = await stat(path);
      artifacts[name] = { path, bytes: metadata.size };
    } catch {
      artifacts[name] = { path, missing: true };
    }
  }
  await writeFile(
    resolve(evidenceDirectory, 'artifact-sizes.json'),
    `${JSON.stringify(artifacts, null, 2)}\n`,
    'utf8',
  );
}

async function runEmulation() {
  await recordStep('viewport-set', ['set', 'viewport', '480', '720']);
  await recordStep('viewport-observe', [
    'eval',
    'JSON.stringify({width: innerWidth, height: innerHeight, dpr: devicePixelRatio})',
  ]);
  await recordStep('media-set', ['set', 'media', 'dark', 'reduced-motion']);
  await recordStep('media-observe', [
    'eval',
    'JSON.stringify({dark: matchMedia("(prefers-color-scheme: dark)").matches, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches})',
  ]);
  await recordStep('user-agent-observe', [
    'eval',
    'navigator.userAgent === "PaneRelayAcceptance/0.33.0"',
  ]);
  await recordStep('a11y', ['--json', 'a11y']);
}

async function runDiagnostics() {
  await recordStep('trace-start', ['trace', 'start']);
  traceStarted = true;
  await recordStep('trace-work', [
    'eval',
    'Array.from({length: 1000}, (_, index) => index ** 2).at(-1)',
  ]);
  await recordStep('trace-stop', [
    'trace',
    'stop',
    resolve(evidenceDirectory, 'fixture-trace.json'),
  ]);
  traceStarted = false;

  await recordStep('profiler-start', ['profiler', 'start']);
  profilerStarted = true;
  await recordStep('profiler-work', [
    'eval',
    'Array.from({length: 1000}, (_, index) => index ** 3).at(-1)',
  ]);
  await recordStep('profiler-stop', [
    'profiler',
    'stop',
    resolve(evidenceDirectory, 'fixture-profile.json'),
  ]);
  profilerStarted = false;

  await recordStep(
    'recording-start',
    ['record', 'start', resolve(evidenceDirectory, 'fixture.webm')],
    { allowFailure: true, timeout: 120_000 },
  );
  await recordStep('recording-stop', ['record', 'stop'], {
    allowFailure: true,
    timeout: 120_000,
  });
  await recordStep(
    'recording-restart-current-target',
    ['record', 'restart', resolve(evidenceDirectory, 'fixture-current-target.webm')],
    { allowFailure: true, timeout: 120_000 },
  );
  await recordStep('recording-current-target-work', ['wait', '500'], {
    allowFailure: true,
  });
  await recordStep('recording-current-target-stop', ['record', 'stop'], {
    allowFailure: true,
    timeout: 120_000,
  });
  await recordStep('post-recording-recovery', [
    'eval',
    'document.title === "PaneRelay RFC-0001 Action Matrix"',
  ]);

  await recordStep('stream-status-before', ['stream', 'status']);
  await recordStep('stream-enable', ['stream', 'enable'], { allowFailure: true });
  await recordStep('stream-status', ['stream', 'status']);
  await recordStep('stream-disable', ['stream', 'disable']);
}

async function cleanup() {
  if (!fixtureConfirmed) {
    await recordStep('cleanup-close', ['close'], { allowFailure: true });
    return;
  }

  if (harStarted) {
    await recordStep(
      'cleanup-har-stop',
      ['network', 'har', 'stop', resolve(evidenceDirectory, 'interrupted.har')],
      { allowFailure: true },
    );
  }
  if (traceStarted) {
    await recordStep(
      'cleanup-trace-stop',
      ['trace', 'stop', resolve(evidenceDirectory, 'interrupted-trace.json')],
      { allowFailure: true },
    );
  }
  if (profilerStarted) {
    await recordStep(
      'cleanup-profiler-stop',
      ['profiler', 'stop', resolve(evidenceDirectory, 'interrupted-profile.json')],
      { allowFailure: true },
    );
  }

  await recordStep('cleanup-offline', ['set', 'offline', 'off'], {
    allowFailure: true,
  });
  await recordStep('cleanup-headers', ['set', 'headers', '{}'], {
    allowFailure: true,
  });
  await recordStep('cleanup-routes', ['network', 'unroute'], {
    allowFailure: true,
  });
  await recordStep('cleanup-storage-local', ['storage', 'local', 'clear'], {
    allowFailure: true,
  });
  await recordStep('cleanup-storage-session', ['storage', 'session', 'clear'], {
    allowFailure: true,
  });
  await recordStep(
    'cleanup-cookie',
    ['cookies', 'set', 'panerelay_acceptance', '', '--url', fixtureUrl.href, '--expires', '1'],
    { allowFailure: true },
  );
  await recordStep('cleanup-close', ['close'], { allowFailure: true });
}

const versionResult = invoke(['--version']);
const detectedVersion = versionResult.stdout.trim().replace(/^agent-browser\s+/, '');
if (versionResult.status !== 0 || detectedVersion !== expectedAgentBrowserVersion) {
  throw new Error(
    `Expected agent-browser ${expectedAgentBrowserVersion}, received ${detectedVersion || 'unknown'}`,
  );
}

let runError;
try {
  await assertFixtureTarget();
  fixtureConfirmed = true;
  if (requestedGroup === 'baseline' || requestedGroup === 'all') await runBaseline();
  if (requestedGroup === 'state-network' || requestedGroup === 'all') {
    await runStateAndNetwork();
  }
  if (requestedGroup === 'artifacts' || requestedGroup === 'all') await runArtifacts();
  if (requestedGroup === 'emulation' || requestedGroup === 'all') await runEmulation();
  if (requestedGroup === 'diagnostics' || requestedGroup === 'all') await runDiagnostics();
} catch (error) {
  runError = error;
} finally {
  await cleanup();
  await writeFile(
    resolve(evidenceDirectory, 'run.json'),
    `${JSON.stringify(
      {
        agentBrowserVersion: detectedVersion,
        fixtureOrigin: fixtureUrl.origin,
        group: requestedGroup,
        sessionName,
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

if (runError) throw runError;

console.log(`Evidence: ${evidenceDirectory}`);
