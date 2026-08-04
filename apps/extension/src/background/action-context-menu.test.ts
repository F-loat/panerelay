import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RELEASE_ALL_CONTROL_MENU_ID,
  installReleaseActionContextMenu,
  type ActionContextMenuCreateProperties,
} from './action-context-menu.js';

interface ActionContextMenuHarnessOptions {
  creationError?: string;
  releaseError?: Error;
  title?: string;
}

function actionContextMenuHarness(options: ActionContextMenuHarnessOptions = {}) {
  let clickListener: ((menuItemId: string | number) => void) | undefined;
  let installedListener: (() => void) | undefined;
  let releaseCalls = 0;
  const created: ActionContextMenuCreateProperties[] = [];
  const errors: unknown[] = [];

  installReleaseActionContextMenu({
    createMenu: (properties, callback) => {
      created.push(properties);
      callback();
    },
    getLastErrorMessage: () => options.creationError,
    onClicked: listener => {
      clickListener = listener;
    },
    onInstalled: listener => {
      installedListener = listener;
    },
    releaseControl: () => {
      releaseCalls += 1;
      return options.releaseError ? Promise.reject(options.releaseError) : Promise.resolve();
    },
    reportError: error => errors.push(error),
    title: options.title ?? 'Release all control',
  });

  return {
    click: (menuItemId: string | number) => clickListener?.(menuItemId),
    created,
    errors,
    install: () => installedListener?.(),
    releaseCalls: () => releaseCalls,
  };
}

test('registers one localized release item for the Extension action context', () => {
  const harness = actionContextMenuHarness({ title: '全部释放' });

  harness.install();

  assert.deepEqual(harness.created, [
    {
      contexts: ['action'],
      id: RELEASE_ALL_CONTROL_MENU_ID,
      title: '全部释放',
    },
  ]);
  assert.deepEqual(harness.errors, []);
});

test('ignores unrelated items and dispatches matching clicks to whole-lease release', () => {
  const harness = actionContextMenuHarness();

  harness.click('another-extension-action');
  assert.equal(harness.releaseCalls(), 0);

  harness.click(RELEASE_ALL_CONTROL_MENU_ID);
  assert.equal(harness.releaseCalls(), 1);
});

test('reports menu registration and asynchronous release errors', async () => {
  const releaseError = new Error('Release failed');
  const harness = actionContextMenuHarness({
    creationError: 'Menu registration failed',
    releaseError,
  });

  harness.install();
  harness.click(RELEASE_ALL_CONTROL_MENU_ID);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal((harness.errors[0] as Error).message, 'Menu registration failed');
  assert.equal(harness.errors[1], releaseError);
});
