import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationMessage } from '@panerelay/protocol';
import {
  normalizeAcpHistoryMessages,
  PANERELAY_CONTEXT_END,
  PANERELAY_CONTEXT_START,
  stripAcpConversationContext,
  wrapAcpConversationContext,
} from './acp-context.js';
import {
  createConversationContextInstructions,
  resolveConversationStartOptions,
} from './agent-context.js';

function message(id: string, role: ConversationMessage['role'], text: string): ConversationMessage {
  return {
    id,
    role,
    text,
    ...(role === 'assistant' ? { phase: 'final' as const } : {}),
    createdAt: '2026-08-04T00:00:00.000Z',
  };
}

test('wraps and strips only the literal v1 context envelope', () => {
  const wrapped = wrapAcpConversationContext('internal\ncontext', '  user text  ');
  assert.equal(
    wrapped,
    `${PANERELAY_CONTEXT_START}\ninternal\ncontext\n${PANERELAY_CONTEXT_END}\n\n  user text  `,
  );
  assert.equal(stripAcpConversationContext(wrapped), '  user text  ');
  assert.equal(
    stripAcpConversationContext(
      `<panerelay-context version="2">\ninternal\n${PANERELAY_CONTEXT_END}\n\nuser`,
    ),
    `<panerelay-context version="2">\ninternal\n${PANERELAY_CONTEXT_END}\n\nuser`,
  );
  assert.equal(
    stripAcpConversationContext(
      `${PANERELAY_CONTEXT_START} \ninternal\n${PANERELAY_CONTEXT_END}\n\nuser`,
    ),
    `${PANERELAY_CONTEXT_START} \ninternal\n${PANERELAY_CONTEXT_END}\n\nuser`,
  );
  assert.equal(
    stripAcpConversationContext(
      `${PANERELAY_CONTEXT_START}\ninternal\n${PANERELAY_CONTEXT_END}\nuser`,
    ),
    `${PANERELAY_CONTEXT_START}\ninternal\n${PANERELAY_CONTEXT_END}\nuser`,
  );
});

test('normalizes complete v1 history without changing later messages', () => {
  const assistant = message('a1', 'assistant', 'answer');
  const laterUser = message('u2', 'user', `${PANERELAY_CONTEXT_START} is user-authored`);
  const normalized = normalizeAcpHistoryMessages([
    message('u1', 'user', wrapAcpConversationContext('private context', 'question')),
    assistant,
    laterUser,
  ]);
  assert.deepEqual(
    normalized.map(item => [item.id, item.text]),
    [
      ['u1', 'question'],
      ['a1', 'answer'],
      ['u2', `${PANERELAY_CONTEXT_START} is user-authored`],
    ],
  );
  assert.equal(normalized[1], assistant);
  assert.equal(normalized[2], laterUser);
});

test('strictly normalizes known legacy context variants and image-only text entries', () => {
  const base = createConversationContextInstructions(resolveConversationStartOptions({}));
  const setup = createConversationContextInstructions(resolveConversationStartOptions({}), {
    agentBrowser: { registered: true, isDefault: true },
    browserUse: { registered: true, mode: 'extension' },
    playwright: { registered: true },
  });
  const page = createConversationContextInstructions(
    resolveConversationStartOptions({
      initialPage: { title: 'Example', url: 'https://example.com/app' },
    }),
    { browserUse: { registered: true, mode: 'extension' } },
  );

  assert.equal(stripAcpConversationContext(`${base}\n\nbase question`), 'base question');
  assert.equal(stripAcpConversationContext(`${setup}\n\nsetup question`), 'setup question');
  assert.equal(stripAcpConversationContext(`${page}\n\npage question`), 'page question');
  assert.deepEqual(
    normalizeAcpHistoryMessages([
      message('u1', 'user', page),
      message('a1', 'assistant', 'image answer'),
    ]).map(item => [item.role, item.text]),
    [['assistant', 'image answer']],
  );
});

test('preserves partial legacy scaffolds and similar user-authored instructions', () => {
  const base = createConversationContextInstructions(resolveConversationStartOptions({}));
  const similar = `${base.replace('one canonical Skill installation', 'a Skill installation')}\n\nquestion`;
  assert.equal(stripAcpConversationContext(similar), similar);

  const userText =
    'For work in the user’s existing authorized browser tabs, first load a different Skill.\nPrompt timed out.';
  assert.equal(stripAcpConversationContext(userText), userText);
});
