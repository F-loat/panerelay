import type {
  AutomationActivityCategory,
  AutomationActivityLabel,
  AutomationActivityStatus,
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
  ControlSessionState,
} from '@panerelay/protocol';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  FilePenLine,
  FolderOpen,
  ListCollapse,
  LoaderCircle,
  MessageSquareText,
  MessageSquarePlus,
  MessagesSquare,
  PanelTop,
  ScanSearch,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  SquarePen,
  Terminal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthorizationMode } from '../../shared/messages.js';
import {
  formatForState,
  selectedAgentName,
  type SidepanelController,
  type SidepanelState,
  useSidepanelController,
} from './sidepanel-controller.js';
import { formatCopy, translate, type CopyKey, type Locale, type ThemeSetting } from './i18n.js';
import { SelectMenu, type SelectMenuOption } from './dropdown.js';
import { browserSidepanelClient, type SidepanelClient } from './sidepanel-client.js';
import { isPanerelaySetupFailure } from './setup-guidance.js';

const PANERELAY_SETUP_COMMAND = 'npx --yes @panerelay/setup';
type SetupIntegration = 'agent-browser' | 'browser-use';
type SetupIntegrationSelection = Record<SetupIntegration, boolean>;

const SETUP_INTEGRATIONS: readonly SetupIntegration[] = ['agent-browser', 'browser-use'];
const EMPTY_SETUP_INTEGRATION_SELECTION: Readonly<SetupIntegrationSelection> = {
  'agent-browser': false,
  'browser-use': false,
};

async function writeClipboardText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue with the user-gesture fallback for extension contexts without Clipboard API access.
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  return copied;
}

interface AppProps {
  client?: SidepanelClient;
}

function useCopy(state: SidepanelState) {
  return useMemo(
    () => ({
      t: (key: CopyKey) => translate(state.locale, key),
      tf: (key: CopyKey, values: Record<string, string | number>) =>
        formatCopy(state.locale, key, values),
    }),
    [state.locale],
  );
}

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

function authorizationDetails(state: SidepanelState) {
  const status = state.extensionStatus;
  const mode = status?.authorizationMode ?? 'none';
  let target: string;
  if ((status?.controlledTabs.length ?? 0) > 1) {
    target = formatForState(state, 'controllingTabs', {
      count: status?.controlledTabs.length ?? 0,
    });
  } else if (status?.controlledTab) {
    target = `${translate(state.locale, 'controlling')}: ${status.controlledTab.title}`;
  } else if (mode === 'single-tab' && status?.authorizedTab) {
    target = `${translate(state.locale, 'authorized')}: ${status.authorizedTab.title}`;
  } else if (mode === 'all-tabs') {
    target = translate(state.locale, 'allTabsEligible');
  } else {
    target = translate(state.locale, 'noTabAuthorized');
  }
  const help =
    mode === 'single-tab'
      ? translate(state.locale, 'scopeHelpSingle')
      : mode === 'all-tabs'
        ? translate(state.locale, 'scopeHelpAll')
        : translate(state.locale, 'scopeHelpNone');
  return { help, mode, target };
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

function AppHeader({ controller }: HeaderProps) {
  const { state } = controller;
  const { t } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const connection = connectionDetails(state);
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
              aria-label={`${t('agentProvider')}: ${provider?.name || t('assistant')}, ${
                connection.label
              }`}
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
                <span className="connection-status">
                  <span className="status-dot" data-state={connection.status} />
                  <span>{connection.label}</span>
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

function controlStateText(locale: Locale, state: ControlSessionState): string {
  const keys: Record<ControlSessionState, CopyKey> = {
    allocated: 'controlAllocated',
    connected: 'controlConnected',
    active: 'controlActive',
    released: 'controlReleased',
    expired: 'controlExpired',
    failed: 'controlFailed',
  };
  return translate(locale, keys[state]);
}

function automationCategoryText(locale: Locale, category: AutomationActivityCategory): string {
  const keys: Record<AutomationActivityCategory, CopyKey> = {
    target: 'categoryTarget',
    navigation: 'categoryNavigation',
    interaction: 'categoryInteraction',
    'page-content': 'categoryPageContent',
    'browser-state': 'categoryBrowserState',
    network: 'categoryNetwork',
    emulation: 'categoryEmulation',
    artifact: 'categoryArtifact',
    other: 'categoryOther',
  };
  return translate(locale, keys[category]);
}

function automationLabelText(locale: Locale, label: AutomationActivityLabel): string {
  const keys: Record<AutomationActivityLabel, CopyKey> = {
    'manage-target': 'labelManageTarget',
    'navigate-page': 'labelNavigatePage',
    'interact-with-page': 'labelInteractWithPage',
    'read-page': 'labelReadPage',
    'manage-browser-state': 'labelManageBrowserState',
    'inspect-network': 'labelInspectNetwork',
    'emulate-page': 'labelEmulatePage',
    'create-artifact': 'labelCreateArtifact',
    'run-browser-operation': 'labelRunBrowserOperation',
  };
  return translate(locale, keys[label]);
}

function automationStatusText(locale: Locale, status: AutomationActivityStatus): string {
  const keys: Record<AutomationActivityStatus, CopyKey> = {
    started: 'automationStarted',
    completed: 'automationCompleted',
    failed: 'automationFailed',
    denied: 'automationDenied',
  };
  return translate(locale, keys[status]);
}

function PanerelaySetupGuide({
  controller,
  nativeHost = false,
  onToggleIntegration,
  selectedIntegrations = EMPTY_SETUP_INTEGRATION_SELECTION,
}: {
  controller: SidepanelController;
  nativeHost?: boolean;
  onToggleIntegration?: (integration: SetupIntegration) => void;
  selectedIntegrations?: Readonly<SetupIntegrationSelection>;
}) {
  const { state } = controller;
  const { t } = useCopy(state);
  const [commandCopied, setCommandCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setupCommand = useMemo(
    () =>
      [
        PANERELAY_SETUP_COMMAND,
        ...SETUP_INTEGRATIONS.filter(integration => selectedIntegrations[integration]).map(
          integration => `--${integration}`,
        ),
      ].join(' '),
    [selectedIntegrations],
  );

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const toggleIntegration = (integration: SetupIntegration) => {
    onToggleIntegration?.(integration);
    setCommandCopied(false);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  };

  const copySetupCommand = async () => {
    if (!(await writeClipboardText(setupCommand))) return;
    setCommandCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCommandCopied(false), 1_600);
  };

  if (nativeHost) {
    return (
      <section
        aria-label={t('nativeHostMissingTitle')}
        className="setup-guidance"
        data-native-host="true"
      >
        <article className="setup-guide-card" data-setup-card="benefits">
          <div className="setup-guidance-features">
            <span>
              <PanelTop aria-hidden="true" />
              {t('nativeHostFeatureSession')}
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              {t('nativeHostFeatureAuthorization')}
            </span>
          </div>
        </article>
        <article className="setup-guide-card setup-action-card" data-setup-card="action">
          <strong className="setup-guidance-status">{t('nativeHostInstallTitle')}</strong>
          <div className="setup-command-row">
            <code>{setupCommand}</code>
            <button
              aria-label={t(commandCopied ? 'setupCommandCopied' : 'copySetupCommand')}
              className="setup-command-copy"
              onClick={() => void copySetupCommand()}
              title={t(commandCopied ? 'setupCommandCopied' : 'copySetupCommand')}
              type="button"
            >
              {commandCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
            <span aria-live="polite" className="sr-only" role="status">
              {commandCopied ? t('setupCommandCopied') : ''}
            </span>
          </div>
          <button
            disabled={state.nativeRetryPending}
            onClick={() => void controller.retryNativeHost()}
            type="button"
          >
            {state.nativeRetryPending ? t('connecting') : t('retryNativeHost')}
          </button>
        </article>
        <article className="setup-guide-card" data-setup-card="integrations">
          <div className="setup-integration-picker">
            <div>
              <strong>{t('setupIntegrationsTitle')}</strong>
              <span>{t('setupIntegrationsBody')}</span>
            </div>
            <div
              aria-label={t('setupIntegrationChoices')}
              className="setup-integration-options"
              role="group"
            >
              {SETUP_INTEGRATIONS.map(integration => {
                const selected = selectedIntegrations[integration];
                return (
                  <button
                    aria-pressed={selected}
                    className="settings-provider-toggle settings-default-toggle setup-integration-toggle"
                    key={integration}
                    onClick={() => toggleIntegration(integration)}
                    type="button"
                  >
                    {integration}
                  </button>
                );
              })}
            </div>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section
      aria-label={t('panerelaySetupNeededTitle')}
      className="setup-guidance"
      data-native-host="false"
    >
      <div className="setup-guidance-copy">
        <strong>{t('panerelaySetupNeededTitle')}</strong>
        <span>{t('panerelaySetupNeededBody')}</span>
      </div>
      <code>{PANERELAY_SETUP_COMMAND}</code>
    </section>
  );
}

function AuthorizationRequestNotice({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t } = useCopy(state);
  if (
    state.extensionStatus?.authorizationRequest !== 'all-tabs' ||
    state.extensionStatus.authorizationMode === 'all-tabs'
  ) {
    return null;
  }
  return (
    <section className="authorization-request" role="status">
      <PanelTop aria-hidden="true" />
      <span>
        <strong>{t('authorizationNeededTitle')}</strong>
        <small>{t('authorizationNeededBody')}</small>
      </span>
      <button
        disabled={state.authorizationPending}
        onClick={() => void controller.setAuthorization('all-tabs')}
        type="button"
      >
        {t('authorizeAllTabs')}
      </button>
    </section>
  );
}

interface AuthorizationPanelProps {
  compact?: boolean;
  controller: SidepanelController;
}

function AuthorizationPanel({ compact = false, controller }: AuthorizationPanelProps) {
  const { state } = controller;
  const { t } = useCopy(state);
  const { help, mode, target } = authorizationDetails(state);
  const disabled = !state.extensionStatus || state.authorizationPending;

  if (compact) {
    const options: SelectMenuOption[] = [
      { value: 'single-tab', label: t('thisTab') },
      { value: 'all-tabs', label: t('allTabs') },
      ...(mode === 'none' ? [] : [{ value: 'none', label: t('release') }]),
    ];
    return (
      <section
        aria-labelledby="welcome-browser-access-title"
        className="welcome-authorization"
        data-welcome-authorization
      >
        <span aria-hidden="true" className="welcome-authorization-icon">
          <PanelTop />
        </span>
        <span className="welcome-authorization-copy">
          <strong id="welcome-browser-access-title">{t('browserAccess')}</strong>
          <small className="scope-target">{target}</small>
        </span>
        <span className="welcome-authorization-select">
          <SelectMenu
            alignment="end"
            disabled={disabled}
            minWidth={132}
            onChange={value =>
              void (value === 'none'
                ? controller.releaseControl()
                : controller.setAuthorization(value as AuthorizationMode))
            }
            options={options}
            renderTrigger={props => (
              <button
                {...props}
                aria-label={t('browserAuthorization')}
                className="authorization-trigger"
                data-authorized={mode !== 'none'}
                type="button"
              >
                <span>
                  {mode === 'single-tab'
                    ? t('thisTab')
                    : mode === 'all-tabs'
                      ? t('allTabs')
                      : t('chooseScope')}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
            )}
            value={mode}
          />
        </span>
      </section>
    );
  }

  return (
    <section className="browser-scope" id="browser-access-settings">
      <div className="scope-summary">
        <span aria-hidden="true" className="scope-icon">
          <PanelTop />
        </span>
        <div className="scope-copy">
          <span className="scope-label">{t('browserAccess')}</span>
          <span className="scope-target">{target}</span>
        </div>
        {(mode !== 'none' || state.extensionStatus?.controlledTab) && (
          <button
            className="text-button danger"
            disabled={disabled}
            onClick={() => void controller.releaseControl()}
            type="button"
          >
            {t('release')}
          </button>
        )}
      </div>
      <div className="scope-controls">
        <div aria-label={t('browserAuthorization')} className="scope-switch" role="group">
          {(['single-tab', 'all-tabs'] as const).map(scope => (
            <button
              data-active={scope === mode}
              disabled={disabled}
              key={scope}
              onClick={() => void controller.setAuthorization(scope === mode ? 'none' : scope)}
              type="button"
            >
              {t(scope === 'single-tab' ? 'thisTab' : 'allTabs')}
            </button>
          ))}
        </div>
        <p className="scope-help">{help}</p>
      </div>
    </section>
  );
}

function ExternalControl({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const [expanded, setExpanded] = useState(false);
  const status = state.extensionStatus;
  const session = status?.controlSession ?? null;
  const activities = status?.automationActivities ?? [];
  if (!session && activities.length === 0) return null;
  const actor = session
    ? [session.actor.name, session.actor.sessionLabel].filter(Boolean).join(' · ')
    : t('externalControl');
  const metadata = session
    ? [
        controlStateText(state.locale, session.state),
        ...(session.participantCount > 1
          ? [tf('controlParticipants', { count: session.participantCount })]
          : []),
        ...(session.observedTargetCount > 0
          ? [tf('controlObservedTargets', { count: session.observedTargetCount })]
          : []),
        tf('controlTargets', { count: session.controlledTargetCount }),
        ...(session.heartbeatFreshness === 'fresh' ? [t('heartbeatLive')] : []),
      ]
    : [];
  return (
    <section aria-live="polite" className="external-control">
      <div className="external-control-heading">
        <button
          aria-controls="external-control-details"
          aria-expanded={expanded}
          aria-label={t(expanded ? 'collapseExternalControl' : 'expandExternalControl')}
          className="external-control-toggle"
          onClick={() => setExpanded(value => !value)}
          type="button"
        >
          <span aria-hidden="true" className="external-control-icon">
            <Bot />
          </span>
          <span className="external-control-copy">
            <span className="external-control-eyebrow">{t('externalControl')}</span>
            <strong>{actor}</strong>
            <span>{metadata.join(' · ')}</span>
          </span>
          <ChevronDown aria-hidden="true" className="external-control-chevron" />
        </button>
      </div>
      <div hidden={!expanded} id="external-control-details">
        {(status?.controlledTabs.length ?? 0) > 0 && (
          <div className="controlled-tab-section">
            <strong>{t('controlledTabsTitle')}</strong>
            <ul className="controlled-tab-list">
              {status?.controlledTabs.map(tab => (
                <li key={tab.id}>
                  <button
                    aria-label={tf('activateControlledTab', { title: tab.title })}
                    className="controlled-tab-main"
                    onClick={() => void controller.activateControlledTab(tab.id)}
                    type="button"
                  >
                    <PanelTop aria-hidden="true" />
                    <span>
                      <strong>{tab.title}</strong>
                      <small>{tab.url}</small>
                    </span>
                  </button>
                  <button
                    aria-label={tf('closeControlledTab', { title: tab.title })}
                    className="controlled-tab-close"
                    disabled={state.controlledTabPendingId === tab.id}
                    onClick={() => void controller.closeControlledTab(tab.id)}
                    type="button"
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status?.automationHistoryGap && (
          <p className="external-control-gap">
            <CircleAlert aria-hidden="true" />
            <span>{t('activityHistoryGap')}</span>
          </p>
        )}
        {activities.length > 0 && (
          <ol className="external-activity-list">
            {activities
              .slice(-5)
              .reverse()
              .map(activity => (
                <li data-status={activity.status} key={activity.id}>
                  <span aria-hidden="true" className="external-activity-mark" />
                  <span className="external-activity-copy">
                    <strong>{automationLabelText(state.locale, activity.label)}</strong>
                    <small>
                      {automationCategoryText(state.locale, activity.category)} ·{' '}
                      {automationStatusText(state.locale, activity.status)}
                      {' · '}
                      {[activity.actor.name, activity.actor.sessionLabel]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <time dateTime={activity.updatedAt}>
                    {new Intl.DateTimeFormat(state.locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(activity.updatedAt))}
                  </time>
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function AutomationDefaultsSetting({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t } = useCopy(state);
  const agentBrowser = state.extensionStatus?.defaultProvider ?? null;
  const browserUse = state.extensionStatus?.browserUseDefault ?? null;
  const connected = state.extensionStatus?.bridgeConnected ?? false;
  const agentBrowserEnabled = agentBrowser?.isPanerelay ?? false;
  const browserUseEnabled = browserUse?.isPanerelay ?? false;
  const agentBrowserAvailable = agentBrowser?.available ?? false;
  const browserUseAvailable = browserUse?.available ?? false;
  const agentBrowserInstallable = connected && agentBrowser?.available === false;
  const browserUseInstallable = connected && browserUse?.available === false;
  const agentBrowserInstalling = agentBrowserInstallable && state.defaultProviderPending;
  const browserUseInstalling = browserUseInstallable && state.browserUseDefaultPending;

  return (
    <div className="settings-field settings-default-field">
      <span>{t('setAsDefault')}</span>
      <div className="settings-default-actions">
        <button
          aria-busy={agentBrowserInstalling || undefined}
          aria-label={t(
            agentBrowserInstalling
              ? 'installingIntegration'
              : agentBrowserInstallable
                ? 'installAgentBrowser'
                : agentBrowserEnabled
                  ? 'clearProviderDefault'
                  : 'setProviderDefault',
          )}
          aria-pressed={agentBrowserEnabled}
          className="settings-provider-toggle settings-default-toggle"
          data-install-label={agentBrowserInstallable ? t('clickToInstall') : undefined}
          data-installable={agentBrowserInstallable && !state.defaultProviderPending}
          disabled={!connected || agentBrowser === null || state.defaultProviderPending}
          onClick={() =>
            void (agentBrowserAvailable
              ? controller.setDefaultProvider(!agentBrowserEnabled)
              : controller.installIntegration('agent-browser'))
          }
          type="button"
        >
          <span className="settings-default-label">
            {agentBrowserInstalling ? t('installingIntegration') : 'agent-browser'}
          </span>
        </button>
        <button
          aria-busy={browserUseInstalling || undefined}
          aria-label={t(
            browserUseInstalling
              ? 'installingIntegration'
              : browserUseInstallable
                ? 'installBrowserUse'
                : browserUseEnabled
                  ? 'clearBrowserUseDefault'
                  : 'setBrowserUseDefault',
          )}
          aria-pressed={browserUseEnabled}
          className="settings-provider-toggle settings-default-toggle"
          data-install-label={browserUseInstallable ? t('clickToInstall') : undefined}
          data-installable={browserUseInstallable && !state.browserUseDefaultPending}
          disabled={!connected || browserUse === null || state.browserUseDefaultPending}
          onClick={() =>
            void (browserUseAvailable
              ? controller.setBrowserUseDefault(!browserUseEnabled)
              : controller.installIntegration('browser-use'))
          }
          type="button"
        >
          <span className="settings-default-label">
            {browserUseInstalling ? t('installingIntegration') : 'browser-use'}
          </span>
        </button>
      </div>
    </div>
  );
}

function BrowserDefaultSetting({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t } = useCopy(state);
  const current = state.extensionStatus?.browserDefault ?? null;
  const connected = state.extensionStatus?.bridgeConnected ?? false;
  const enabled = current?.isCurrentBrowser ?? false;
  const browser = current?.currentBrowser;

  if (!connected || !browser || !current.hasMultipleBrowsers) return null;

  return (
    <div className="settings-field">
      <span>{t('controlByDefault')}</span>
      <button
        aria-checked={enabled}
        aria-label={t(enabled ? 'clearBrowserDefault' : 'setBrowserDefault')}
        className="settings-switch"
        disabled={state.browserDefaultPending}
        onClick={() => void controller.setBrowserDefault(!enabled)}
        role="switch"
        type="button"
      >
        <span aria-hidden="true" className="settings-switch-thumb" />
      </button>
    </div>
  );
}

function SettingsPopover({
  controller,
  popoverRef,
}: {
  controller: SidepanelController;
  popoverRef: React.RefObject<HTMLElement | null>;
}) {
  const { state } = controller;
  const { t } = useCopy(state);
  const themeOptions: SelectMenuOption[] = [
    { value: 'system', label: t('themeSystem') },
    { value: 'dark', label: t('themeDark') },
    { value: 'light', label: t('themeLight') },
  ];
  const languageOptions: SelectMenuOption[] = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en', label: 'English' },
  ];
  const themeLabel = themeOptions.find(item => item.value === state.themeSetting)?.label ?? '';
  const languageLabel = languageOptions.find(item => item.value === state.locale)?.label ?? '';

  return (
    <aside className="settings-popover" id="settings-popover" ref={popoverRef}>
      <div className="settings-heading">
        <strong>{t('settings')}</strong>
        <button
          aria-label={t('close')}
          className="icon-button small"
          onClick={() => controller.setSettingsOpen(false)}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="settings-field">
        <span>{t('theme')}</span>
        <span className="settings-select">
          <SelectMenu
            alignment="end"
            minWidth={148}
            onChange={value => void controller.setTheme(value as ThemeSetting)}
            options={themeOptions}
            renderTrigger={props => (
              <button
                {...props}
                aria-label={t('theme')}
                className="settings-select-trigger"
                type="button"
              >
                <span>{themeLabel}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            )}
            value={state.themeSetting}
          />
        </span>
      </div>
      <div className="settings-field">
        <span>{t('language')}</span>
        <span className="settings-select">
          <SelectMenu
            alignment="end"
            minWidth={148}
            onChange={value => void controller.setLocale(value as Locale)}
            options={languageOptions}
            renderTrigger={props => (
              <button
                {...props}
                aria-label={t('language')}
                className="settings-select-trigger"
                type="button"
              >
                <span>{languageLabel}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            )}
            value={state.locale}
          />
        </span>
      </div>
      <AutomationDefaultsSetting controller={controller} />
      <BrowserDefaultSetting controller={controller} />
      <AuthorizationPanel controller={controller} />
      <ExternalControl controller={controller} />
    </aside>
  );
}

const INLINE_MARKDOWN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function inlineText(value: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let offset = 0;
  let sequence = 0;
  for (const match of value.matchAll(INLINE_MARKDOWN)) {
    const index = match.index ?? 0;
    if (index > offset) nodes.push(value.slice(offset, index));
    const token = match[0];
    const key = `${keyPrefix}-${sequence++}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      nodes.push(
        link ? (
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    }
    offset = index + token.length;
  }
  if (offset < value.length) nodes.push(value.slice(offset));
  return nodes;
}

function RichText({ value }: { value: string }) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;
  const blockStart = (line: string) =>
    /^ {0,3}```|^#{1,3}\s+|^>\s?|^[-*+]\s+|^\d+[.)]\s+|^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(
      line,
    );

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const key = `block-${index}`;
    const compactFence = line.match(/^ {0,3}```([\w+-]*)[ \t]+(.+?)[ \t]+```\s*(.*)$/);
    if (compactFence) {
      nodes.push(
        <pre key={key}>
          <code data-language={compactFence[1] || undefined}>{compactFence[2]}</code>
        </pre>,
      );
      if (compactFence[3]) {
        nodes.push(<p key={`${key}-trailing`}>{inlineText(compactFence[3], `${key}-trailing`)}</p>);
      }
      index += 1;
      continue;
    }
    const fence = line.match(/^ {0,3}```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^ {0,3}```\s*$/.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(
        <pre key={key}>
          <code data-language={fence[1] || undefined}>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = inlineText(heading[2] ?? '', key);
      nodes.push(
        heading[1]?.length === 1 ? (
          <h1 key={key}>{content}</h1>
        ) : heading[1]?.length === 2 ? (
          <h2 key={key}>{content}</h2>
        ) : (
          <h3 key={key}>{content}</h3>
        ),
      );
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      nodes.push(<blockquote key={key}>{inlineText(quote.join('\n'), key)}</blockquote>);
      continue;
    }
    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1] ?? '');
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(<li key={`${key}-${index}`}>{inlineText(item[1] ?? '', `${key}-${index}`)}</li>);
        index += 1;
      }
      nodes.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      continue;
    }
    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push(<hr key={key} />);
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index]?.trim() && !blockStart(lines[index] ?? '')) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    nodes.push(<p key={key}>{inlineText(paragraph.join('\n'), key)}</p>);
  }
  return <div className="rich-text">{nodes}</div>;
}

function MessageTime({ locale, value }: { locale: Locale; value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <time className="message-time" />;
  return (
    <time
      className="message-time"
      dateTime={date.toISOString()}
      title={date.toLocaleString(locale)}
    >
      {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

function activityStatus(locale: Locale, activity: ConversationActivity): string {
  const keys: Record<ConversationActivity['status'], CopyKey> = {
    running: 'activityRunning',
    completed: 'activityCompleted',
    failed: 'activityFailed',
    declined: 'activityDeclined',
  };
  return translate(locale, keys[activity.status]);
}

function activityTitle(title: string): string {
  return title.replace(/^panerelay_browser(?=\s*(?:·|$))/, 'panerelay');
}

function activityIcon(activity: ConversationActivity): LucideIcon {
  switch (activity.kind) {
    case 'browser':
      return PanelTop;
    case 'command':
      return Terminal;
    case 'file-change':
      return FilePenLine;
    case 'web-search':
      return Search;
    default:
      return Sparkles;
  }
}

function reasoningStatusText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const maximum = 240;
  return normalized.length > maximum ? `…${normalized.slice(-maximum)}` : normalized;
}

function TurnFeedback({ state }: { state: SidepanelState }) {
  const { t, tf } = useCopy(state);
  const providerName = selectedAgentName(state);
  const starting = state.turnFeedback === 'starting';
  const reasoning = starting ? '' : reasoningStatusText(state.activeReasoning?.text ?? '');

  if (!state.turnFeedback) return null;

  return (
    <article aria-live="polite" className="turn-feedback" role="status">
      <Bot aria-hidden="true" className="message-avatar" />
      <div className="turn-feedback-shell">
        <div className="message-heading">{providerName}</div>
        <div className="turn-feedback-bubble">
          <span className="turn-feedback-copy">
            <strong>
              {tf(starting ? 'startingConversation' : 'agentWorking', {
                agent: providerName,
              })}
            </strong>
            <small data-reasoning={reasoning ? 'true' : 'false'}>
              {reasoning || t(starting ? 'startingConversationDetail' : 'agentWorkingDetail')}
            </small>
          </span>
          <span aria-hidden="true" className="turn-feedback-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </article>
  );
}

function Timeline({
  controller,
  scrollRef,
}: {
  controller: SidepanelController;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const { state } = controller;
  const { t } = useCopy(state);
  const providerName = selectedAgentName(state);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const distance = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
    if (distance < 120) scroll.scrollTop = scroll.scrollHeight;
  }, [scrollRef, state.timeline, state.turnFeedback]);

  return (
    <div className="timeline flex flex-col gap-3 px-3 pt-[15px] pb-5">
      {state.timeline.map(item => {
        if (item.type === 'message') {
          return (
            <article
              className={`message ${item.message.role}`}
              data-streaming={Boolean(item.streaming)}
              key={`message-${item.message.id}`}
            >
              {item.message.role === 'assistant' ? (
                <>
                  <Bot aria-hidden="true" className="message-avatar" />
                  <div className="message-shell">
                    <div className="message-heading">
                      <span>{providerName}</span>
                      <MessageTime locale={state.locale} value={item.message.createdAt} />
                    </div>
                    <div className="message-bubble">
                      <RichText value={item.message.text} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <MessageTime locale={state.locale} value={item.message.createdAt} />
                  <div className="message-shell">
                    <div className="message-bubble">
                      <RichText value={item.message.text} />
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        }
        if (item.type === 'reasoning') {
          if (state.turnFeedback === 'working' && state.activeReasoning?.id === item.id) {
            return null;
          }
          return (
            <details className="reasoning-card" key={`reasoning-${item.id}`}>
              <summary>
                <ChevronRight aria-hidden="true" className="reasoning-chevron" />
                <span className="reasoning-title">{t('thinking')}</span>
                <span className="reasoning-preview">{item.text.replace(/\s+/g, ' ').trim()}</span>
              </summary>
              <p className="reasoning-content">{item.text}</p>
            </details>
          );
        }
        if (item.type === 'activity') {
          const Icon = activityIcon(item.activity);
          const expandable =
            (item.activity.status === 'failed' || item.activity.status === 'declined') &&
            Boolean(item.activity.detail);
          const setupFailure =
            item.activity.status === 'failed' &&
            isPanerelaySetupFailure(
              [item.activity.title, item.activity.detail].filter(Boolean).join('\n'),
            );
          return (
            <div className="activity-stack" key={`activity-${item.activity.id}`}>
              {expandable ? (
                <details
                  className="activity-card activity-card-expandable"
                  data-status={item.activity.status}
                >
                  <summary aria-label={t('errorDetails')} className="activity-card-summary">
                    <ChevronRight aria-hidden="true" className="activity-chevron" />
                    <Icon aria-hidden="true" className="activity-icon" />
                    <div className="activity-copy">
                      <div className="activity-title">{activityTitle(item.activity.title)}</div>
                      <div className="activity-detail">{item.activity.detail}</div>
                    </div>
                    <span className="activity-status">
                      {activityStatus(state.locale, item.activity)}
                    </span>
                  </summary>
                  <div className="activity-detail-expanded">{item.activity.detail}</div>
                </details>
              ) : (
                <article className="activity-card" data-status={item.activity.status}>
                  <Icon aria-hidden="true" className="activity-icon" />
                  <div className="activity-copy">
                    <div className="activity-title">{activityTitle(item.activity.title)}</div>
                    {item.activity.detail && (
                      <div className="activity-detail">{item.activity.detail}</div>
                    )}
                  </div>
                  <span className="activity-status">
                    {activityStatus(state.locale, item.activity)}
                  </span>
                </article>
              )}
              {setupFailure && <PanerelaySetupGuide controller={controller} />}
            </div>
          );
        }
        if (item.type === 'approval') {
          return (
            <ApprovalCard
              approval={item.approval}
              controller={controller}
              key={`approval-${item.approval.id}`}
            />
          );
        }
        return (
          <div className="timeline-error-stack" key={`error-${item.id}`}>
            <details className="timeline-error mx-2">
              <summary aria-label={t('errorDetails')}>
                <ChevronRight aria-hidden="true" className="timeline-error-chevron" />
                <CircleAlert aria-hidden="true" className="timeline-error-icon" />
                <div className="timeline-error-copy">
                  <strong>{t('errorTitle')}</strong>
                  <span>{item.message}</span>
                </div>
              </summary>
              <div className="timeline-error-detail">{item.message}</div>
            </details>
            {isPanerelaySetupFailure(item.message) && (
              <PanerelaySetupGuide controller={controller} />
            )}
          </div>
        );
      })}
      <TurnFeedback state={state} />
    </div>
  );
}

function ApprovalCard({
  approval,
  controller,
}: {
  approval: ConversationApproval;
  controller: SidepanelController;
}) {
  const { t } = useCopy(controller.state);
  const labels: Record<ConversationApprovalDecision, CopyKey> = {
    accept: 'allowOnce',
    acceptForSession: 'allowSession',
    decline: 'deny',
    declineForSession: 'denySession',
    cancel: 'cancelApproval',
  };
  return (
    <article className="approval-card">
      <div className="approval-body">
        <div className="approval-heading">
          <ShieldQuestion aria-hidden="true" className="approval-icon" />
          <div>
            <p className="approval-kicker">{t('approval')}</p>
            <h3>{approval.title}</h3>
            {approval.description && <p>{approval.description}</p>}
          </div>
        </div>
        {approval.command && <pre className="approval-code">{approval.command}</pre>}
        {approval.cwd && (
          <div className="approval-context">
            <span>{t('workingDirectory')}</span>
            <code>{approval.cwd}</code>
          </div>
        )}
      </div>
      <div className="approval-actions">
        {approval.decisions.map(decision => (
          <button
            className={decision === 'accept' ? 'approve' : undefined}
            key={decision}
            onClick={() => void controller.respondToApproval(approval, decision)}
            type="button"
          >
            {t(labels[decision])}
          </button>
        ))}
      </div>
    </article>
  );
}

function Welcome({
  controller,
  onToggleSetupIntegration,
  selectedSetupIntegrations,
}: {
  controller: SidepanelController;
  onToggleSetupIntegration: (integration: SetupIntegration) => void;
  selectedSetupIntegrations: Readonly<SetupIntegrationSelection>;
}) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const bridgeConnected = state.extensionStatus?.bridgeConnected ?? false;
  const nativeHostMissing = state.extensionStatus?.nativeHostState === 'missing';
  const providerReady = provider?.status === 'ready';
  const setup = provider?.setup;
  const title = !bridgeConnected
    ? t(nativeHostMissing ? 'nativeHostMissingTitle' : 'emptyBridgeTitle')
    : !providerReady
      ? tf('emptyProviderTitle', { agent: selectedAgentName(state) })
      : tf('emptyTitle', { agent: selectedAgentName(state) });
  const body = !bridgeConnected
    ? t(nativeHostMissing ? 'nativeHostMissingBody' : 'emptyBridgeBody')
    : !providerReady
      ? provider
        ? t(
            provider.id === 'qoder'
              ? 'qoderSetupBody'
              : provider.id === 'claude'
                ? 'claudeSetupBody'
                : 'codexSetupBody',
          )
        : t('emptyProviderBody')
      : t('emptyBody');
  const docsUrl = setup?.docsUrl?.startsWith('https://') ? setup.docsUrl : '';
  const suggestions = [
    {
      key: 'summarize' as const,
      icon: ListCollapse,
      title: t('suggestSummarize'),
      body: t('suggestSummarizeBody'),
    },
    {
      key: 'inspect' as const,
      icon: ScanSearch,
      title: t('suggestInspect'),
      body: t('suggestInspectBody'),
    },
    {
      key: 'find' as const,
      icon: Search,
      title: t('suggestFind'),
      body: t('suggestFindBody'),
    },
  ];

  return (
    <div className="empty-state flex min-h-full flex-col items-center justify-center px-[18px] py-7 text-center">
      <Sparkles aria-hidden="true" className="empty-mark" />
      {nativeHostMissing ? (
        <>
          <h2>{title}</h2>
          <p>{body}</p>
          <PanerelaySetupGuide
            controller={controller}
            nativeHost
            onToggleIntegration={onToggleSetupIntegration}
            selectedIntegrations={selectedSetupIntegrations}
          />
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <p>{body}</p>
        </>
      )}
      {bridgeConnected && !providerReady && setup && (
        <div className="provider-setup">
          {setup.installCommand && (
            <div className="provider-setup-step">
              <strong>{t('providerInstallCommand')}</strong>
              <code>{setup.installCommand}</code>
            </div>
          )}
          {setup.loginCommand && (
            <div className="provider-setup-step">
              <strong>{t('providerLoginCommand')}</strong>
              <code>{setup.loginCommand}</code>
            </div>
          )}
          {docsUrl && (
            <a className="provider-setup-docs" href={docsUrl} rel="noreferrer" target="_blank">
              {t('providerSetupDocs')}
            </a>
          )}
        </div>
      )}
      {bridgeConnected && (
        <div className="suggestions">
          {providerReady &&
            suggestions.map(suggestion => {
              const Icon = suggestion.icon;
              return (
                <button
                  aria-label={suggestion.title}
                  key={suggestion.key}
                  onClick={() => controller.useSuggestion(suggestion.key)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="suggestion-icon" />
                  <span>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.body}</small>
                  </span>
                  <ChevronRight aria-hidden="true" className="suggestion-arrow" />
                </button>
              );
            })}
          <AuthorizationPanel compact controller={controller} />
        </div>
      )}
    </div>
  );
}

function Composer({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const ready = state.extensionStatus?.bridgeConnected && provider?.status === 'ready';
  const disabled = state.initializing || !ready || state.submitting;
  const projectName = state.workspace?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) || t('project');
  const projectBound = state.workspace?.kind === 'conversation';

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
  }, [state.composerText]);

  return (
    <footer className="composer-area border-panel-border">
      <form
        className="composer"
        onSubmit={event => {
          event.preventDefault();
          void controller.sendMessage();
        }}
      >
        {state.pastedImages.length > 0 && (
          <div
            aria-label={tf('attachedImages', { count: state.pastedImages.length })}
            className="pasted-image-list"
          >
            {state.pastedImages.map(image => (
              <div className="pasted-image-preview" key={image.id}>
                <img
                  alt={image.name || image.mimeType}
                  src={`data:${image.mimeType};base64,${image.data}`}
                />
                <button
                  aria-label={t('removeImage')}
                  onClick={() => controller.removePastedImage(image.id)}
                  title={t('removeImage')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {state.pageComments.length > 0 && (
          <div aria-label={t('pageComments')} className="pending-page-comments">
            {state.pageComments.map((comment, index) => (
              <div className="pending-page-comment" key={comment.id}>
                <button
                  className="page-comment-pill-main"
                  aria-label={t('editPageComment')}
                  onClick={() => void controller.editPageComment(comment.id)}
                  title={`${comment.element.selector || comment.element.tagName}\n${
                    comment.comment || Object.entries(comment.styleChanges ?? {}).join(', ')
                  }`}
                  type="button"
                >
                  <MessageSquareText aria-hidden="true" />
                  <span>{tf('annotation', { count: index + 1 })}</span>
                </button>
                <button
                  className="page-comment-pill-remove"
                  aria-label={t('removePageComment')}
                  onClick={() => void controller.removePageComment(comment.id)}
                  title={t('removePageComment')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          aria-label={tf('composerPlaceholder', { agent: selectedAgentName(state) })}
          disabled={disabled}
          onChange={event => controller.setComposerText(event.target.value)}
          onPaste={event => {
            const files = Array.from(event.clipboardData.items).flatMap(item => {
              if (item.kind !== 'file' || !item.type.startsWith('image/')) return [];
              const file = item.getAsFile();
              return file ? [file] : [];
            });
            if (files.length === 0) return;
            event.preventDefault();
            void controller.addPastedImages(files);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void controller.sendMessage();
            }
          }}
          placeholder={tf('composerPlaceholder', { agent: selectedAgentName(state) })}
          ref={inputRef}
          rows={2}
          value={state.composerText}
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <div className="project-control">
              <button
                aria-label={projectBound ? t('projectBound') : t('selectProject')}
                className="composer-tool project-button"
                disabled={disabled || projectBound || state.selectingProject || !state.workspace}
                onClick={() => void controller.selectProject()}
                title={
                  state.workspace?.cwd
                    ? `${t('project')}: ${state.workspace.cwd}`
                    : t('selectProject')
                }
                type="button"
              >
                {state.selectingProject ? (
                  <LoaderCircle aria-hidden="true" className="spin" />
                ) : (
                  <FolderOpen aria-hidden="true" />
                )}
                <span>{state.workspace?.cwd ? projectName : t('selectProject')}</span>
              </button>
              {state.workspace?.kind === 'draft' && state.workspace.cwd && (
                <button
                  aria-label={t('clearProject')}
                  className="composer-tool project-clear"
                  disabled={disabled || state.selectingProject}
                  onClick={() => void controller.clearProject()}
                  title={t('clearProject')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              aria-label={state.commentMode ? t('stopPageComments') : t('addPageComment')}
              className="composer-tool composer-action"
              data-active={state.commentMode || undefined}
              disabled={disabled || state.pageCommentsPending}
              onClick={event => {
                if (event.detail > 1) return;
                void controller.togglePageComments();
              }}
              onDoubleClick={() => void controller.startContinuousPageComments()}
              title={state.commentMode ? t('stopPageComments') : t('addPageComment')}
              type="button"
            >
              {state.pageCommentsPending ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <MessageSquarePlus aria-hidden="true" />
              )}
              {state.pageComments.length > 0 && (
                <span className="composer-tool-count">{state.pageComments.length}</span>
              )}
            </button>
            <button
              aria-label={state.autoApprove ? t('disableAutoApprove') : t('enableAutoApprove')}
              className="composer-tool composer-action"
              data-active={state.autoApprove || undefined}
              onClick={() => void controller.setAutoApprove(!state.autoApprove)}
              title={state.autoApprove ? t('disableAutoApprove') : t('enableAutoApprove')}
              type="button"
            >
              <ShieldCheck aria-hidden="true" />
            </button>
          </div>
          {state.imageError && (
            <span className="composer-image-error" role="alert">
              {state.imageError}
            </span>
          )}
          <span className="composer-hint">{t('sendHint')}</span>
          {state.runningTurnId ? (
            <button
              className="stop-button"
              onClick={() => void controller.interrupt()}
              type="button"
            >
              {t('stop')}
            </button>
          ) : (
            <button
              aria-label={t('send')}
              className="send-button"
              disabled={
                disabled ||
                (state.composerText.trim().length === 0 &&
                  state.pageComments.length === 0 &&
                  state.pastedImages.length === 0)
              }
              type="submit"
            >
              <ArrowUp aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </footer>
  );
}

function ProviderPreparationNotice({ controller }: HeaderProps) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const preparation = state.providerPreparations[state.currentProviderId];
  if (!provider || preparation?.status !== 'error') return null;

  return (
    <div className="provider-preparation-notice" role="status">
      <CircleAlert aria-hidden="true" />
      <span>
        <strong>{tf('providerPreparationFailed', { agent: provider.name })}</strong>
        <small>{preparation.error}</small>
      </span>
      <button onClick={() => void controller.retryProviderPreparation()} type="button">
        {t('providerPreparationRetry')}
      </button>
    </div>
  );
}

export function SidepanelApp({ client = browserSidepanelClient }: AppProps) {
  const controller = useSidepanelController(client);
  const { state } = controller;
  const { t } = useCopy(state);
  const scrollRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const [selectedSetupIntegrations, setSelectedSetupIntegrations] =
    useState<SetupIntegrationSelection>(() => ({ ...EMPTY_SETUP_INTEGRATION_SELECTION }));

  const toggleSetupIntegration = (integration: SetupIntegration) => {
    setSelectedSetupIntegrations(current => ({
      ...current,
      [integration]: !current[integration],
    }));
  };

  useEffect(() => {
    if (!state.settingsOpen) return;
    const pointerListener = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (document.querySelector('.select-menu')) return;
      if (
        !settingsRef.current?.contains(event.target as Node) &&
        !target?.closest('.access-button') &&
        !target?.closest('.select-menu')
      ) {
        controller.setSettingsOpen(false);
      }
    };
    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') controller.setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', pointerListener);
    document.addEventListener('keydown', keyListener);
    return () => {
      document.removeEventListener('pointerdown', pointerListener);
      document.removeEventListener('keydown', keyListener);
    };
  }, [controller, state.settingsOpen]);

  return (
    <div className="app-shell relative grid h-screen grid-rows-[auto_1fr_auto_auto] bg-panel-bg text-panel-text">
      <AppHeader controller={controller} />
      {state.settingsOpen && <SettingsPopover controller={controller} popoverRef={settingsRef} />}
      <main
        className="chat-scroll min-h-0 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--border-strong)_transparent]"
        ref={scrollRef}
      >
        <AuthorizationRequestNotice controller={controller} />
        <ProviderPreparationNotice controller={controller} />
        {state.initializing ? (
          <div
            className="loading-state flex min-h-full items-center justify-center gap-[9px] text-[11px] text-panel-muted"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="loading-mark" />
            <span>{t('connectingAgent')}</span>
          </div>
        ) : state.timeline.length === 0 ? (
          <Welcome
            controller={controller}
            onToggleSetupIntegration={toggleSetupIntegration}
            selectedSetupIntegrations={selectedSetupIntegrations}
          />
        ) : (
          <Timeline controller={controller} scrollRef={scrollRef} />
        )}
      </main>
      {state.error && (
        <div className="error-banner" role="alert">
          <CircleAlert aria-hidden="true" className="error-icon" />
          <details className="error-copy">
            <summary aria-label={t('errorDetails')}>
              <ChevronRight aria-hidden="true" className="error-chevron" />
              <span>
                <strong>{t('errorTitle')}</strong>
                <small>{state.error}</small>
              </span>
            </summary>
            <div className="error-detail">{state.error}</div>
          </details>
          <button
            className="error-retry"
            onClick={() => void controller.initialize()}
            type="button"
          >
            {t('retry')}
          </button>
          <button
            aria-label={t('dismiss')}
            className="icon-button small"
            onClick={controller.dismissError}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      <Composer controller={controller} />
    </div>
  );
}
