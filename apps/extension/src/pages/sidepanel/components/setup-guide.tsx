import type { AutomationIntegrationId } from '@panerelay/protocol';
import { Check, Copy, PanelTop, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SidepanelController } from '../sidepanel-controller.js';
import { writeClipboardText } from '../clipboard.js';
import { useCopy } from './presentation.js';

const PANERELAY_SETUP_COMMAND = 'npx --yes @panerelay/setup';
export type SetupIntegration = AutomationIntegrationId;
export type SetupIntegrationSelection = Record<SetupIntegration, boolean>;

const SETUP_INTEGRATIONS: readonly SetupIntegration[] = ['agent-browser', 'browser-use'];
export const EMPTY_SETUP_INTEGRATION_SELECTION: Readonly<SetupIntegrationSelection> = {
  'agent-browser': false,
  'browser-use': false,
};

export function PanerelaySetupGuide({
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
