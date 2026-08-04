import type {
  AutomationActivityCategory,
  AutomationActivityLabel,
  AutomationActivityStatus,
  ControlSessionState,
} from '@panerelay/protocol';
import { Bot, ChevronDown, CircleAlert, Github, PanelTop, X } from 'lucide-react';
import { type RefObject, useState } from 'react';
import type { AuthorizationMode } from '../../../shared/messages.js';
import {
  formatForState,
  type SidepanelController,
  type SidepanelState,
} from '../sidepanel-controller.js';
import { translate, type CopyKey, type Locale, type ThemeSetting } from '../i18n.js';
import { SelectMenu, type SelectMenuOption } from '../dropdown.js';
import { useCopy } from './presentation.js';

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
        <div className="settings-heading-actions">
          <a
            aria-label="GitHub"
            className="icon-button small"
            href="https://github.com/F-loat/panerelay"
            rel="noreferrer"
            target="_blank"
          >
            <Github aria-hidden="true" />
          </a>
          <button
            aria-label={t('close')}
            className="icon-button small"
            onClick={() => controller.setSettingsOpen(false)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="settings-field settings-theme-field">
        <span>{t('theme')}</span>
        <span className="settings-theme-controls">
          <input
            aria-label={t('accentColor')}
            className="settings-color-picker"
            onChange={event => void controller.setAccentColor(event.currentTarget.value)}
            title={t('accentColor')}
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
      <AuthorizationPanel controller={controller} />
      <ExternalControl controller={controller} />
    </aside>
  );
}
