import type {
  AutomationActivityCategory,
  AutomationActivityLabel,
  AutomationActivityStatus,
  ControlSessionState,
} from '@panerelay/protocol';
import { normalizeBrowserFetchDomain } from '@panerelay/protocol';
import {
  Bot,
  Bug,
  Check,
  ChevronDown,
  CircleAlert,
  Github,
  Globe2,
  PanelTop,
  X,
} from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { DEFAULT_ACCENT_COLOR } from '../../../shared/appearance.js';
import type { AuthorizationMode } from '../../../shared/messages.js';
import { fetchDomainForUrl } from '../../../shared/fetch-permissions.js';
import {
  formatForState,
  type SidepanelController,
  type SidepanelState,
} from '../sidepanel-controller.js';
import { translate, type CopyKey, type Locale, type ThemeSetting } from '../i18n.js';
import { SelectMenu, type SelectMenuOption } from '../dropdown.js';
import { writeClipboardText } from '../clipboard.js';
import {
  hasConversationDiagnostics,
  serializeConversationDiagnostics,
} from '../conversation-diagnostics.js';
import { useCopy } from './presentation.js';
import { extensionManifestIdentity } from '../../../shared/manifest-identity.js';

export function authorizationDetails(state: SidepanelState) {
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

export function AuthorizationRequestNotice({ controller }: { controller: SidepanelController }) {
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

export function AuthorizationPanel({ compact = false, controller }: AuthorizationPanelProps) {
  const { state } = controller;
  const { t } = useCopy(state);
  const { help, mode, target } = authorizationDetails(state);
  const disabled = !state.extensionStatus || state.authorizationPending;

  if (compact) {
    const options: SelectMenuOption[] = [
      { value: 'single-tab', label: t('thisTab') },
      { value: 'all-tabs', label: t('allTabs') },
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
          <strong id="welcome-browser-access-title">{t('automationAuthorization')}</strong>
          <small className="scope-target">{target}</small>
        </span>
        <span className="welcome-authorization-select">
          <SelectMenu
            alignment="end"
            disabled={disabled}
            minWidth={132}
            onChange={value => void controller.setAuthorization(value as AuthorizationMode)}
            onReselect={() => void controller.setAuthorization('none')}
            options={options}
            renderTrigger={props => (
              <button
                {...props}
                aria-label={t('automationAuthorization')}
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
      <div className="scope-summary flex items-center">
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
      <div className="scope-controls flex items-center">
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

interface FetchAuthorizationPanelProps {
  compact?: boolean;
  controller: SidepanelController;
}

export function FetchAuthorizationPanel({
  compact = false,
  controller,
}: FetchAuthorizationPanelProps) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const [expanded, setExpanded] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState(false);
  const authorization = state.extensionStatus?.fetchAuthorization ?? {
    allDomains: false,
    domains: [],
  };
  const currentDomain = fetchDomainForUrl(state.extensionStatus?.activeTab?.url ?? '');
  const currentDomainAuthorized =
    !authorization.allDomains && currentDomain
      ? authorization.domains.includes(currentDomain)
      : false;
  const disabled = !state.extensionStatus || state.fetchAuthorizationPending;
  const target = authorization.allDomains
    ? t('fetchAccessAll')
    : authorization.domains.length > 0
      ? tf('fetchAccessCount', { count: authorization.domains.length })
      : t('fetchAccessNone');

  if (compact) {
    const mode = authorization.allDomains
      ? 'all-domains'
      : currentDomainAuthorized
        ? 'current-domain'
        : '';
    const options: SelectMenuOption[] = [
      {
        value: 'current-domain',
        label: t('currentDomain'),
        disabled: !currentDomain,
        title: currentDomain ?? undefined,
      },
      { value: 'all-domains', label: t('allDomains') },
    ];
    return (
      <section
        aria-labelledby="welcome-fetch-access-title"
        className="welcome-authorization"
        data-welcome-fetch-authorization
      >
        <span aria-hidden="true" className="welcome-authorization-icon">
          <Globe2 />
        </span>
        <span className="welcome-authorization-copy">
          <strong id="welcome-fetch-access-title">{t('fetchAuthorization')}</strong>
          <small className="scope-target">{target}</small>
        </span>
        <span className="welcome-authorization-select">
          <SelectMenu
            alignment="end"
            disabled={disabled}
            minWidth={132}
            onChange={value => {
              if (value === 'current-domain') {
                if (currentDomain) void controller.selectCurrentFetchDomain(currentDomain);
                return;
              }
              void controller.setFetchAuthorization({
                type: 'panerelay.fetch-authorization.set',
                scope: 'all-domains',
                enabled: true,
              });
            }}
            onReselect={value => {
              if (value === 'current-domain') {
                if (!currentDomain) return;
                void controller.setFetchAuthorization({
                  type: 'panerelay.fetch-authorization.set',
                  scope: 'domain',
                  domain: currentDomain,
                  enabled: false,
                });
                return;
              }
              void controller.setFetchAuthorization({
                type: 'panerelay.fetch-authorization.set',
                scope: 'all-domains',
                enabled: false,
              });
            }}
            options={options}
            renderTrigger={props => (
              <button
                {...props}
                aria-label={t('fetchAuthorization')}
                className="authorization-trigger"
                data-authorized={mode !== ''}
                type="button"
              >
                <span>
                  {mode === 'current-domain'
                    ? t('currentDomain')
                    : mode === 'all-domains'
                      ? t('allDomains')
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

  const addDomain = () => {
    const domain = normalizeBrowserFetchDomain(domainInput);
    if (!domain) {
      setDomainError(true);
      return;
    }
    setDomainError(false);
    setDomainInput('');
    void controller.setFetchAuthorization({
      type: 'panerelay.fetch-authorization.set',
      scope: 'domain',
      domain,
      enabled: true,
    });
  };

  return (
    <section className="browser-scope fetch-access" id="fetch-access-settings">
      <div className="scope-summary flex items-center">
        <span aria-hidden="true" className="scope-icon">
          <Globe2 />
        </span>
        <div className="scope-copy">
          <span className="scope-label">{t('fetchAccess')}</span>
          <span className="scope-target">{target}</span>
        </div>
        <button
          aria-expanded={expanded}
          aria-label={t(expanded ? 'collapseAuthorizedDomains' : 'expandAuthorizedDomains')}
          className="icon-button small"
          onClick={() => setExpanded(value => !value)}
          type="button"
        >
          <ChevronDown aria-hidden="true" data-expanded={expanded} />
        </button>
      </div>
      <div className="scope-controls flex items-center">
        <div aria-label={t('fetchAccess')} className="scope-switch" role="group">
          <button
            data-active={currentDomainAuthorized}
            disabled={disabled || !currentDomain}
            onClick={() => {
              if (!currentDomain) return;
              if (authorization.allDomains) {
                void controller.selectCurrentFetchDomain(currentDomain);
                return;
              }
              void controller.setFetchAuthorization({
                type: 'panerelay.fetch-authorization.set',
                scope: 'domain',
                domain: currentDomain,
                enabled: !currentDomainAuthorized,
              });
            }}
            title={currentDomain ?? undefined}
            type="button"
          >
            {t('currentDomain')}
          </button>
          <button
            data-active={authorization.allDomains}
            disabled={disabled}
            onClick={() =>
              void controller.setFetchAuthorization({
                type: 'panerelay.fetch-authorization.set',
                scope: 'all-domains',
                enabled: !authorization.allDomains,
              })
            }
            type="button"
          >
            {t('allDomains')}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="fetch-domain-manager">
          <span className="fetch-domain-title">{t('authorizedDomains')}</span>
          <div className="fetch-domain-add">
            <input
              aria-invalid={domainError}
              aria-label={t('fetchDomainPlaceholder')}
              disabled={disabled}
              onChange={event => {
                setDomainInput(event.currentTarget.value);
                setDomainError(false);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') addDomain();
              }}
              placeholder={t('fetchDomainPlaceholder')}
              value={domainInput}
            />
            <button disabled={disabled || !domainInput.trim()} onClick={addDomain} type="button">
              {t('addFetchDomain')}
            </button>
          </div>
          {domainError && <small className="fetch-domain-error">{t('fetchDomainInvalid')}</small>}
          <ul className="fetch-domain-list">
            {authorization.domains.map(domain => (
              <li key={domain}>
                <code>{domain}</code>
                <button
                  aria-label={tf('removeFetchDomain', { domain })}
                  className="icon-button small"
                  disabled={disabled}
                  onClick={() =>
                    void controller.setFetchAuthorization({
                      type: 'panerelay.fetch-authorization.set',
                      scope: 'domain',
                      domain,
                      enabled: false,
                    })
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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

export function SettingsPopover({
  controller,
  popoverRef,
}: {
  controller: SidepanelController;
  popoverRef: RefObject<HTMLElement | null>;
}) {
  const { state } = controller;
  const { t } = useCopy(state);
  const { releaseVersion } = extensionManifestIdentity();
  const diagnosticCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
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

  useEffect(
    () => () => {
      if (diagnosticCopyTimer.current) clearTimeout(diagnosticCopyTimer.current);
    },
    [],
  );

  const copyConversationDiagnostics = async () => {
    const copied = await writeClipboardText(serializeConversationDiagnostics(state));
    setDiagnosticCopyStatus(copied ? 'copied' : 'failed');
    if (diagnosticCopyTimer.current) clearTimeout(diagnosticCopyTimer.current);
    diagnosticCopyTimer.current = setTimeout(() => setDiagnosticCopyStatus('idle'), 2_000);
  };

  const diagnosticCopyLabel = t(
    diagnosticCopyStatus === 'copied'
      ? 'conversationDiagnosticsCopied'
      : diagnosticCopyStatus === 'failed'
        ? 'conversationDiagnosticsCopyFailed'
        : 'copyConversationDiagnostics',
  );

  return (
    <aside className="settings-popover" id="settings-popover" ref={popoverRef}>
      <div className="settings-heading">
        <span className="settings-heading-title">
          <strong>{t('settings')}</strong>
          <span
            aria-label={`Panerelay v${releaseVersion}`}
            className="settings-version"
            title={`v${releaseVersion}`}
          >
            v{releaseVersion}
          </span>
        </span>
        <div className="settings-heading-actions">
          {hasConversationDiagnostics(state) && (
            <>
              <button
                aria-label={diagnosticCopyLabel}
                className="icon-button small"
                onClick={() => void copyConversationDiagnostics()}
                title={diagnosticCopyLabel}
                type="button"
              >
                {diagnosticCopyStatus === 'copied' ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Bug aria-hidden="true" />
                )}
              </button>
              {diagnosticCopyStatus !== 'idle' && (
                <span aria-live="polite" className="sr-only" role="status">
                  {diagnosticCopyLabel}
                </span>
              )}
            </>
          )}
          <a
            aria-label="GitHub"
            className="icon-button small"
            href="https://github.com/F-loat/panerelay"
            rel="noreferrer"
            target="_blank"
          >
            <Github aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="settings-field settings-theme-field">
        <span>{t('theme')}</span>
        <span className="settings-theme-controls">
          <input
            aria-label={t('accentColor')}
            className="settings-color-picker"
            onChange={event => void controller.setAccentColor(event.currentTarget.value)}
            onDoubleClick={() => void controller.setAccentColor(DEFAULT_ACCENT_COLOR)}
            title={t('accentColorResetHint')}
            type="color"
            value={state.accentColor}
          />
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
      <FetchAuthorizationPanel controller={controller} />
      <AuthorizationPanel controller={controller} />
      <ExternalControl controller={controller} />
    </aside>
  );
}
