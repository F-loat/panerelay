import type { AccentPalette } from '../shared/appearance.js';
import type { TabSummary } from '../shared/messages.js';

interface PageCommentTopPage {
  title: string;
  url: string;
}

interface PageCommentServiceOptions {
  broadcastReset: () => Promise<void>;
  ensureRuntime: (tabId: number) => Promise<boolean>;
  isAuthorized: (tab: TabSummary) => Promise<boolean>;
  resolveActiveTab: () => Promise<TabSummary | null>;
  sendToTab: (tabId: number, message: Record<string, unknown>) => Promise<unknown>;
}

function topPageFor(tab: TabSummary): PageCommentTopPage {
  let url = tab.url;
  try {
    const parsed = new URL(tab.url);
    parsed.username = '';
    parsed.password = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/(auth|code|credential|key|password|secret|session|sig|token)/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    if (/(auth|code|credential|key|password|secret|session|sig|token)/i.test(parsed.hash)) {
      parsed.hash = '#[redacted]';
    }
    url = parsed.toString();
  } catch {
    // Keep Chrome's bounded tab URL when parsing is unavailable.
  }
  return {
    url: url.replace(/\s+/g, ' ').trim().slice(0, 2_000),
    title: tab.title.replace(/\s+/g, ' ').trim().slice(0, 300),
  };
}

export class PageCommentService {
  private tabId: number | null = null;

  constructor(private readonly options: PageCommentServiceOptions) {}

  async start(
    continuous = false,
    locale?: 'en' | 'zh-CN',
    theme?: 'dark' | 'light',
    accent?: AccentPalette,
  ): Promise<void> {
    const tab = await this.requireAuthorizedActiveTab();
    if (this.tabId !== null && this.tabId !== tab.id) await this.reset();
    if (!(await this.options.ensureRuntime(tab.id))) {
      throw new Error('Panerelay could not start page comments on this page');
    }
    this.tabId = tab.id;
    await this.options.sendToTab(tab.id, {
      type: 'panerelay.page-comments.start',
      continuous,
      ...(locale ? { locale } : {}),
      ...(theme ? { theme } : {}),
      ...(accent ? { accent } : {}),
      topPage: topPageFor(tab),
    });
  }

  async updateAppearance(theme: 'dark' | 'light', accent: AccentPalette): Promise<void> {
    const tab = await this.requireCommentTab();
    await this.options.sendToTab(tab.id, {
      type: 'panerelay.page-comments.appearance',
      theme,
      accent,
    });
  }

  async stop(): Promise<void> {
    const tab = await this.requireCommentTab();
    await this.options.sendToTab(tab.id, { type: 'panerelay.page-comments.stop' });
  }

  async edit(commentId: string): Promise<void> {
    const tab = await this.requireCommentTab();
    await this.options.sendToTab(tab.id, {
      type: 'panerelay.page-comments.edit',
      commentId,
    });
  }

  async remove(commentId: string): Promise<void> {
    const tab = await this.requireCommentTab();
    await this.options.sendToTab(tab.id, {
      type: 'panerelay.page-comments.remove',
      commentId,
    });
  }

  async clear(): Promise<void> {
    await this.reset();
  }

  async resetIfTabChanged(tabId: number): Promise<void> {
    if (this.tabId !== null && this.tabId !== tabId) await this.reset();
  }

  async resetIfDocumentEnded(tabId: number): Promise<void> {
    if (this.tabId === tabId) await this.reset();
  }

  async reset(): Promise<void> {
    const tabId = this.tabId;
    this.tabId = null;
    if (tabId !== null) {
      await this.options
        .sendToTab(tabId, { type: 'panerelay.page-comments.clear' })
        .catch(() => undefined);
    }
    await this.options.broadcastReset();
  }

  private async requireCommentTab(): Promise<TabSummary> {
    const tab = await this.requireAuthorizedActiveTab();
    if (this.tabId !== tab.id) {
      await this.reset();
      throw new Error('Page comments belong to another tab or document');
    }
    return tab;
  }

  private async requireAuthorizedActiveTab(): Promise<TabSummary> {
    const tab = await this.options.resolveActiveTab();
    if (!tab) throw new Error('No active browser tab is available');
    if (!(await this.options.isAuthorized(tab))) {
      throw new Error('Authorize this page in Panerelay before adding comments');
    }
    return tab;
  }
}
