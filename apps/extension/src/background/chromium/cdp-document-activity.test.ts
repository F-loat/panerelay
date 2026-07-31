import assert from 'node:assert/strict';
import test from 'node:test';
import { cdpCommandTouchesDocument } from './cdp-document-activity.js';

test('keeps passive setup and allowlisted reads from marking the page favicon', () => {
  assert.equal(cdpCommandTouchesDocument('Target.setAutoAttach'), false);
  assert.equal(cdpCommandTouchesDocument('Runtime.runIfWaitingForDebugger'), false);
  assert.equal(cdpCommandTouchesDocument('Page.enable'), false);
  assert.equal(cdpCommandTouchesDocument('Runtime.enable'), false);
  assert.equal(cdpCommandTouchesDocument('Network.enable'), false);
  assert.equal(cdpCommandTouchesDocument('Accessibility.getFullAXTree'), false);
  assert.equal(cdpCommandTouchesDocument('Network.getResponseBody'), false);
  assert.equal(cdpCommandTouchesDocument('Page.captureScreenshot'), false);
  assert.equal(cdpCommandTouchesDocument('Page.captureSnapshot'), false);
  assert.equal(cdpCommandTouchesDocument('Page.printToPDF'), false);
});

test('marks mutations and ambiguous commands', () => {
  assert.equal(cdpCommandTouchesDocument('Runtime.evaluate'), true);
  assert.equal(cdpCommandTouchesDocument('Page.navigate'), true);
  assert.equal(cdpCommandTouchesDocument('Input.dispatchMouseEvent'), true);
  assert.equal(cdpCommandTouchesDocument('Unknown.readSomething'), true);
});
