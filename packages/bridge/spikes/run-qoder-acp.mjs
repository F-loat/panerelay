#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';

const executable =
  process.argv[2] || process.env.PANERELAY_QODER_PATH || process.env.QODER_PATH || 'qodercli';
const timeoutMs = 45_000;
const promptText = 'Reply with exactly: PANE_RELAY_QODER_ACP_OK';
const updates = new Map();
const assistantChunks = [];
let permissionRequests = 0;

function withTimeout(promise, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function recordUpdate(notification) {
  const kind = notification.update.sessionUpdate;
  updates.set(kind, (updates.get(kind) || 0) + 1);
  if (
    kind === 'agent_message_chunk' &&
    notification.update.content.type === 'text' &&
    assistantChunks.join('').length < 512
  ) {
    assistantChunks.push(notification.update.content.text.slice(0, 512));
  }
}

const version = execFileSync(executable, ['--version'], {
  encoding: 'utf8',
  timeout: 5_000,
}).trim();
const child = spawn(executable, ['--acp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
let stderrBytes = 0;
child.stderr.on('data', chunk => {
  stderrBytes += chunk.length;
});

const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
const app = acp
  .client({ name: 'panerelay-qoder-spike' })
  .onRequest(acp.methods.client.session.requestPermission, () => {
    permissionRequests += 1;
    return { outcome: { outcome: 'cancelled' } };
  })
  .onNotification(acp.methods.client.session.update, context => {
    recordUpdate(context.params);
  });
const connection = app.connect(stream);

try {
  const initialized = await withTimeout(
    connection.agent.request(acp.methods.agent.initialize, {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {},
      clientInfo: {
        name: 'panerelay-qoder-spike',
        title: 'Panerelay Qoder ACP spike',
        version: '0.0.0-spike',
      },
    }),
    'ACP initialize',
  );
  const session = await withTimeout(
    connection.agent.request(acp.methods.agent.session.new, {
      cwd: process.cwd(),
      mcpServers: [],
    }),
    'ACP session/new',
  );
  const prompt = await withTimeout(
    connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: promptText }],
    }),
    'ACP session/prompt',
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        executable,
        version,
        protocolVersion: initialized.protocolVersion,
        agentInfo: initialized.agentInfo,
        capabilities: initialized.agentCapabilities,
        session: {
          idReturned: Boolean(session.sessionId),
          configOptionCategories: (session.configOptions || []).map(option => option.category),
        },
        prompt: {
          sent: promptText,
          response: assistantChunks.join('').trim().slice(0, 512),
          stopReason: prompt.stopReason,
          usageReported: Boolean(prompt.usage),
        },
        updateKinds: Object.fromEntries([...updates.entries()].sort()),
        permissionRequests,
        stderrBytes,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  connection.close();
  if (!child.killed) child.kill('SIGTERM');
}
