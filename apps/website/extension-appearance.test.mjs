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
  const timers = new Map();
  const pageHideListeners = new Set();
  let nextTimer = 1;
  return {
    values,
    timers,
    pageHideListeners,
    environment: {
      runtime,
      style: { setProperty: (name, value) => values.set(name, value) },
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

  port.onMessage.emit({ ...validMessage, version: 2 });
  port.onMessage.emit({ ...validMessage, accent: { ...validMessage.accent, dark: 'red' } });
  assert.equal(fixture.values.get('--green'), '#336699');
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
