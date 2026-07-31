import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_BROWSER_MCP_NAME,
  AGENT_BROWSER_SIDEPANEL_INSTRUCTIONS,
  agentBrowserMcpArguments,
  agentBrowserSessionEnvironment,
  closeAgentBrowserSession,
  createAgentBrowserSession,
} from './agent-browser-session.js';

const session = {
  configPath: 'C:\\Panerelay & Data\\agent-browser.json',
  executable: 'C:\\npm wrappers\\agent-browser.cmd',
  label: 'provider-session-1',
};

test('creates one scoped agent-browser MCP session definition', () => {
  assert.equal(
    createAgentBrowserSession(
      { agentBrowserConfigPath: '', agentBrowserPath: '/usr/local/bin/agent-browser' },
      'missing',
    ),
    undefined,
  );
  assert.deepEqual(
    createAgentBrowserSession(
      {
        agentBrowserConfigPath: '/Users/test/.panerelay/agent-browser.json',
        agentBrowserPath: '/usr/local/bin/agent-browser',
      },
      'provider-session-1',
    ),
    {
      configPath: '/Users/test/.panerelay/agent-browser.json',
      executable: '/usr/local/bin/agent-browser',
      label: 'provider-session-1',
    },
  );
  assert.equal(AGENT_BROWSER_MCP_NAME, 'panerelay_browser');
  assert.deepEqual(agentBrowserMcpArguments(), ['mcp', '--tools', 'core,tabs']);
  assert.match(AGENT_BROWSER_SIDEPANEL_INSTRUCTIONS, /never attempt to widen or bypass/);
  assert.deepEqual(agentBrowserSessionEnvironment(session), {
    AGENT_BROWSER_CONFIG: session.configPath,
    AGENT_BROWSER_PROVIDER: 'panerelay',
    AGENT_BROWSER_SESSION: session.label,
  });
  assert.deepEqual(agentBrowserSessionEnvironment(session, 'sidepanel-browser-id'), {
    AGENT_BROWSER_CONFIG: session.configPath,
    AGENT_BROWSER_PROVIDER: 'panerelay',
    AGENT_BROWSER_SESSION: session.label,
    PANERELAY_BROWSER_ID: 'sidepanel-browser-id',
  });
});

test('resolves Windows cleanup with the bounded session environment and timeout', async () => {
  let cleanup:
    | {
        args: string[];
        command: string;
        environment?: NodeJS.ProcessEnv;
        timeoutMs?: number;
        windowsVerbatimArguments?: boolean;
      }
    | undefined;
  await closeAgentBrowserSession(session, {
    environment: {
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
      PANERELAY_BROWSER_ID: 'sidepanel-browser-id',
    },
    platform: 'win32',
    runner: async (command, args, options) => {
      cleanup = {
        args,
        command,
        environment: options?.environment,
        timeoutMs: options?.timeoutMs,
        windowsVerbatimArguments: options?.windowsVerbatimArguments,
      };
      return { code: 0, stderr: '', stdout: '' };
    },
  });

  assert.equal(cleanup?.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(cleanup?.args, [
    '/d',
    '/s',
    '/c',
    '"C:\\npm^ wrappers\\agent-browser.cmd ^"--session^" ^"provider-session-1^" ^"--provider^" ^"panerelay^" ^"close^""',
  ]);
  assert.equal(cleanup?.environment?.AGENT_BROWSER_CONFIG, session.configPath);
  assert.equal(cleanup?.environment?.AGENT_BROWSER_PROVIDER, 'panerelay');
  assert.equal(cleanup?.environment?.AGENT_BROWSER_SESSION, session.label);
  assert.equal(cleanup?.environment?.PANERELAY_BROWSER_ID, 'sidepanel-browser-id');
  assert.equal(cleanup?.timeoutMs, 5_000);
  assert.equal(cleanup?.windowsVerbatimArguments, true);
});

test('forwards a custom cleanup timeout and rejects unsuccessful cleanup', async () => {
  await assert.rejects(
    closeAgentBrowserSession(session, {
      runner: async (_command, _args, options) => {
        assert.equal(options?.timeoutMs, 123);
        return { code: 9, stderr: 'failed', stdout: '' };
      },
      timeoutMs: 123,
    }),
    /agent-browser cleanup exited with code 9/,
  );
});
