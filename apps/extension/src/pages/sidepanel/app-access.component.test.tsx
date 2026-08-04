import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SidepanelApp } from './app.js';
import { AppClient, readyStatus, renderReady } from './app.test-support.js';

describe('React Side Panel browser access and settings', () => {
  it('opens settings, changes authorization, and persists language', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    expect(screen.getByText('Settings')).toBeVisible();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/F-loat/panerelay',
    );
    await user.click(screen.getByRole('button', { name: 'All tabs' }));
    await waitFor(() => expect(client.status.authorizationMode).toBe('all-tabs'));
    expect(screen.getAllByText('All web tabs authorized').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(screen.getByRole('option', { name: '中文' }));
    expect(await screen.findByText('设置')).toBeVisible();
    expect(client.stored['panerelay.locale']).toBe('zh-CN');
  });

  it('toggles selected authorization scopes off and releases control without clearing scope', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const currentTab = screen.getByRole('button', { name: 'This tab' });
    const allTabs = screen.getByRole('button', { name: 'All tabs' });

    await user.click(currentTab);
    await waitFor(() => expect(client.status.authorizationMode).toBe('single-tab'));
    await user.click(currentTab);
    await waitFor(() => expect(client.status.authorizationMode).toBe('none'));

    await user.click(allTabs);
    await waitFor(() => expect(client.status.authorizationMode).toBe('all-tabs'));
    await user.click(allTabs);
    await waitFor(() => expect(client.status.authorizationMode).toBe('none'));

    await user.click(allTabs);
    await waitFor(() => expect(client.status.authorizationMode).toBe('all-tabs'));
    const authorizationRequestCount = client.requests.filter(
      request => request.type === 'panerelay.authorization.set',
    ).length;
    await user.click(screen.getByRole('button', { name: 'Release' }));

    await waitFor(() =>
      expect(client.requests).toContainEqual({ type: 'panerelay.control.release' }),
    );
    expect(client.status.authorizationMode).toBe('all-tabs');
    expect(
      client.requests.filter(request => request.type === 'panerelay.authorization.set'),
    ).toHaveLength(authorizationRequestCount);
  });

  it('sets independent automation and browser defaults from compact settings controls', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const automationDefaults = screen.getByText('Set as default').closest('.settings-field');
    expect(automationDefaults).not.toBeNull();
    expect(screen.getByText('agent-browser')).toBeVisible();
    expect(screen.getByText('browser-use')).toBeVisible();
    expect(automationDefaults?.querySelectorAll('.settings-provider-indicator')).toHaveLength(0);
    expect(screen.getByText('Control by default')).toBeVisible();
    expect(document.querySelectorAll('.settings-provider-indicator')).toHaveLength(0);
    expect(screen.queryByText('Native Host unavailable')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set agent-browser as default Provider' }));

    await waitFor(() =>
      expect(client.requests).toContainEqual({
        type: 'panerelay.default-provider.set',
        enabled: true,
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Clear agent-browser default Provider' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      screen.getByRole('button', { name: 'Use Panerelay for browser-use by default' }),
    );
    expect(client.requests).toContainEqual({
      type: 'panerelay.browser-use-default.set',
      enabled: true,
    });
    expect(
      screen.getByRole('button', {
        name: 'Stop using Panerelay for browser-use by default',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Clear agent-browser default Provider' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Clear agent-browser default Provider' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.default-provider.set',
      enabled: false,
    });
    expect(
      screen.getByRole('button', {
        name: 'Stop using Panerelay for browser-use by default',
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      screen.getByRole('button', {
        name: 'Stop using Panerelay for browser-use by default',
      }),
    );
    expect(client.requests).toContainEqual({
      type: 'panerelay.browser-use-default.set',
      enabled: false,
    });

    await user.click(screen.getByRole('switch', { name: 'Control this browser by default' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.browser-default.set',
      enabled: true,
    });
    expect(
      screen.getByRole('switch', { name: 'Stop controlling this browser by default' }),
    ).toHaveAttribute('aria-checked', 'true');
    await user.click(
      screen.getByRole('switch', { name: 'Stop controlling this browser by default' }),
    );
    expect(client.requests).toContainEqual({
      type: 'panerelay.browser-default.set',
      enabled: false,
    });
    expect(screen.getByRole('switch', { name: 'Control this browser by default' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('hides default control after the browser registry returns to one connection', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    expect(screen.getByText('Control by default')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    client.status = {
      ...client.status,
      browserDefault: {
        ...client.status.browserDefault!,
        hasMultipleBrowsers: false,
      },
    };
    await user.click(screen.getByRole('button', { name: /Browser access:/ }));

    await waitFor(() => expect(screen.queryByText('Control by default')).not.toBeInTheDocument());
    expect(
      screen.queryByRole('switch', { name: /this browser by default/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps browser-use clickable and installs it when its adapter is unavailable', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      browserUseDefault: { available: false, mode: null, isPanerelay: false },
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const button = screen.getByRole('button', { name: 'Install browser-use' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-install-label', 'Click to install');
    expect(button).toHaveAttribute('data-installable', 'true');
    expect(
      screen.getByRole('button', { name: 'Set agent-browser as default Provider' }),
    ).toBeEnabled();
    await user.click(button);
    expect(client.requests).toContainEqual({
      type: 'panerelay.integration.install',
      integration: 'browser-use',
    });
    expect(
      screen.getByRole('button', { name: 'Stop using Panerelay for browser-use by default' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps agent-browser clickable and installs it when its Provider is unavailable', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      defaultProvider: { available: false, provider: null, isPanerelay: false },
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const button = screen.getByRole('button', {
      name: 'Install agent-browser',
    });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-install-label', 'Click to install');
    expect(button).toHaveAttribute('data-installable', 'true');
    expect(
      screen.getByRole('button', { name: 'Use Panerelay for browser-use by default' }),
    ).toBeEnabled();
    await user.click(button);
    expect(client.requests).toContainEqual({
      type: 'panerelay.integration.install',
      integration: 'agent-browser',
    });
    expect(
      screen.getByRole('button', { name: 'Clear agent-browser default Provider' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a per-adapter installing state and prevents duplicate clicks', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      browserUseDefault: { available: false, mode: null, isPanerelay: false },
    };
    let release: (() => void) | undefined;
    client.installPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    await user.click(screen.getByRole('button', { name: 'Install browser-use' }));
    const installing = await screen.findByRole('button', { name: 'Installing…' });
    expect(installing).toBeDisabled();
    expect(installing).toHaveAttribute('aria-busy', 'true');
    expect(installing).toHaveTextContent('Installing…');
    await user.click(installing);
    expect(
      client.requests.filter(request => request.type === 'panerelay.integration.install'),
    ).toHaveLength(1);

    release?.();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Stop using Panerelay for browser-use by default',
        }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('composes and copies optional integrations while guiding a missing Native Host', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      bridgeConnected: false,
      nativeHostState: 'missing',
      defaultProvider: null,
      error: 'Specified native messaging host not found.',
    };
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);

    const guide = await screen.findByRole('region', {
      name: 'Install the Panerelay integration',
    });
    const heading = screen.getByRole('heading', { name: 'Install the Panerelay integration' });
    expect(guide).not.toContainElement(heading);
    expect(
      Array.from(guide.children).map(element => element.getAttribute('data-setup-card')),
    ).toEqual(['benefits', 'action', 'integrations']);
    expect(within(guide).getByText('Reuse your signed-in browser session')).toBeVisible();
    expect(within(guide).getByText('Choose the current tab or all supported tabs')).toBeVisible();
    expect(within(guide).getByText('Install the local integration')).toBeVisible();
    expect(
      within(guide).queryByText('The local Native Host was not found.'),
    ).not.toBeInTheDocument();
    expect(within(guide).getByText('npx --yes @panerelay/setup')).toBeVisible();
    const agentBrowser = within(guide).getByRole('button', { name: /^agent-browser/ });
    const browserUse = within(guide).getByRole('button', { name: /^browser-use/ });
    expect(agentBrowser).toHaveClass('settings-provider-toggle', 'settings-default-toggle');
    expect(browserUse).toHaveClass('settings-provider-toggle', 'settings-default-toggle');
    expect(agentBrowser).toHaveTextContent(/^agent-browser$/);
    expect(browserUse).toHaveTextContent(/^browser-use$/);
    expect(within(guide).queryByText(/Provider and Skill/)).not.toBeInTheDocument();
    expect(within(guide).queryByText(/Adapter and Skill/)).not.toBeInTheDocument();
    expect(agentBrowser).toHaveAttribute('aria-pressed', 'false');
    expect(browserUse).toHaveAttribute('aria-pressed', 'false');

    await user.click(agentBrowser);
    expect(within(guide).getByText('npx --yes @panerelay/setup --agent-browser')).toBeVisible();
    await user.click(browserUse);
    expect(
      within(guide).getByText('npx --yes @panerelay/setup --agent-browser --browser-use'),
    ).toBeVisible();
    expect(agentBrowser).toHaveAttribute('aria-pressed', 'true');
    expect(browserUse).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(guide).getByRole('button', { name: 'Copy setup command' }));
    expect(await navigator.clipboard.readText()).toBe(
      'npx --yes @panerelay/setup --agent-browser --browser-use',
    );
    expect(within(guide).getByRole('button', { name: 'Setup command copied' })).toBeVisible();
    expect(within(guide).getByRole('status')).toHaveTextContent('Setup command copied');

    await user.click(agentBrowser);
    expect(within(guide).getByText('npx --yes @panerelay/setup --browser-use')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(within(guide).getByRole('button', { name: 'Retry connection' }));
    expect(client.requests).toContainEqual({ type: 'panerelay.native.retry' });
    expect(within(guide).getByText('npx --yes @panerelay/setup --browser-use')).toBeVisible();

    const missingStatus = client.status;
    client.status = readyStatus;
    act(() => {
      client.emit({ type: 'panerelay.status.changed', status: readyStatus });
    });
    expect(await screen.findByRole('heading', { name: 'What should Codex do?' })).toBeVisible();

    client.status = missingStatus;
    act(() => {
      client.emit({ type: 'panerelay.status.changed', status: missingStatus });
    });
    const restoredGuide = await screen.findByRole('region', {
      name: 'Install the Panerelay integration',
    });
    expect(
      within(restoredGuide).getByText('npx --yes @panerelay/setup --browser-use'),
    ).toBeVisible();
    expect(within(restoredGuide).getByRole('button', { name: 'browser-use' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('surfaces authorization requests and controlled-tab actions', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      authorizationRequest: 'all-tabs',
      controlledTab: { id: 9, title: 'Controlled fixture', url: 'https://example.com/controlled' },
      controlledTabs: [
        { id: 9, title: 'Controlled fixture', url: 'https://example.com/controlled' },
      ],
      controlSession: {
        id: 'control-1',
        actor: { kind: 'automation', name: 'agent-browser' },
        state: 'active',
        participantCount: 1,
        observedTargetCount: 2,
        controlledTargetCount: 1,
        heartbeatFreshness: 'fresh',
        updatedAt: '2026-07-30T05:27:00.000Z',
      },
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Authorize all tabs' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.authorization.set',
      mode: 'all-tabs',
    });

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const externalControl = screen.getByText('External control').closest('section');
    expect(externalControl).not.toBeNull();
    expect(within(externalControl as HTMLElement).getByText(/2 observed tabs/)).toBeVisible();
    expect(within(externalControl as HTMLElement).getByText(/1 controlled tabs/)).toBeVisible();
    expect(
      within(externalControl as HTMLElement).queryByRole('button', { name: 'Release' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand external control details' }));
    await user.click(screen.getByRole('button', { name: 'Activate Controlled fixture' }));
    await user.click(screen.getByRole('button', { name: 'Close Controlled fixture' }));

    expect(client.requests).toContainEqual({
      type: 'panerelay.controlled-tab.activate',
      tabId: 9,
    });
    expect(client.requests).toContainEqual({
      type: 'panerelay.controlled-tab.close',
      tabId: 9,
    });
  });

  it('keeps external control activity collapsed until the summary is opened', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      controlSession: {
        id: 'control-1',
        actor: {
          kind: 'automation',
          name: 'agent-browser',
          sessionLabel: 'panerelay-summary',
        },
        state: 'released',
        participantCount: 0,
        observedTargetCount: 0,
        controlledTargetCount: 0,
        heartbeatFreshness: 'unknown',
        updatedAt: '2026-07-30T05:27:00.000Z',
      },
      automationActivities: [
        {
          id: 'activity-1',
          sessionId: 'control-1',
          actor: { kind: 'automation', name: 'agent-browser' },
          category: 'target',
          label: 'manage-target',
          status: 'completed',
          sequence: 1,
          startedAt: '2026-07-30T05:27:00.000Z',
          updatedAt: '2026-07-30T05:27:01.000Z',
        },
      ],
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const toggle = screen.getByRole('button', { name: 'Expand external control details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Manage tabs')).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByText('Manage tabs')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse external control details' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
