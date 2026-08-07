import type {
  BrowserFetchPermissionResult,
  BrowserFetchPermissionScope,
} from '@panerelay/protocol';
import {
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  PANERELAY_FETCH_PERMISSION_TIMEOUT_MS,
} from '@panerelay/protocol';
import {
  fetchAuthorizationCommand,
  fetchPermissionPatterns,
  grantFetchDomain,
  revokeFetchDomain,
} from '../shared/fetch-permissions.js';

export interface FetchPermissionDecisionMessage {
  type: 'panerelay.fetch-permission.decision';
  requestId: string;
  granted: boolean;
  scope?: BrowserFetchPermissionScope;
}

interface FetchPermissionRequestEnvironment {
  addDecisionListener(listener: (message: unknown) => void): void;
  removeDecisionListener(listener: (message: unknown) => void): void;
  addWindowRemovedListener(listener: (windowId: number) => void): void;
  removeWindowRemovedListener(listener: (windowId: number) => void): void;
  createPopup(url: string): Promise<number>;
  removeWindow(windowId: number): Promise<void>;
  extensionUrl(path: string): string;
  containsOrigins(origins: string[]): Promise<boolean>;
  grantDomain(domain: string): Promise<void>;
  revokeDomain(domain: string): Promise<void>;
}

function chromeEnvironment(): FetchPermissionRequestEnvironment {
  return {
    addDecisionListener(listener) {
      chrome.runtime.onMessage.addListener(listener);
    },
    removeDecisionListener(listener) {
      chrome.runtime.onMessage.removeListener(listener);
    },
    addWindowRemovedListener(listener) {
      chrome.windows.onRemoved.addListener(listener);
    },
    removeWindowRemovedListener(listener) {
      chrome.windows.onRemoved.removeListener(listener);
    },
    async createPopup(url) {
      const lastWindow = await chrome.windows
        .getLastFocused({ windowTypes: ['normal'] })
        .catch(() => null);
      const width = 420;
      const height = 400;
      const left =
        lastWindow?.left !== undefined && lastWindow.width !== undefined
          ? Math.round(lastWindow.left + (lastWindow.width - width) / 2)
          : undefined;
      const top =
        lastWindow?.top !== undefined && lastWindow.height !== undefined
          ? Math.round(lastWindow.top + (lastWindow.height - height) / 2)
          : undefined;
      const created = await chrome.windows.create({
        url,
        type: 'popup',
        width,
        height,
        ...(left === undefined ? {} : { left }),
        ...(top === undefined ? {} : { top }),
        focused: true,
      });
      if (created?.id === undefined) throw new Error('Unable to open fetch authorization window');
      return created.id;
    },
    async removeWindow(windowId) {
      await chrome.windows.remove(windowId);
    },
    extensionUrl(path) {
      return chrome.runtime.getURL(path);
    },
    containsOrigins(origins) {
      return chrome.permissions.contains({ origins });
    },
    async grantDomain(domain) {
      await grantFetchDomain(domain);
    },
    async revokeDomain(domain) {
      await revokeFetchDomain(domain);
    },
  };
}

function isDecision(value: unknown): value is FetchPermissionDecisionMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<FetchPermissionDecisionMessage>;
  return (
    candidate.type === 'panerelay.fetch-permission.decision' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.granted === 'boolean' &&
    (candidate.scope === undefined || candidate.scope === 'domain')
  );
}

interface PendingPermission {
  windowId: number;
  reject(error: Error): void;
}

export class FetchPermissionRequestManager {
  private readonly pending = new Map<string, PendingPermission>();

  constructor(
    private readonly environment: FetchPermissionRequestEnvironment = chromeEnvironment(),
    private readonly timeoutMs = PANERELAY_FETCH_PERMISSION_TIMEOUT_MS,
  ) {}

  async request(domain: string): Promise<BrowserFetchPermissionResult> {
    const requestId = crypto.randomUUID();
    const popupUrl = new URL(
      this.environment.extensionUrl('src/pages/fetch-permission/index.html'),
    );
    popupUrl.searchParams.set('domain', domain);
    popupUrl.searchParams.set('requestId', requestId);
    const windowId = await this.environment.createPopup(popupUrl.toString());

    return new Promise<BrowserFetchPermissionResult>((resolve, reject) => {
      let settled = false;
      let settling = false;

      const cleanup = () => {
        this.pending.delete(requestId);
        this.environment.removeDecisionListener(onDecision);
        this.environment.removeWindowRemovedListener(onWindowRemoved);
        clearTimeout(timer);
      };
      const finish = (result: BrowserFetchPermissionResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        void this.environment.removeWindow(windowId).catch(() => undefined);
        resolve(result);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        void this.environment.removeWindow(windowId).catch(() => undefined);
        reject(error);
      };
      const deny = () =>
        finish({ protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL, granted: false, domain });
      const onDecision = (message: unknown) => {
        if (!isDecision(message) || message.requestId !== requestId || settling || settled) return;
        settling = true;
        if (!message.granted) {
          void this.environment
            .revokeDomain(domain)
            .then(deny)
            .catch(error => fail(error instanceof Error ? error : new Error(String(error))));
          return;
        }
        if (!message.scope) {
          deny();
          return;
        }
        void (async () => {
          const patterns = fetchPermissionPatterns(message.scope!, domain);
          if (!(await this.environment.containsOrigins(patterns))) {
            throw new Error(
              `Chrome site access was not granted. Ask the user to retry: ${fetchAuthorizationCommand(domain)}`,
            );
          }
          if (settled) return;
          await this.environment.grantDomain(domain);
          finish({
            protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
            granted: true,
            domain,
            scope: message.scope,
          });
        })().catch(error => fail(error instanceof Error ? error : new Error(String(error))));
      };
      const onWindowRemoved = (removedWindowId: number) => {
        if (removedWindowId === windowId && !settling) deny();
      };
      const timer = setTimeout(() => deny(), this.timeoutMs);

      this.environment.addDecisionListener(onDecision);
      this.environment.addWindowRemovedListener(onWindowRemoved);
      this.pending.set(requestId, { windowId, reject: fail });
    });
  }

  cancelAll(reason: string): void {
    for (const pending of [...this.pending.values()]) pending.reject(new Error(reason));
  }
}
