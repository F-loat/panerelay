import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_BROWSER_MINIMUM_VERSION, probeAgentBrowserCompatibility } from './compatibility.js';

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
