import { ChevronRight, CircleAlert, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSidepanelController } from './sidepanel-controller.js';
import { browserSidepanelClient, type SidepanelClient } from './sidepanel-client.js';
import { AuthorizationRequestNotice, SettingsPopover } from './components/access-settings.js';
import {
  EMPTY_SETUP_INTEGRATION_SELECTION,
  type SetupIntegration,
  type SetupIntegrationSelection,
} from './components/setup-guide.js';
import { Composer } from './components/composer.js';
import { Timeline, Welcome } from './components/conversation.js';
import { AppHeader } from './components/header.js';
import { ProviderPreparationNotice } from './components/notices.js';
import { useCopy } from './components/presentation.js';
import type { ProviderBootstrap } from './provider-selection.js';

interface AppProps {
  bootstrap?: ProviderBootstrap;
  client?: SidepanelClient;
}

export function SidepanelApp({ bootstrap, client = browserSidepanelClient }: AppProps) {
  const controller = useSidepanelController(client, bootstrap);
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
