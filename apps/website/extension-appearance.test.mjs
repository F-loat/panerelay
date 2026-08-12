import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

async function appearanceModule() {
  const source = await readFile(new URL('src/extension-appearance.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInContext(compiled, vm.createContext({ exports: module.exports, module }));
  return module.exports;
}

class FakeEvent {
  listeners = new Set();

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  emit(value) {
    for (const listener of [...this.listeners]) listener(value);
  }
}

class FakePort {
  onMessage = new FakeEvent();
  onDisconnect = new FakeEvent();
  disconnected = false;

  disconnect() {
    this.disconnected = true;
  }
}

function fakeEnvironment(runtime) {
  const values = new Map();
  const logoAccents = [];
  const timers = new Map();
  const pageHideListeners = new Set();
  let nextTimer = 1;
  return {
    values,
    logoAccents,
    timers,
    pageHideListeners,
    environment: {
      runtime,
      style: { setProperty: (name, value) => values.set(name, value) },
      applyLogoAccent: color => logoAccents.push(color),
      setTimer(callback, delay) {
        assert.equal(delay, 5_000);
        const id = nextTimer++;
        timers.set(id, callback);
        return id;
      },
      clearTimer: id => timers.delete(id),
      addPageHideListener: listener => pageHideListeners.add(listener),
      removePageHideListener: listener => pageHideListeners.delete(listener),
    },
  };
}

const validMessage = {
  type: 'panerelay.website-appearance.snapshot',
  version: 1,
  accent: { primary: '#336699', soft: '#aabbcc', dark: '#112233' },
};

test('applies complete valid palettes and ignores malformed appearance data', async () => {
  const { initializeWebsiteAppearance } = await appearanceModule();
  const port = new FakePort();
  const connectCalls = [];
  const runtime = {
    connect(extensionId, options) {
      connectCalls.push({ extensionId, options });
      return port;
    },
  };
  const fixture = fakeEnvironment(runtime);
  initializeWebsiteAppearance(fixture.environment);

  assert.equal(connectCalls.length, 1);
  assert.equal(connectCalls[0].extensionId, 'panplnkjlkoceaonlmpdekjphgmbggmi');
  assert.equal(connectCalls[0].options.name, 'panerelay.website-appearance.v1');
  port.onMessage.emit(validMessage);
  assert.deepEqual(Object.fromEntries(fixture.values), {
    '--green': '#336699',
    '--green-rgb': '51 102 153',
    '--green-soft': '#aabbcc',
    '--green-soft-rgb': '170 187 204',
    '--green-dark': '#112233',
    '--green-dark-rgb': '17 34 51',
  });
  assert.deepEqual(fixture.logoAccents, ['#336699']);

  port.onMessage.emit({ ...validMessage, version: 2 });
  port.onMessage.emit({ ...validMessage, accent: { ...validMessage.accent, dark: 'red' } });
  assert.equal(fixture.values.get('--green'), '#336699');
  assert.deepEqual(fixture.logoAccents, ['#336699']);
});

test('builds an inline website logo using the validated primary accent', async () => {
  const { websiteLogoDataUrl } = await appearanceModule();
  const dataUrl = websiteLogoDataUrl('#336699');
  assert.match(dataUrl, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(dataUrl), /stroke="#336699"/);
});

test('applies live palette updates without reloading the page', async () => {
  const { initializeWebsiteAppearance } = await appearanceModule();
  const port = new FakePort();
  const fixture = fakeEnvironment({ connect: () => port });
  initializeWebsiteAppearance(fixture.environment);

  port.onMessage.emit(validMessage);
  port.onMessage.emit({
    ...validMessage,
    accent: { primary: '#abcdef', soft: '#fedcba', dark: '#123456' },
  });
  assert.equal(fixture.values.get('--green'), '#abcdef');
  assert.equal(fixture.values.get('--green-soft'), '#fedcba');
  assert.equal(fixture.values.get('--green-dark'), '#123456');
  assert.deepEqual(fixture.logoAccents, ['#336699', '#abcdef']);
});

test('reconnects, retains the last valid palette, and cleans up page teardown', async () => {
  const { initializeWebsiteAppearance } = await appearanceModule();
  const first = new FakePort();
  const second = new FakePort();
  const ports = [first, second];
  const fixture = fakeEnvironment({ connect: () => ports.shift() });
  const dispose = initializeWebsiteAppearance(fixture.environment);

  first.onMessage.emit(validMessage);
  first.onDisconnect.emit();
  assert.equal(fixture.timers.size, 1);
  assert.equal(fixture.values.get('--green'), '#336699');

  [...fixture.timers.values()][0]();
  assert.equal(fixture.timers.size, 1);
  second.onMessage.emit({
    ...validMessage,
    accent: { primary: '#abcdef', soft: '#fedcba', dark: '#123456' },
  });
  assert.equal(fixture.values.get('--green'), '#abcdef');

  dispose();
  assert.equal(second.disconnected, true);
  assert.equal(fixture.pageHideListeners.size, 0);
});

test('keeps static defaults when the Extension API is absent or connect throws', async () => {
  const { initializeWebsiteAppearance } = await appearanceModule();
  const absent = fakeEnvironment(undefined);
  initializeWebsiteAppearance(absent.environment);
  assert.equal(absent.values.size, 0);
  assert.equal(absent.timers.size, 0);

  const unavailable = fakeEnvironment({
    connect() {
      throw new Error('Extension unavailable');
    },
  });
  const dispose = initializeWebsiteAppearance(unavailable.environment);
  assert.equal(unavailable.values.size, 0);
  assert.equal(unavailable.timers.size, 1);
  dispose();
  assert.equal(unavailable.timers.size, 0);
});

test('routes every website green alpha treatment through synchronized color channels', async () => {
  const styles = await readFile(new URL('src/styles.css', import.meta.url), 'utf8');
  const compare = await readFile(new URL('src/compare.css', import.meta.url), 'utf8');
  assert.match(styles, /--green-rgb: 32 230 143/);
  assert.match(styles, /rgb\(var\(--green-rgb\) \/ 7%\)/);
  assert.doesNotMatch(
    `${styles}\n${compare}`,
    /rgb\((?:32 230 143|134 243 189|9 59 41) \/ [^)]+\)/,
  );
});

test('routes prominent component accents through the synchronized semantic palette', async () => {
  const styles = await readFile(new URL('src/styles.css', import.meta.url), 'utf8');
  const fixedGreenTokens = [
    '#d7eee2',
    '#eaf8f1',
    '#082117',
    '#07130d',
    '#0d2319',
    '#0d1c15',
    '#08301f',
    '#456b59',
    '#0d3a29',
    '#d8efe3',
    '#b3cabf',
    '#91b4a3',
    '#91aa9e',
    '#8fac9e',
    '#20b873',
    '#d8e4dd',
    '#edf7f2',
    '#08713f',
    '#0c9d59',
    '#38775a',
    '#19b66f',
    '#0e9858',
    '#0c8c50',
    '#176a48',
    '#24d98a',
    '#092a1b',
    '#16a34a',
    '#19c779',
    '#062416',
    '#e8f7ef',
    '#0d9d59',
    '#0e9b59',
    'rgb(8 41 28 / 82%)',
    'rgb(216 239 227 / 12%)',
    'rgb(216 239 227 / 16%)',
    'rgb(216 239 227 / 18%)',
    'rgb(3 20 13 / 18%)',
    'rgb(6 30 20 / 58%)',
    'rgb(14 69 48 / 80%)',
    'rgb(5 43 26 / 10%)',
    'rgb(13 113 67 / 18%)',
    'rgb(14 50 34 / 74%)',
  ];

  for (const token of fixedGreenTokens) assert.equal(styles.includes(token), false, token);
  assert.match(styles, /--accent-surface-strong: color-mix/);
  assert.match(styles, /\.bridge-node-accent[\s\S]*?background: var\(--accent-surface-subtle\)/);
  assert.match(styles, /\.trust-panel[\s\S]*?var\(--accent-surface-strong\)/);
  assert.match(styles, /\.scope-switch-demo span\[data-active='true'\][\s\S]*?var\(--green\)/);
  assert.match(styles, /\.release-result[\s\S]*?background: var\(--accent-surface\)/);
  assert.match(styles, /--danger: #ff8b78/);
});
