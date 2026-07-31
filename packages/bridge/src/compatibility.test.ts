import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_BROWSER_MINIMUM_VERSION,
  CLAUDE_CODE_MINIMUM_VERSION,
  isClaudeCodeSupported,
  probeAgentBrowserCompatibility,
} from './compatibility.js';

test('accepts the minimum and newer agent-browser versions but rejects older versions', async () => {
  assert.equal(AGENT_BROWSER_MINIMUM_VERSION, '0.33.0');
  for (const [version, supported] of [
    ['0.32.9', false],
    ['0.33.0', true],
    ['0.40.1', true],
  ] as const) {
    const result = await probeAgentBrowserCompatibility('/agent-browser', {
      runner: async () => ({
        code: 0,
        stderr: '',
        stdout: `agent-browser ${version}`,
      }),
    });
    assert.deepEqual(result, { version, supported });
  }
});

test('accepts only supported semantic Claude Code CLI versions', () => {
  assert.equal(CLAUDE_CODE_MINIMUM_VERSION, '2.1.206');
  assert.equal(isClaudeCodeSupported('2.1.205'), false);
  assert.equal(isClaudeCodeSupported('2.1.206'), true);
  assert.equal(isClaudeCodeSupported('3.0.0'), true);
  assert.equal(isClaudeCodeSupported('2.1.206-rc.1'), false);
  assert.equal(isClaudeCodeSupported('2.1.206+build.1'), false);
  assert.equal(isClaudeCodeSupported('02.1.206'), false);
  assert.equal(isClaudeCodeSupported(undefined), false);
  assert.equal(isClaudeCodeSupported('unknown'), false);
});
