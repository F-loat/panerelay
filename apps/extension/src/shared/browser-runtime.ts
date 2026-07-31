import type { BrowserFamily } from '@panerelay/protocol';

export interface BrowserRuntime {
  actionBadge: boolean;
  browserFamily: BrowserFamily;
  browserName: string;
  cdpRelay: boolean;
  chromiumSidePanel: boolean;
  firefoxSidebar: boolean;
}
