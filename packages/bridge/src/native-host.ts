#!/usr/bin/env node

import { lstat, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PANERELAY_BROWSER_ID_ENV,
  removeOwnedBrowserRegistration,
  writeBrowserRegistration,
} from '@panerelay/browser-registry';
import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isExtensionToHostMessage,
  isNativeTransferEnvelope,
  isPanerelayReleaseVersion,
  type AgentRequestMessage,
  type BridgeState,
  type HostToExtensionMessage,
  type IntegrationRequestMessage,
} from '@panerelay/protocol';
import { handlePluginRequest } from '@panerelay/agent-browser';
import { AgentService } from './agent-service.js';
import { NativeMessageDecoder, encodeNativeMessage } from './native-messaging.js';
import { BrowserRelay } from './browser-relay.js';
import { readRuntimeConfig } from './runtime-config.js';
import { environmentWithExecutablePath } from './platform.js';
import { IntegrationService } from './integration-service.js';
import { ensureBrowserUseGateway, runBrowserUseGateway } from './browser-use-gateway.js';
import { PANERELAY_HOST_RELEASE_VERSION } from './host-release.js';
import { HostReleaseCoordinator } from './host-release-coordinator.js';
import { runNativeHostUpdate } from './host-updater.js';

function log(message: string): void {
  process.stderr.write(`[Panerelay] ${message}\n`);
}

function sendNativeEnvelope(message: unknown): void {
  for (const frame of encodeNativeTransfer(message)) {
    process.stdout.write(encodeNativeMessage(frame));
  }
}

function sendToExtension(message: HostToExtensionMessage): void {
  sendNativeEnvelope(message);
}

async function flushNativeOutput(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(Buffer.alloc(0), error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function isInstalledHostTarget(targetVersion: string): Promise<boolean> {
  const pointerPath = join(homedir(), '.panerelay', 'host-current.json');
  const info = await lstat(pointerPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 512) return false;
  if (process.platform !== 'win32' && (info.mode & 0o022) !== 0) return false;
  const value = JSON.parse(await readFile(pointerPath, 'utf8')) as Record<string, unknown>;
  return (
    Object.keys(value).length === 1 &&
    isPanerelayReleaseVersion(value.version) &&
    value.version === targetVersion
  );
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

function runSelfCheck(): void {
  process.stdout.write(
    `${JSON.stringify({
      protocol: PANERELAY_PROTOCOL_VERSION,
      release: PANERELAY_HOST_RELEASE_VERSION,
    })}\n`,
  );
}

async function main(): Promise<void> {
  const runtimeConfig = await readRuntimeConfig();
  const expectedExtensionId = runtimeConfig.extensionId ?? PANERELAY_EXTENSION_ID;
  const hostEnvironment = environmentWithExecutablePath(
    process.env,
    runtimeConfig.agentPathEntries ?? [],
  );
  let currentBrowser: BridgeState | null = null;
  let restartHost: () => Promise<void> = async () => {};
  const releaseCoordinator = new HostReleaseCoordinator({
    hostVersion: PANERELAY_HOST_RELEASE_VERSION,
    isTargetInstalled: async targetVersion =>
      isInstalledHostTarget(targetVersion).catch(() => false),
    requestRestart: () => restartHost(),
    runUpdate: targetVersion =>
      runNativeHostUpdate(targetVersion, {
        environment: hostEnvironment,
        nodePath: process.execPath,
      }),
    sendToExtension,
  });
  const agents = new AgentService(sendToExtension, {
    environment: hostEnvironment,
  });
  const integrations = new IntegrationService(sendToExtension, {
    currentBrowser: () => currentBrowser,
  });
  const relay = await BrowserRelay.listen({
    expectedExtensionId,
    hostVersion: PANERELAY_HOST_RELEASE_VERSION,
    afterBrowserRegistration: browser => releaseCoordinator.evaluateRegistration(browser),
    onHostUpdateRetry: () => releaseCoordinator.retry(),
    sendToExtension,
    onBrowserRegistered: async browser => {
      const state: BridgeState = {
        protocol: PANERELAY_PROTOCOL_VERSION,
        pid: process.pid,
        port: relay.port,
        token: relay.token,
        generation: relay.generation,
        browserId: browser.browserId,
        browserName: browser.browserName,
        extensionReleaseVersion: browser.releaseVersion,
        extensionBuildVersion: browser.buildVersion,
        hostVersion: PANERELAY_HOST_RELEASE_VERSION,
        extensionId: browser.extensionId,
        ...(browser.browserFamily ? { browserFamily: browser.browserFamily } : {}),
        ...(browser.capabilities ? { capabilities: browser.capabilities } : {}),
        updatedAt: new Date().toISOString(),
      };
      await writeBrowserRegistration(state);
      if (currentBrowser && currentBrowser.browserId !== state.browserId) {
        await removeOwnedBrowserRegistration(currentBrowser.browserId, currentBrowser.pid);
      }
      currentBrowser = state;
      process.env[PANERELAY_BROWSER_ID_ENV] = state.browserId;
      log(`Extension registered; CDP relay listening on 127.0.0.1:${relay.port}`);
      await ensureBrowserUseGateway().catch(error =>
        log(
          `Browser Use gateway unavailable: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    },
    onBrowserDisconnected: async () => {
      if (currentBrowser) {
        await removeOwnedBrowserRegistration(currentBrowser.browserId, currentBrowser.pid);
      }
      currentBrowser = null;
      delete process.env[PANERELAY_BROWSER_ID_ENV];
    },
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
    if (currentBrowser) {
      await removeOwnedBrowserRegistration(currentBrowser.browserId, currentBrowser.pid);
      currentBrowser = null;
    }
    delete process.env[PANERELAY_BROWSER_ID_ENV];
  }

  restartHost = async () => {
    await flushNativeOutput().catch(error =>
      log(`Native Host restart status could not be flushed: ${String(error)}`),
    );
    await shutdown('Native Host update installed; reconnect required');
    process.exit(0);
  };

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
              : message.type === 'integration.request'
                ? integrations.handle(message as IntegrationRequestMessage)
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

const operation = process.argv.includes('--self-check')
  ? Promise.resolve(runSelfCheck())
  : process.argv.includes('--browser-use-gateway')
    ? runBrowserUseGateway()
    : process.argv.includes('--agent-browser-plugin')
      ? runAgentBrowserPlugin()
      : main();

void operation.catch(error => {
  log(`Bridge failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
