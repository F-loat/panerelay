import assert from 'node:assert/strict';
import test from 'node:test';
import { cdpCommandTouchesDocument } from './cdp-document-activity.js';

test('keeps target and child-session setup from marking the page favicon', () => {
  assert.equal(cdpCommandTouchesDocument('Target.setAutoAttach'), false);
  assert.equal(cdpCommandTouchesDocument('Target.detachFromTarget'), false);
  assert.equal(cdpCommandTouchesDocument('Runtime.runIfWaitingForDebugger'), false);
});

test('marks commands that read, navigate, or interact with the current document', () => {
  assert.equal(cdpCommandTouchesDocument('Runtime.evaluate'), true);
  assert.equal(cdpCommandTouchesDocument('Page.navigate'), true);
  assert.equal(cdpCommandTouchesDocument('Input.dispatchMouseEvent'), true);
});
