import {
  PANERELAY_PROTOCOL_VERSION,
  comparePanerelayReleaseVersions,
  nativeHostManualUpdateCommand,
  type BrowserRegistration,
  type HostToExtensionMessage,
  type HostUpdateError,
  type HostUpdateStatusMessage,
} from '@panerelay/protocol';
import { NativeHostUpdateFailure } from './host-updater.js';

type HostUpdateStatusPayload<T = HostUpdateStatusMessage> = T extends HostUpdateStatusMessage
  ? Omit<T, 'protocol' | 'type'>
  : never;

export type HostReleaseState =
  'checking' | 'required' | 'updating' | 'restart-pending' | 'failed' | 'incompatible' | 'ready';

export interface HostReleaseCoordinatorOptions {
  hostVersion: string;
  isTargetInstalled?: (targetVersion: string) => boolean | Promise<boolean>;
  requestRestart: () => void | Promise<void>;
  runUpdate: (targetVersion: string) => Promise<void>;
  sendToExtension: (message: HostToExtensionMessage) => void;
}

function failureCategory(error: unknown): HostUpdateError {
  return error instanceof NativeHostUpdateFailure ? error.updateError : 'unknown';
}

function failureDetail(error: HostUpdateError): string {
  const details: Record<HostUpdateError, string> = {
    'lock-timeout': 'Another Panerelay Host update did not finish in time.',
    network: 'The exact Panerelay setup package could not be downloaded.',
    'package-unavailable': 'The local package runner is unavailable.',
    'setup-failed': 'The exact Panerelay setup package did not complete successfully.',
    timeout: 'The Panerelay Host update timed out.',
    'verification-failed': 'The replacement Panerelay Host did not pass verification.',
    unknown: 'The Panerelay Host update could not be completed.',
  };
  return details[error];
}

export class HostReleaseCoordinator {
  #automaticAttempted = false;
  #operation: Promise<void> | null = null;
  #state: HostReleaseState = 'checking';
  #targetVersion: string | null = null;

  constructor(private readonly options: HostReleaseCoordinatorOptions) {}

  get state(): HostReleaseState {
    return this.#state;
  }

  get targetVersion(): string | null {
    return this.#targetVersion;
  }

  async evaluateRegistration(browser: BrowserRegistration): Promise<void> {
    if (!browser.checkHostUpdate) {
      if (!this.#automaticAttempted) this.#state = 'ready';
      return;
    }
    if (this.#targetVersion && this.#targetVersion !== browser.releaseVersion) {
      return;
    }
    const comparison = comparePanerelayReleaseVersions(
      this.options.hostVersion,
      browser.releaseVersion,
    );
    if (comparison >= 0) {
      this.#state = 'ready';
      this.#targetVersion = browser.releaseVersion;
      return;
    }

    this.#targetVersion = browser.releaseVersion;
    if (this.#automaticAttempted) {
      return;
    }

    this.#automaticAttempted = true;
    await this.#startUpdate(browser.releaseVersion);
  }

  async retry(): Promise<void> {
    if (this.#state !== 'failed' || !this.#targetVersion) return;
    await this.#startUpdate(this.#targetVersion);
  }

  async #startUpdate(targetVersion: string): Promise<void> {
    if (this.#operation) return this.#operation;
    const operation = this.#performUpdate(targetVersion).finally(() => {
      if (this.#operation === operation) this.#operation = null;
    });
    this.#operation = operation;
    return operation;
  }

  async #performUpdate(targetVersion: string): Promise<void> {
    try {
      if (!(await this.options.isTargetInstalled?.(targetVersion))) {
        this.#state = 'updating';
        await this.options.runUpdate(targetVersion);
      }
    } catch (error) {
      const updateError = failureCategory(error);
      if (updateError === 'package-unavailable') {
        this.#state = 'ready';
        return;
      }
      this.#state = 'failed';
      this.#send({
        state: 'failed',
        hostVersion: this.options.hostVersion,
        targetVersion,
        retryAvailable: true,
        error: updateError,
        detail: failureDetail(updateError),
        manualCommand: nativeHostManualUpdateCommand(targetVersion),
      });
      return;
    }
    await this.#restart(targetVersion);
  }

  async #restart(targetVersion: string): Promise<void> {
    this.#state = 'restart-pending';
    try {
      this.#send({
        state: 'restart-pending',
        hostVersion: this.options.hostVersion,
        targetVersion,
        retryAvailable: false,
      });
    } catch {
      // The replacement is committed; restart even if the old Extension transport is gone.
    }
    await this.options.requestRestart();
  }

  #send(message: HostUpdateStatusPayload): void {
    this.options.sendToExtension({
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      ...message,
    } as HostUpdateStatusMessage);
  }
}
