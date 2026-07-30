import assert from 'node:assert/strict';
import test from 'node:test';
import { CONVERSATION_MAX_IMAGE_BYTES, CONVERSATION_MAX_IMAGES } from '@panerelay/protocol';
import { validateConversationImages } from './conversation-images.js';

test('validates and normalizes bounded image inputs', () => {
  assert.deepEqual(
    validateConversationImages([{ data: 'AQID', mimeType: 'image/png', name: ' screenshot.png ' }]),
    [{ data: 'AQID', mimeType: 'image/png', name: ' screenshot.png ' }],
  );
  assert.deepEqual(validateConversationImages(undefined), []);
});

test('rejects malformed, unsupported, oversized, and excessive image inputs', () => {
  assert.throws(
    () =>
      validateConversationImages(
        Array.from({ length: CONVERSATION_MAX_IMAGES + 1 }, () => ({
          data: 'AQID',
          mimeType: 'image/png',
        })),
      ),
    /at most/,
  );
  assert.throws(
    () => validateConversationImages([{ data: 'not base64', mimeType: 'image/png' }]),
    /valid base64/,
  );
  assert.throws(
    () => validateConversationImages([{ data: 'AQID', mimeType: 'image/svg+xml' }]),
    /unsupported MIME/,
  );
  assert.throws(
    () =>
      validateConversationImages([
        {
          data: Buffer.alloc(CONVERSATION_MAX_IMAGE_BYTES + 1).toString('base64'),
          mimeType: 'image/png',
        },
      ]),
    /per-image size limit/,
  );
});
