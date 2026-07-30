import type {
  SidePanelRequest,
  SidePanelRuntimeMessage,
  SidePanelSuccessResponse,
} from '../../shared/messages.js';

export type SidepanelRuntimeMessage = Partial<SidePanelRuntimeMessage>;

export interface SidepanelClient {
  getStored(keys: string[]): Promise<Record<string, unknown>>;
  setStored(values: Record<string, unknown>): Promise<void>;
  request(message: SidePanelRequest): Promise<SidePanelSuccessResponse>;
  requestOrigins(origins: string[]): Promise<boolean>;
  subscribe(listener: (message: SidepanelRuntimeMessage) => void): () => void;
  prefersLightTheme(): boolean;
  subscribeColorScheme(listener: () => void): () => void;
}

export const browserSidepanelClient: SidepanelClient = {
  async getStored(keys) {
    return chrome.storage.local.get(keys);
  },

  async setStored(values) {
    await chrome.storage.local.set(values);
  },

  async request(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.success) throw new Error(response?.error || 'Panerelay request failed');
    return response as SidePanelSuccessResponse;
  },

  async requestOrigins(origins) {
    return chrome.permissions.request({ origins });
  },

  subscribe(listener) {
    const runtimeListener = (message: unknown) => {
      listener(message as SidepanelRuntimeMessage);
    };
    chrome.runtime.onMessage.addListener(runtimeListener);
    return () => chrome.runtime.onMessage.removeListener(runtimeListener);
  },

  prefersLightTheme() {
    return matchMedia('(prefers-color-scheme: light)').matches;
  },

  subscribeColorScheme(listener) {
    const media = matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  },
};
