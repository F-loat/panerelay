import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { FetchPermissionPage } from './page.js';

beforeEach(() => {
  window.history.replaceState({}, '', '/?domain=*.baidu.com&requestId=request-1');
  Object.assign(chrome, {
    permissions: { request: vi.fn(async () => true) },
    runtime: { sendMessage: vi.fn(async () => ({})) },
  });
  vi.spyOn(window, 'close').mockImplementation(() => undefined);
});

test('requests wildcard Host Permission and reports domain approval', async () => {
  const user = userEvent.setup();
  render(<FetchPermissionPage />);
  expect(screen.getByText('*.baidu.com')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Allow all domains' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Allow this domain' }));
  await waitFor(() =>
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ['http://*.baidu.com/*', 'https://*.baidu.com/*'],
    }),
  );
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'panerelay.fetch-permission.decision',
    requestId: 'request-1',
    granted: true,
    scope: 'domain',
  });
});

test('keeps the popup open when Chrome denies and reports explicit user denial', async () => {
  const user = userEvent.setup();
  vi.mocked(chrome.permissions.request).mockResolvedValue(false);
  render(<FetchPermissionPage />);
  await user.click(screen.getByRole('button', { name: 'Allow this domain' }));
  expect(await screen.findByText(/Chrome did not grant site access/)).toBeVisible();
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Deny' }));
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'panerelay.fetch-permission.decision',
    requestId: 'request-1',
    granted: false,
  });
});
