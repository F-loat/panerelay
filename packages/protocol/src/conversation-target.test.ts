import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conversationTargetSessionName,
  isCanonicalUuid,
  isConversationTargetHint,
  parseConversationTargetSessionName,
} from './conversation-target.js';

const target = {
  browserId: '11111111-1111-4111-8111-111111111111',
  targetId: '22222222-2222-4222-8222-222222222222',
};

test('round-trips the exact reserved conversation target session name', () => {
  const session = conversationTargetSessionName(target);
  assert.equal(
    session,
    'panerelay-tab-v1-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222',
  );
  assert.deepEqual(parseConversationTargetSessionName(session), target);
  assert.ok(session.length <= 128);
});

test('rejects non-canonical, partial, and extended target hints', () => {
  assert.equal(isCanonicalUuid(target.browserId), true);
  assert.equal(isCanonicalUuid('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'), false);
  assert.equal(isConversationTargetHint(target), true);
  assert.equal(isConversationTargetHint({ browserId: target.browserId }), false);
  assert.equal(isConversationTargetHint({ ...target, extra: true }), false);
  assert.equal(
    parseConversationTargetSessionName(`panerelay-tab-v2-${target.browserId}-${target.targetId}`),
    undefined,
  );
  assert.equal(
    parseConversationTargetSessionName(
      `prefix-panerelay-tab-v1-${target.browserId}-${target.targetId}`,
    ),
    undefined,
  );
});
