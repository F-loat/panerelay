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
  assert.equal(session, 'panerelay-v2-ERERERERQRGBERERERERESIiIiIiIkIigiIiIiIiIiI');
  assert.deepEqual(parseConversationTargetSessionName(session), target);
  assert.equal(session.length, 56);
  assert.ok(session.length <= 64);
  assert.match(session, /^[A-Za-z0-9_-]+$/);
});

test('round-trips canonical UUID boundaries without a stateful lookup', () => {
  const boundaryTarget = {
    browserId: '00000000-0000-1000-8000-000000000000',
    targetId: 'ffffffff-ffff-8fff-bfff-ffffffffffff',
  };
  assert.deepEqual(
    parseConversationTargetSessionName(conversationTargetSessionName(boundaryTarget)),
    boundaryTarget,
  );
});

test('rejects non-canonical, partial, and extended target hints', () => {
  const session = conversationTargetSessionName(target);
  assert.equal(isCanonicalUuid(target.browserId), true);
  assert.equal(isCanonicalUuid('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'), false);
  assert.equal(isConversationTargetHint(target), true);
  assert.equal(isConversationTargetHint({ browserId: target.browserId }), false);
  assert.equal(isConversationTargetHint({ ...target, extra: true }), false);
  assert.equal(
    parseConversationTargetSessionName(`panerelay-tab-v1-${target.browserId}-${target.targetId}`),
    undefined,
  );
  assert.equal(parseConversationTargetSessionName(`prefix-${session}`), undefined);
  assert.equal(parseConversationTargetSessionName(`${session}=`), undefined);
  assert.equal(parseConversationTargetSessionName(`${session.slice(0, -1)}J`), undefined);
  assert.equal(parseConversationTargetSessionName(`panerelay-v2-${'A'.repeat(43)}`), undefined);
  assert.equal(parseConversationTargetSessionName('panerelay-v2-short'), undefined);
});
