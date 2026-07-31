#!/usr/bin/env node

import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS,
  PANERELAY_PROTOCOL_VERSION,
  PANERELAY_FIREFOX_EXTENSION_ID,
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  isExtensionToHostMessage,
  isNativeTransferEnvelope,
  normalizeAutomationCapability,
  type AgentRequestMessage,
  type BridgeState,
  type HostToExtensionMessage,
  type IntegrationRequestMessage,
} from '@panerelay/protocol';
import { handlePluginRequest } from '@panerelay/agent-browser';
import { AgentService } from './agent-service.js';
import { NativeMessageDecoder, encodeNativeMessage } from './native-messaging.js';
import { BrowserRelay } from './browser-relay.js';
import { removeOwnedBridgeState, writeBridgeState } from './state.js';
import { readRuntimeConfig } from './runtime-config.js';
import { IntegrationService } from './integration-service.js';
import { launchManagedFirefox } from './firefox-automation.js';
import { FirefoxDriverManager } from './firefox-driver.js';

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

async function runFirefoxLauncher(): Promise<void> {
  if (process.argv.filter(argument => argument !== '--launch-firefox').length > 2) {
    throw new Error('The Panerelay Firefox launcher does not accept browser arguments');
  }
  const runtimeConfig = await readRuntimeConfig();
  if (
    !runtimeConfig.firefoxRuntimeStatePath ||
    typeof runtimeConfig.firefoxMarionettePort !== 'number'
  ) {
    throw new Error('Run Panerelay setup before using the Firefox automation launcher');
  }
  const record = await launchManagedFirefox({
    firefoxPath: runtimeConfig.firefoxPath,
    firefoxVersion: runtimeConfig.firefoxVersion,
    firefoxProfile: runtimeConfig.firefoxProfile,
    geckodriverPath: runtimeConfig.geckodriverPath,
    geckodriverVersion: runtimeConfig.geckodriverVersion,
    managedToken: runtimeConfig.firefoxManagedToken,
    marionettePort: runtimeConfig.firefoxMarionettePort,
    runtimeStatePath: runtimeConfig.firefoxRuntimeStatePath,
  });
  process.stdout.write(`Started managed Firefox process ${record.pid}\n`);
}

async function main(): Promise<void> {
  const runtimeConfig = await readRuntimeConfig();
  const expectedExtensionId = runtimeConfig.extensionId ?? PANERELAY_EXTENSION_ID;
  const expectedFirefoxExtensionId =
    runtimeConfig.firefoxExtensionId ?? PANERELAY_FIREFOX_EXTENSION_ID;
  const agents = new AgentService(sendToExtension);
  const integrations = new IntegrationService(sendToExtension);
  const firefoxDriver = new FirefoxDriverManager(
    {
      firefoxPath: runtimeConfig.firefoxPath,
      firefoxVersion: runtimeConfig.firefoxVersion,
      firefoxProfile: runtimeConfig.firefoxProfile,
      geckodriverPath: runtimeConfig.geckodriverPath,
      geckodriverVersion: runtimeConfig.geckodriverVersion,
      managedToken: runtimeConfig.firefoxManagedToken,
      marionettePort: runtimeConfig.firefoxMarionettePort ?? 2828,
      runtimeStatePath: runtimeConfig.firefoxRuntimeStatePath ?? '',
    },
    {
      onDisconnect: readiness => {
        sendToExtension(readiness);
        relay?.handleWebDriverUnavailable(readiness.message);
      },
    },
  );
  const relay = await BrowserRelay.listen({
    expectedExtensionIds: [expectedExtensionId, expectedFirefoxExtensionId],
    sendToExtension,
    webdriverDriver: firefoxDriver,
    onBrowserRegistered: async browser => {
      const state: BridgeState = {
        protocol: PANERELAY_PROTOCOL_VERSION,
        pid: process.pid,
        port: relay.port,
        token: relay.token,
        browserId: browser.browserId,
        browserName: browser.browserName,
        extensionVersion: browser.extensionVersion,
        extensionId: browser.extensionId,
        ...(browser.browserFamily ? { browserFamily: browser.browserFamily } : {}),
        ...(browser.capabilities ? { capabilities: browser.capabilities } : {}),
        automation: normalizeAutomationCapability(browser.capabilities),
        updatedAt: new Date().toISOString(),
      };
      await writeBridgeState(state);
      log(
        `Extension registered; ${state.automation.transport.toUpperCase()} relay listening on 127.0.0.1:${relay.port}`,
      );
      if (browser.browserFamily === 'firefox') {
        sendToExtension(await firefoxDriver.ensureReady());
      }
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
    await firefoxDriver
      .close()
      .catch(error => log(`Firefox driver shutdown failed: ${String(error)}`));
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

const operation = process.argv.includes('--agent-browser-plugin')
  ? runAgentBrowserPlugin()
  : process.argv.includes('--launch-firefox')
    ? runFirefoxLauncher()
    : main();

void operation.catch(error => {
  log(`Bridge failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
