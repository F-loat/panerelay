export const RELEASE_ALL_CONTROL_MENU_ID = 'panerelay.release-all-control';

export interface ActionContextMenuCreateProperties {
  contexts: ['action'];
  id: string;
  title: string;
}

interface ReleaseActionContextMenuOptions {
  createMenu: (properties: ActionContextMenuCreateProperties, callback: () => void) => void;
  getLastErrorMessage: () => string | undefined;
  onClicked: (listener: (menuItemId: string | number) => void) => void;
  onInstalled: (listener: () => void) => void;
  releaseControl: () => Promise<unknown>;
  reportError: (error: unknown) => void;
  title: string;
}

export function installReleaseActionContextMenu(options: ReleaseActionContextMenuOptions): void {
  options.onInstalled(() => {
    options.createMenu(
      {
        contexts: ['action'],
        id: RELEASE_ALL_CONTROL_MENU_ID,
        title: options.title,
      },
      () => {
        const message = options.getLastErrorMessage();
        if (message) options.reportError(new Error(message));
      },
    );
  });

  options.onClicked(menuItemId => {
    if (menuItemId !== RELEASE_ALL_CONTROL_MENU_ID) return;
    void options.releaseControl().catch(options.reportError);
  });
}
