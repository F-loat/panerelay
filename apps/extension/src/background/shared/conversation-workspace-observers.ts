import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type {
  ConversationWorkspaceStore,
  RemovedConversationWorkspace,
} from './conversation-workspaces.js';

export interface ConversationWorkspaceObserverCallbacks {
  onInherited?: (tabId: number, workspace: ConversationWorkspaceSnapshot) => void | Promise<void>;
  onRemoved?: (tabId: number, removed: RemovedConversationWorkspace) => void | Promise<void>;
}

function validTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function installConversationWorkspaceObservers(
  store: ConversationWorkspaceStore,
  callbacks: ConversationWorkspaceObserverCallbacks = {},
): void {
  const inherit = (sourceTabId: number, tabId: number) => {
    void store
      .inherit(sourceTabId, tabId)
      .then(workspace => {
        if (workspace) return callbacks.onInherited?.(tabId, workspace);
      })
      .catch(error => {
        console.warn('[Panerelay] Failed to inherit a related tab workspace:', error);
      });
  };

  chrome.tabs.onCreated.addListener(tab => {
    if (validTabId(tab.openerTabId) && validTabId(tab.id)) {
      inherit(tab.openerTabId, tab.id);
    }
  });

  chrome.tabs.onRemoved.addListener(tabId => {
    void store
      .remove(tabId)
      .then(removed => {
        if (removed) return callbacks.onRemoved?.(tabId, removed);
      })
      .catch(error => {
        console.warn('[Panerelay] Failed to remove a closed tab workspace:', error);
      });
  });

  chrome.webNavigation.onCreatedNavigationTarget.addListener(details => {
    inherit(details.sourceTabId, details.tabId);
  });
}
