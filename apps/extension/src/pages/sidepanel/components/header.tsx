import {
  Bot,
  ChevronDown,
  LoaderCircle,
  MessagesSquare,
  PanelTop,
  Search,
  SquarePen,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  formatForState,
  type SidepanelController,
  type SidepanelState,
} from '../sidepanel-controller.js';
import { translate } from '../i18n.js';
import { SelectMenu, type SelectMenuOption } from '../dropdown.js';
import { authorizationDetails } from './access-settings.js';
import { useCopy } from './presentation.js';

function connectionDetails(state: SidepanelState) {
  const currentProvider = state.providers.find(item => item.id === state.currentProviderId);
  const preparation = state.providerPreparations[state.currentProviderId];
  if (!state.extensionStatus?.bridgeConnected) {
    return { label: translate(state.locale, 'bridgeDisconnected'), status: 'error' };
  }
  if (currentProvider?.status === 'unavailable' || currentProvider?.status === 'error') {
    return {
      label: formatForState(state, 'providerUnavailable', { agent: currentProvider.name }),
      status: 'error',
    };
  }
  if (currentProvider?.status === 'ready') {
    if (preparation?.status === 'error') {
      return {
        label: formatForState(state, 'providerPreparationFailed', {
          agent: currentProvider.name,
        }),
        status: 'error',
      };
    }
    if (preparation?.status === 'preparing') {
      return { label: translate(state.locale, 'connecting'), status: 'idle' };
    }
    return { label: translate(state.locale, 'connected'), status: 'ready' };
  }
  return { label: translate(state.locale, 'connecting'), status: 'idle' };
}

interface HeaderProps {
  controller: SidepanelController;
}

function HistoryPopover({ controller }: HeaderProps) {
  const { state } = controller;
  const { t } = useCopy(state);
  const query = state.historyQuery.trim().toLocaleLowerCase(state.locale);
  const conversations = state.conversations.filter(conversation => {
    if (!query) return true;
    return [conversation.title, conversation.preview, conversation.id]
      .join('\n')
      .toLocaleLowerCase(state.locale)
      .includes(query);
  });

  return (
    <aside
      aria-label={t('conversationHistory')}
      className="history-popover"
      id="conversation-history-popover"
    >
      <div className="history-heading">
        <strong>{t('recentConversations')}</strong>
        <button
          aria-label={t('close')}
          className="icon-button small"
          onClick={() => void controller.setHistoryOpen(false)}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <label className="history-search">
        <Search aria-hidden="true" />
        <input
          aria-label={t('searchConversations')}
          onChange={event => controller.setHistoryQuery(event.target.value)}
          placeholder={t('searchConversations')}
          type="search"
          value={state.historyQuery}
        />
      </label>
      {state.historyLoading ? (
        <div className="history-state" role="status">
          <LoaderCircle aria-hidden="true" className="loading-mark" />
          <span>{t('connecting')}</span>
        </div>
      ) : state.historyError ? (
        <div className="history-state history-error" role="status">
          <span>{state.historyError}</span>
          <button onClick={() => void controller.refreshHistory()} type="button">
            {t('retry')}
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="history-state">
          {t(state.conversations.length === 0 ? 'noConversations' : 'noConversationMatches')}
        </div>
      ) : (
        <div className="history-list">
          {conversations.map(conversation => (
            <button
              aria-current={conversation.id === state.currentConversation?.id ? 'true' : undefined}
              className="history-item"
              key={`${conversation.providerId}:${conversation.id}`}
              onClick={() => void controller.selectConversation(conversation.id)}
              type="button"
            >
              <span>
                <strong>{conversation.title}</strong>
                <small>{conversation.preview || conversation.id}</small>
              </span>
              <time dateTime={conversation.updatedAt}>
                {new Intl.DateTimeFormat(state.locale, {
                  month: 'numeric',
                  day: 'numeric',
                }).format(new Date(conversation.updatedAt))}
              </time>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

export function AppHeader({ controller }: HeaderProps) {
  const { state } = controller;
  const { t } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const connection = connectionDetails(state);
  const model =
    provider?.status === 'ready'
      ? state.currentConversation?.model || provider.model || undefined
      : undefined;
  const modelTitle = model ? `${t('currentModel')}: ${model}` : undefined;
  const authorization = authorizationDetails(state);
  const providerOptions: SelectMenuOption[] = state.providers.map(item => ({
    value: item.id,
    label: `${item.name} · ${t(
      item.status === 'ready' ? 'providerReady' : 'providerNotInstalled',
    )}`,
    title: item.setupHint || item.setup?.installCommand || item.description,
  }));
  const historyRef = useRef<HTMLDivElement>(null);
  const providerDisabled = state.initializing;
  const conversationDisabled =
    state.initializing || state.loadingConversation || provider?.status !== 'ready';

  useEffect(() => {
    if (!state.historyOpen) return;
    const pointerListener = (event: PointerEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        void controller.setHistoryOpen(false);
      }
    };
    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void controller.setHistoryOpen(false);
    };
    document.addEventListener('pointerdown', pointerListener);
    document.addEventListener('keydown', keyListener);
    return () => {
      document.removeEventListener('pointerdown', pointerListener);
      document.removeEventListener('keydown', keyListener);
    };
  }, [controller, state.historyOpen]);

  return (
    <header className="app-header flex min-h-[54px] items-center justify-between gap-2 border-b border-panel-border bg-panel-surface py-[7px] pr-[9px] pl-[10px]">
      <div className="provider-control">
        <SelectMenu
          disabled={providerDisabled}
          minWidth={176}
          onChange={value => void controller.setProvider(value)}
          options={providerOptions}
          renderTrigger={props => (
            <button
              {...props}
              aria-label={[
                `${t('agentProvider')}: ${provider?.name || t('assistant')}`,
                connection.label,
                modelTitle,
              ]
                .filter(Boolean)
                .join(', ')}
              className="provider-trigger"
              type="button"
            >
              <span className="provider-icon">
                <Bot aria-hidden="true" className="provider-glyph" />
              </span>
              <span className="provider-copy">
                <span className="provider-row">
                  <span className="provider-name">{provider?.name || t('assistant')}</span>
                  <ChevronDown aria-hidden="true" className="provider-chevron" />
                </span>
                <span className="connection-status" title={modelTitle}>
                  <span className="status-dot" data-state={connection.status} />
                  <span>{model ? `${model} · ${connection.label}` : connection.label}</span>
                </span>
              </span>
            </button>
          )}
          value={state.currentProviderId}
        />
      </div>

      <div className="header-actions flex min-w-0 flex-none items-center gap-[3px]">
        <button
          aria-label={t('newConversation')}
          className="icon-button"
          disabled={
            state.initializing ||
            !state.extensionStatus?.bridgeConnected ||
            provider?.status !== 'ready'
          }
          onClick={() => void controller.newConversation()}
          title={t('newConversation')}
          type="button"
        >
          <SquarePen aria-hidden="true" />
        </button>
        <div className="conversation-control" ref={historyRef}>
          <button
            aria-controls="conversation-history-popover"
            aria-expanded={state.historyOpen}
            aria-label={t('conversationHistory')}
            className="conversation-trigger"
            disabled={conversationDisabled}
            onClick={() => void controller.setHistoryOpen(!state.historyOpen)}
            title={t('conversationHistory')}
            type="button"
          >
            <MessagesSquare aria-hidden="true" />
          </button>
          {state.historyOpen && <HistoryPopover controller={controller} />}
        </div>
        <button
          aria-controls="settings-popover"
          aria-expanded={state.settingsOpen}
          aria-label={`${t('browserAccess')}: ${authorization.target}`}
          className="icon-button access-button"
          data-authorized={authorization.mode !== 'none'}
          data-controlled={Boolean(state.extensionStatus?.controlledTab)}
          onClick={() => controller.setSettingsOpen(!state.settingsOpen)}
          title={`${t('browserAccess')}: ${authorization.target}`}
          type="button"
        >
          <PanelTop aria-hidden="true" />
          <span aria-hidden="true" className="access-indicator" />
        </button>
      </div>
    </header>
  );
}
