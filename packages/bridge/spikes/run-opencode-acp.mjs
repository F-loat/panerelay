#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';

const executable =
  process.argv[2] || process.env.PANERELAY_OPENCODE_PATH || process.env.OPENCODE_PATH || 'opencode';
const timeoutMs = 120_000;
const stateRoot = await mkdtemp(join(tmpdir(), 'panerelay-opencode-state-'));
const workspace = await mkdtemp(join(tmpdir(), 'panerelay-opencode-workspace-'));
const childEnvironment = {
  ...process.env,
  OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { '*': 'ask' } }),
  XDG_CACHE_HOME: join(stateRoot, 'cache'),
  XDG_CONFIG_HOME: join(stateRoot, 'config'),
  XDG_DATA_HOME: join(stateRoot, 'data'),
  XDG_STATE_HOME: join(stateRoot, 'state'),
};
for (const key of Object.keys(childEnvironment)) {
  if (/(?:API_KEY|CREDENTIAL|PASSWORD|SECRET|TOKEN)/i.test(key)) delete childEnvironment[key];
}

const updates = new Map();
let assistantTextChars = 0;
let browserToolUpdates = 0;
let permissionDecision = 'reject';
let permissionRequests = 0;
let permissionResponses = 0;
const permissionSelections = { allowOnce: 0, reject: 0 };

function withTimeout(promise, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

async function attempt(operation) {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return {
      ok: false,
      errorName: error instanceof Error ? error.name : typeof error,
    };
  }
}

function recordUpdate(notification) {
  const kind = notification.update.sessionUpdate;
  updates.set(kind, (updates.get(kind) || 0) + 1);
  if (kind === 'agent_message_chunk' && notification.update.content.type === 'text') {
    assistantTextChars += notification.update.content.text.length;
  }
  if (
    (kind === 'tool_call' || kind === 'tool_call_update') &&
    /(?:agent-browser|browser use|panerelay browser)/i.test(notification.update.title || '')
  ) {
    browserToolUpdates += 1;
  }
}

function selectableValues(option) {
  if (option.type !== 'select') return [];
  return option.options.flatMap(item => ('options' in item ? item.options : [item]));
}

const version = execFileSync(executable, ['--version'], {
  encoding: 'utf8',
  env: childEnvironment,
  timeout: 10_000,
}).trim();
const child = spawn(executable, ['acp'], {
  cwd: workspace,
  env: childEnvironment,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
let stderrBytes = 0;
child.stderr.on('data', chunk => {
  stderrBytes += chunk.length;
});

const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
const app = acp
  .client({ name: 'panerelay-opencode-spike' })
  .onRequest(acp.methods.client.session.requestPermission, context => {
    permissionRequests += 1;
    const selected = context.params.options.find(option =>
      permissionDecision === 'allowOnce'
        ? option.kind === 'allow_once'
        : option.kind.startsWith('reject'),
    );
    permissionResponses += 1;
    if (selected) permissionSelections[permissionDecision] += 1;
    return selected
      ? { outcome: { outcome: 'selected', optionId: selected.optionId } }
      : { outcome: { outcome: 'cancelled' } };
  })
  .onNotification(acp.methods.client.session.update, context => {
    recordUpdate(context.params);
  });
const connection = app.connect(stream);

let cleanProcessShutdown = false;
let processTerminated = false;
try {
  const initialized = await withTimeout(
    connection.agent.request(acp.methods.agent.initialize, {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {},
      clientInfo: {
        name: 'panerelay-opencode-spike',
        title: 'Panerelay OpenCode ACP spike',
        version: '0.0.0-spike',
      },
    }),
    'ACP initialize',
  );
  const listed = await attempt(() =>
    withTimeout(
      connection.agent.request(acp.methods.agent.session.list, { cursor: null, cwd: workspace }),
      'ACP session/list',
    ),
  );
  const created = await withTimeout(
    connection.agent.request(acp.methods.agent.session.new, {
      cwd: workspace,
      mcpServers: [],
    }),
    'ACP session/new',
  );
  const modelOption = (created.configOptions || []).find(
    option => option.category === 'model' || option.id === 'model',
  );
  const modelValues = modelOption ? selectableValues(modelOption) : [];
  const preferredModel =
    process.env.OPENCODE_PROBE_MODEL ||
    modelValues.find(option => /-free$/.test(option.value))?.value ||
    modelValues.find(option => option.value === 'opencode/big-pickle')?.value;
  const modelSelection =
    modelOption && preferredModel
      ? await attempt(() =>
          withTimeout(
            connection.agent.request(acp.methods.agent.session.setConfigOption, {
              sessionId: created.sessionId,
              configId: modelOption.id,
              value: preferredModel,
            }),
            'ACP session/set_config_option',
          ),
        )
      : { ok: false, errorName: 'NoFreeModelOption' };
  const loaded = await attempt(() =>
    withTimeout(
      connection.agent.request(acp.methods.agent.session.load, {
        sessionId: created.sessionId,
        cwd: workspace,
        mcpServers: [],
      }),
      'ACP session/load',
    ),
  );
  const prompt = await attempt(() =>
    withTimeout(
      connection.agent.request(acp.methods.agent.session.prompt, {
        sessionId: created.sessionId,
        prompt: [{ type: 'text', text: 'Reply with exactly PANE_RELAY_OPENCODE_ACP_OK.' }],
      }),
      'ACP session/prompt',
    ),
  );
  const imagePrompt = await attempt(() =>
    withTimeout(
      connection.agent.request(acp.methods.agent.session.prompt, {
        sessionId: created.sessionId,
        prompt: [
          {
            type: 'image',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            mimeType: 'image/png',
          },
          { type: 'text', text: 'Acknowledge the attached image in one word.' },
        ],
      }),
      'ACP image prompt',
    ),
  );
  const rejectedPermissionAttempts = [];
  const rejectedPermissionPrompts = [
    'Use the write tool to create acp-permission-reject-probe.txt containing PANE_RELAY_PERMISSION_REJECT, then stop.',
    'Call the write tool now; do not answer without calling it. Create acp-permission-reject-probe.txt containing exactly PANE_RELAY_PERMISSION_REJECT.',
  ];
  for (const promptText of rejectedPermissionPrompts) {
    rejectedPermissionAttempts.push(
      await attempt(() =>
        withTimeout(
          connection.agent.request(acp.methods.agent.session.prompt, {
            sessionId: created.sessionId,
            prompt: [{ type: 'text', text: promptText }],
          }),
          'ACP rejected permission prompt',
        ),
      ),
    );
    if (permissionSelections.reject > 0) break;
  }
  let rejectedPermissionFileExists = true;
  try {
    await access(join(workspace, 'acp-permission-reject-probe.txt'));
  } catch {
    rejectedPermissionFileExists = false;
  }
  permissionDecision = 'allowOnce';
  const approvedPermissionAttempts = [];
  const approvedPermissionPrompts = [
    'Use the write tool to create acp-permission-allow-probe.txt containing exactly PANE_RELAY_PERMISSION_ALLOW, then stop.',
    'Call the write tool now; do not answer without calling it. Create acp-permission-allow-probe.txt containing exactly PANE_RELAY_PERMISSION_ALLOW.',
  ];
  for (const promptText of approvedPermissionPrompts) {
    approvedPermissionAttempts.push(
      await attempt(() =>
        withTimeout(
          connection.agent.request(acp.methods.agent.session.prompt, {
            sessionId: created.sessionId,
            prompt: [{ type: 'text', text: promptText }],
          }),
          'ACP approved permission prompt',
        ),
      ),
    );
    if (permissionSelections.allowOnce > 0) break;
  }
  let approvedPermissionFileContent = null;
  try {
    approvedPermissionFileContent = await readFile(
      join(workspace, 'acp-permission-allow-probe.txt'),
      'utf8',
    );
  } catch {
    // The bounded result below records that the approved write did not complete.
  }
  const permissionEvidenceComplete =
    rejectedPermissionAttempts.at(-1)?.ok === true &&
    permissionSelections.reject > 0 &&
    !rejectedPermissionFileExists &&
    approvedPermissionAttempts.at(-1)?.ok === true &&
    permissionSelections.allowOnce > 0 &&
    approvedPermissionFileContent?.trim() === 'PANE_RELAY_PERMISSION_ALLOW';
  const interruptedPrompt = connection.agent.request(acp.methods.agent.session.prompt, {
    sessionId: created.sessionId,
    prompt: [{ type: 'text', text: 'Write a detailed numbered list with one hundred items.' }],
  });
  await connection.agent.notify(acp.methods.agent.session.cancel, {
    sessionId: created.sessionId,
  });
  const interruption = await attempt(() =>
    withTimeout(interruptedPrompt, 'ACP interrupted prompt'),
  );
  const closeSession = await attempt(() =>
    withTimeout(
      connection.agent.request(acp.methods.agent.session.close, {
        sessionId: created.sessionId,
      }),
      'ACP session/close',
    ),
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        version,
        protocolVersion: initialized.protocolVersion,
        agentInfo: initialized.agentInfo,
        capabilities: initialized.agentCapabilities,
        list: {
          ok: listed.ok,
          sessionCount: listed.ok ? listed.value.sessions.length : null,
        },
        newSession: {
          idReturned: Boolean(created.sessionId),
          configOptionCategories: (created.configOptions || []).map(option => option.category),
          mcpServersInjected: 0,
        },
        load: { ok: loaded.ok },
        modelSelection: { ok: modelSelection.ok, selected: preferredModel || null },
        prompt: {
          ok: prompt.ok,
          stopReason: prompt.ok ? prompt.value.stopReason : null,
          assistantTextChars,
        },
        imagePrompt: {
          ok: imagePrompt.ok,
          stopReason: imagePrompt.ok ? imagePrompt.value.stopReason : null,
        },
        permission: {
          complete: permissionEvidenceComplete,
          requests: permissionRequests,
          responses: permissionResponses,
          rejection: {
            attempts: rejectedPermissionAttempts.length,
            promptCompleted: rejectedPermissionAttempts.at(-1)?.ok === true,
            optionSelected: permissionSelections.reject > 0,
            fileCreated: rejectedPermissionFileExists,
          },
          approval: {
            attempts: approvedPermissionAttempts.length,
            promptCompleted: approvedPermissionAttempts.at(-1)?.ok === true,
            optionSelected: permissionSelections.allowOnce > 0,
            fileContentMatched:
              approvedPermissionFileContent?.trim() === 'PANE_RELAY_PERMISSION_ALLOW',
          },
        },
        interruption: {
          requestSettled: interruption.ok,
          stopReason: interruption.ok ? interruption.value.stopReason : null,
        },
        closeSession: { ok: closeSession.ok },
        updateKinds: Object.fromEntries([...updates.entries()].sort()),
        browserIntegrationUpdates: browserToolUpdates,
        stderrBytes,
      },
      null,
      2,
    )}\n`,
  );
  if (!permissionEvidenceComplete) process.exitCode = 1;
} finally {
  const processExit =
    child.exitCode !== null
      ? Promise.resolve(true)
      : new Promise(resolve => child.once('exit', () => resolve(true)));
  connection.close();
  if (!child.killed && child.exitCode === null) child.kill('SIGTERM');
  cleanProcessShutdown = await Promise.race([
    processExit,
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5_000);
      timer.unref();
    }),
  ]);
  if (cleanProcessShutdown || child.exitCode !== null) {
    processTerminated = true;
  } else {
    const forcedExit = new Promise(resolve => child.once('exit', () => resolve(true)));
    child.kill('SIGKILL');
    processTerminated = await Promise.race([
      forcedExit,
      new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), 5_000);
        timer.unref();
      }),
    ]);
  }
  await Promise.all([
    rm(stateRoot, { force: true, recursive: true }),
    rm(workspace, { force: true, recursive: true }),
  ]);
  process.stderr.write(
    `gracefulProcessShutdown=${String(cleanProcessShutdown)} processTerminated=${String(processTerminated)}\n`,
  );
}
