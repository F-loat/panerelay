#!/usr/bin/env node

import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isExtensionToHostMessage,
  isNativeTransferEnvelope,
  type AgentRequestMessage,
  type BridgeState,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import { handlePluginRequest } from '@panerelay/agent-browser';
import { AgentService } from './agent-service.js';
import { NativeMessageDecoder, encodeNativeMessage } from './native-messaging.js';
import { BrowserRelay } from './browser-relay.js';
import { removeOwnedBridgeState, writeBridgeState } from './state.js';

function log(message: string): void {
  process.stderr.write(`[PaneRelay] ${message}\n`);
}

function sendNativeEnvelope(message: unknown): void {
  for (const frame of encodeNativeTransfer(message)) {
    process.stdout.write(encodeNativeMessage(frame));
  }
}

function sendToExtension(message: HostToExtensionMessage): void {
  sendNativeEnvelope(message);
}

async function runAgentBrowserPlugin(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    input = {};
  }
  const response = await handlePluginRequest(input as Record<string, unknown>);
  process.stdout.write(JSON.stringify(response));
}

async function main(): Promise<void> {
  const agents = new AgentService(sendToExtension);
  const relay = await BrowserRelay.listen({
    sendToExtension,
    onBrowserRegistered: async browser => {
      const state: BridgeState = {
        protocol: PANERELAY_PROTOCOL_VERSION,
        pid: process.pid,
        port: relay.port,
        token: relay.token,
        browserId: browser.browserId,
        browserName: browser.browserName,
        extensionVersion: browser.extensionVersion,
        extensionId: PANERELAY_EXTENSION_ID,
        updatedAt: new Date().toISOString(),
      };
      await writeBridgeState(state);
      log(`Extension registered; CDP relay listening on 127.0.0.1:${relay.port}`);
    },
    onBrowserDisconnected: removeOwnedBridgeState,
  });

  const decoder = new NativeMessageDecoder();
  const transferReceiver = new NativeTransferReceiver();
  const transferCleanupTimer = setInterval(() => {
    for (const transferId of transferReceiver.expire()) {
      log(`Cancelled incomplete Native Messaging transfer ${transferId}`);
      sendNativeEnvelope(
        createNativeTransferCancel(
          transferId,
          'Native Messaging transfer timed out before all chunks arrived',
        ),
      );
    }
  }, PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS);
  transferCleanupTimer.unref();
  let shuttingDown = false;

  async function shutdown(reason: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(transferCleanupTimer);
    transferReceiver.cancelAll();
    await agents.close().catch(error => log(`Agent shutdown failed: ${String(error)}`));
    await relay.close(reason).catch(error => log(`Relay shutdown failed: ${String(error)}`));
    await removeOwnedBridgeState();
  }

  process.stdin.on('data', (chunk: Buffer) => {
    try {
      for (const frame of decoder.push(chunk)) {
        let messages: unknown[];
        try {
          messages = transferReceiver.push(frame);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          log(`Cancelled invalid Native Messaging transfer: ${reason}`);
          if (isNativeTransferEnvelope(frame) && frame.type === 'transport.chunk') {
            sendNativeEnvelope(createNativeTransferCancel(frame.transferId, reason));
          }
          continue;
        }
        for (const message of messages) {
          if (!isExtensionToHostMessage(message)) {
            log('Ignored an invalid extension message');
            continue;
          }
          const operation =
            message.type === 'agent.request'
              ? agents.handle(message as AgentRequestMessage)
              : relay.handleExtensionMessage(message);
          void operation.catch(error => {
            log(
              `Extension message failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }
      }
    } catch (error) {
      log(
        `Native Messaging decode failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      void shutdown('Invalid Native Messaging payload').finally(() => process.exit(1));
    }
  });

  process.stdin.on('end', () => {
    void shutdown('Extension disconnected').finally(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    void shutdown('Bridge interrupted').finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown('Bridge terminated').finally(() => process.exit(0));
  });
}

const operation = process.argv.includes('--agent-browser-plugin')
  ? runAgentBrowserPlugin()
  : main();

void operation.catch(error => {
  log(`Bridge failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
