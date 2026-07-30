import type {
  AgentProviderSummary,
  AutomationActivityCategory,
  AutomationActivityLabel,
  AutomationActivityStatus,
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationMessage,
  ConversationSummary,
  ControlSessionState,
} from '@panerelay/protocol';
import type {
  AuthorizationMode,
  ConversationChangedMessage,
  ExtensionStatus,
  SidePanelRequest,
  SidePanelSuccessResponse,
  StatusChangedMessage,
} from '../../shared/messages.js';
import { ALL_WEB_ORIGIN_PATTERNS, originAuthorizationForUrl } from '../../shared/authorization.js';
import { SelectMenu } from './select-menu.js';
import {
  conversationProviderId,
  selectProviderId,
  supportedProviders,
} from './provider-selection.js';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  createElement as createLucideElement,
  createIcons,
  FilePenLine,
  ListCollapse,
  LoaderCircle,
  MessagesSquare,
  PanelTop,
  ScanSearch,
  Search,
  ShieldQuestion,
  Sparkles,
  SquarePen,
  Terminal,
  X,
  type IconNode,
} from 'lucide';

createIcons({
  icons: {
    ArrowUp,
    Bot,
    ChevronDown,
    ChevronRight,
    CircleAlert,
    ListCollapse,
    LoaderCircle,
    MessagesSquare,
    PanelTop,
    ScanSearch,
    Search,
    Sparkles,
    SquarePen,
    X,
  },
});

type Locale = 'zh-CN' | 'en';
type ThemeSetting = 'system' | 'dark' | 'light';

type TimelineItem =
  | { type: 'message'; message: ConversationMessage; streaming?: boolean }
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'activity'; activity: ConversationActivity }
  | { type: 'approval'; approval: ConversationApproval }
  | { type: 'error'; id: string; message: string };

const LOCALE_KEY = 'panerelay.locale';
const PROVIDER_KEY = 'panerelay.agentProvider';
const THEME_KEY = 'panerelay.theme';

const copy = {
  en: {
    settings: 'Settings',
    close: 'Close',
    dismiss: 'Dismiss',
    retry: 'Retry',
    send: 'Send',
    agentProvider: 'Agent provider',
    conversationHistory: 'Conversation history',
    browserAuthorization: 'Browser authorization',
    theme: 'Theme',
    themeSystem: 'System',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    connectingAgent: 'Connecting to your local agent…',
    emptyTitle: 'What should {agent} do?',
    emptyBody: 'Chat with a local agent and let it work in the browser scope you authorize.',
    emptyBridgeTitle: 'Connect the local Bridge',
    emptyBridgeBody:
      'PaneRelay needs its local Native Host before agents can start a conversation.',
    emptyProviderTitle: 'Set up {agent}',
    emptyProviderBody: 'Install or reconnect the selected Agent, then retry provider discovery.',
    codexSetupBody: 'Install or reconnect Codex, then retry provider discovery.',
    qoderSetupBody:
      'Install Qoder CLI, run qodercli to sign in, then run panerelay setup and retry.',
    providerInstallCommand: 'Install',
    providerLoginCommand: 'Sign in',
    providerSetupDocs: 'Open setup documentation',
    suggestSummarize: 'Summarize this page',
    suggestSummarizeBody: 'Extract the main ideas and useful details',
    suggestInspect: 'Explain the interactions',
    suggestInspectBody: 'Identify the page’s key controls and flows',
    suggestFind: 'Find something',
    suggestFindBody: 'Locate specific information on this page',
    suggestSummarizePrompt: 'Summarize the current page and highlight the most useful details.',
    suggestInspectPrompt: 'Inspect this page and explain its main controls and interaction flows.',
    suggestFindPrompt: 'Help me find specific information on the current page.',
    browserAccess: 'Browser access',
    release: 'Release',
    thisTab: 'This tab',
    allTabs: 'All tabs',
    scopeHelpNone: 'Authorize a scope before the selected Agent can use agent-browser.',
    scopeHelpSingle:
      'Only this tab and its current site are eligible for the next control session.',
    scopeHelpAll:
      'All web tabs are eligible after Chrome approval; this choice persists until released.',
    composerPlaceholder: 'Ask {agent} to browse or work…',
    sendHint: 'Enter to send · Shift+Enter for newline',
    stop: 'Stop',
    bridgeDisconnected: 'Bridge offline',
    providerUnavailable: '{agent} unavailable',
    providerReady: 'Ready',
    providerNotInstalled: 'Not installed',
    connected: 'Connected',
    connecting: 'Connecting…',
    noTabAuthorized: 'No tab authorized',
    allTabsEligible: 'All web tabs authorized',
    chromeAccessDeniedAll: 'Chrome access to all web origins was not granted',
    chromeAccessDeniedSite: 'Chrome site access was not granted',
    unsupportedBrowserPage: 'PaneRelay cannot control this browser page',
    controlling: 'Controlling',
    controllingTabs: 'Controlling {count} tabs',
    authorized: 'Authorized',
    newConversation: 'New conversation',
    loadingConversation: 'Loading…',
    running: 'running',
    waiting: 'approval',
    interrupted: 'Turn interrupted',
    failed: 'Turn failed',
    assistant: 'Codex',
    thinking: 'Reasoning',
    approval: 'Approval required',
    allowOnce: 'Allow once',
    allowSession: 'Allow for session',
    deny: 'Deny',
    denySession: 'Deny for session',
    cancelApproval: 'Cancel',
    activityRunning: 'running',
    activityCompleted: 'done',
    activityFailed: 'failed',
    activityDeclined: 'declined',
    externalControl: 'External control',
    activityHistoryGap: 'Some earlier activity is unavailable.',
    controlAllocated: 'Waiting for Agent',
    controlConnected: 'Agent connected',
    controlActive: 'Active',
    controlReleased: 'Released',
    controlExpired: 'Expired',
    controlFailed: 'Failed',
    controlTargets: '{count} controlled tabs',
    heartbeatLive: 'Heartbeat live',
    categoryTarget: 'Tabs',
    categoryNavigation: 'Navigation',
    categoryInteraction: 'Interaction',
    categoryPageContent: 'Page',
    categoryBrowserState: 'Browser state',
    categoryNetwork: 'Network',
    categoryEmulation: 'Emulation',
    categoryArtifact: 'Artifact',
    categoryOther: 'Browser',
    labelManageTarget: 'Manage tabs',
    labelNavigatePage: 'Navigate page',
    labelInteractWithPage: 'Interact with page',
    labelReadPage: 'Read page',
    labelManageBrowserState: 'Manage browser state',
    labelInspectNetwork: 'Inspect network',
    labelEmulatePage: 'Emulate page',
    labelCreateArtifact: 'Create artifact',
    labelRunBrowserOperation: 'Run browser operation',
    automationStarted: 'running',
    automationCompleted: 'done',
    automationFailed: 'failed',
    automationDenied: 'denied',
    errorTitle: 'Something went wrong',
    workingDirectory: 'Working directory',
  },
  'zh-CN': {
    settings: '设置',
    close: '关闭',
    dismiss: '忽略',
    retry: '重试',
    send: '发送',
    agentProvider: 'Agent Provider',
    conversationHistory: '会话历史',
    browserAuthorization: '浏览器授权',
    theme: '主题',
    themeSystem: '跟随系统',
    themeDark: '暗色',
    themeLight: '亮色',
    language: '语言',
    connectingAgent: '正在连接本地 Agent…',
    emptyTitle: '想让 {agent} 做什么？',
    emptyBody: '和本地 Agent 对话，并让它在你授权的浏览器范围内工作。',
    emptyBridgeTitle: '连接本地 Bridge',
    emptyBridgeBody: 'PaneRelay 需要连接本地 Native Host 后才能启动 Agent 会话。',
    emptyProviderTitle: '配置 {agent}',
    emptyProviderBody: '安装或重新连接所选 Agent，然后重试 Provider 检测。',
    codexSetupBody: '安装或重新连接 Codex，然后重试 Provider 检测。',
    qoderSetupBody: '安装 Qoder CLI，运行 qodercli 完成登录，再运行 panerelay setup 后重试。',
    providerInstallCommand: '安装',
    providerLoginCommand: '登录',
    providerSetupDocs: '打开配置文档',
    suggestSummarize: '总结当前页面',
    suggestSummarizeBody: '提取主要观点和有用细节',
    suggestInspect: '分析页面交互',
    suggestInspectBody: '识别页面的主要控件和操作流程',
    suggestFind: '查找页面信息',
    suggestFindBody: '定位当前页面里的特定内容',
    suggestSummarizePrompt: '总结当前页面，并突出其中最有用的信息。',
    suggestInspectPrompt: '分析当前页面，说明主要控件和交互流程。',
    suggestFindPrompt: '帮我在当前页面查找特定信息。',
    browserAccess: '浏览器授权',
    release: '释放',
    thisTab: '当前标签页',
    allTabs: '所有标签页',
    scopeHelpNone: '授权一个范围后，所选 Agent 才能使用 agent-browser。',
    scopeHelpSingle: '下一次控制会话只能选择当前标签页及其当前站点。',
    scopeHelpAll: '经 Chrome 确认后可选择所有网页标签页；该授权会保持到手动释放。',
    composerPlaceholder: '让 {agent} 浏览页面或执行任务…',
    sendHint: 'Enter 发送 · Shift+Enter 换行',
    stop: '停止',
    bridgeDisconnected: 'Bridge 未连接',
    providerUnavailable: '{agent} 不可用',
    providerReady: '已安装',
    providerNotInstalled: '未安装',
    connected: '已连接',
    connecting: '连接中…',
    noTabAuthorized: '尚未授权标签页',
    allTabsEligible: '已授权所有网页标签页',
    chromeAccessDeniedAll: '未获得 Chrome 的所有网站访问权限',
    chromeAccessDeniedSite: '未获得 Chrome 的站点访问权限',
    unsupportedBrowserPage: 'PaneRelay 无法控制这个浏览器页面',
    controlling: '正在控制',
    controllingTabs: '正在控制 {count} 个标签页',
    authorized: '已授权',
    newConversation: '新建会话',
    loadingConversation: '加载中…',
    running: '运行中',
    waiting: '等待授权',
    interrupted: '任务已中断',
    failed: '任务失败',
    assistant: 'Codex',
    thinking: '思考摘要',
    approval: '需要授权',
    allowOnce: '仅允许本次',
    allowSession: '本会话内允许',
    deny: '拒绝',
    denySession: '本会话内拒绝',
    cancelApproval: '取消',
    activityRunning: '执行中',
    activityCompleted: '完成',
    activityFailed: '失败',
    activityDeclined: '已拒绝',
    externalControl: '外部控制',
    activityHistoryGap: '部分更早的活动记录不可用。',
    controlAllocated: '等待 Agent 接入',
    controlConnected: 'Agent 已连接',
    controlActive: '正在控制',
    controlReleased: '已释放',
    controlExpired: '已超时',
    controlFailed: '连接失败',
    controlTargets: '控制 {count} 个标签页',
    heartbeatLive: '心跳正常',
    categoryTarget: '标签页',
    categoryNavigation: '导航',
    categoryInteraction: '交互',
    categoryPageContent: '页面',
    categoryBrowserState: '浏览器状态',
    categoryNetwork: '网络',
    categoryEmulation: '模拟环境',
    categoryArtifact: '产物',
    categoryOther: '浏览器',
    labelManageTarget: '管理标签页',
    labelNavigatePage: '导航页面',
    labelInteractWithPage: '操作页面',
    labelReadPage: '读取页面',
    labelManageBrowserState: '管理浏览器状态',
    labelInspectNetwork: '检查网络',
    labelEmulatePage: '模拟页面环境',
    labelCreateArtifact: '生成产物',
    labelRunBrowserOperation: '执行浏览器操作',
    automationStarted: '执行中',
    automationCompleted: '完成',
    automationFailed: '失败',
    automationDenied: '已拒绝',
    errorTitle: '出现了一点问题',
    workingDirectory: '工作目录',
  },
} as const;

type CopyKey = keyof (typeof copy)['en'];

function element<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing side panel element: ${selector}`);
  return node;
}

const providerSelect = element<HTMLSelectElement>('[data-provider]');
const providerTrigger = element<HTMLButtonElement>('[data-provider-trigger]');
const providerLabel = element<HTMLElement>('[data-provider-label]');
const conversationSelect = element<HTMLSelectElement>('[data-conversation]');
const conversationTrigger = element<HTMLButtonElement>('[data-conversation-trigger]');
const conversationState = element<HTMLElement>('[data-conversation-state]');
const connectionLabel = element<HTMLElement>('[data-connection-label]');
const statusDot = element<HTMLElement>('[data-status-dot]');
const settings = element<HTMLElement>('[data-settings]');
const settingsClose = element<HTMLButtonElement>('[data-settings-close]');
const accessToggle = element<HTMLButtonElement>('[data-access-toggle]');
const browserScope = element<HTMLElement>('[data-browser-scope]');
const themeSelect = element<HTMLSelectElement>('[data-theme-setting]');
const themeTrigger = element<HTMLButtonElement>('[data-theme-trigger]');
const themeValue = element<HTMLElement>('[data-theme-value]');
const languageSelect = element<HTMLSelectElement>('[data-language-setting]');
const languageTrigger = element<HTMLButtonElement>('[data-language-trigger]');
const languageValue = element<HTMLElement>('[data-language-value]');
const newConversationButton = element<HTMLButtonElement>('[data-new-conversation]');
const chatScroll = element<HTMLElement>('[data-chat-scroll]');
const externalControl = element<HTMLElement>('[data-external-control]');
const controlActor = element<HTMLElement>('[data-control-actor]');
const controlMeta = element<HTMLElement>('[data-control-meta]');
const controlGap = element<HTMLElement>('[data-control-gap]');
const externalActivities = element<HTMLOListElement>('[data-external-activities]');
const controlReleaseButton = element<HTMLButtonElement>('[data-control-release]');
const loadingState = element<HTMLElement>('[data-loading]');
const emptyState = element<HTMLElement>('[data-empty]');
const emptyTitle = element<HTMLElement>('[data-empty-title]');
const emptyBody = element<HTMLElement>('[data-empty-body]');
const providerSetup = element<HTMLElement>('[data-provider-setup]');
const providerInstallRow = element<HTMLElement>('[data-provider-install-row]');
const providerInstall = element<HTMLElement>('[data-provider-install]');
const providerLoginRow = element<HTMLElement>('[data-provider-login-row]');
const providerLogin = element<HTMLElement>('[data-provider-login]');
const providerDocs = element<HTMLAnchorElement>('[data-provider-docs]');
const suggestions = element<HTMLElement>('[data-suggestions]');
const timelineElement = element<HTMLElement>('[data-timeline]');
const errorBanner = element<HTMLElement>('[data-error]');
const errorMessage = element<HTMLElement>('[data-error-message]');
const errorRetryButton = element<HTMLButtonElement>('[data-error-retry]');
const errorDismissButton = element<HTMLButtonElement>('[data-error-dismiss]');
const scopeTarget = element<HTMLElement>('[data-scope-target]');
const scopeHelp = element<HTMLElement>('[data-scope-help]');
const releaseButton = element<HTMLButtonElement>('[data-release]');
const scopeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-scope]')];
const composer = element<HTMLFormElement>('[data-composer]');
const input = element<HTMLTextAreaElement>('[data-input]');
const sendButton = element<HTMLButtonElement>('[data-send]');
const stopButton = element<HTMLButtonElement>('[data-stop]');
const suggestionButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-suggestion]')];

const providerSelectMenu = new SelectMenu({
  minWidth: 176,
  selectedLabel: providerLabel,
  select: providerSelect,
  trigger: providerTrigger,
});
const conversationSelectMenu = new SelectMenu({
  alignment: 'end',
  minWidth: 240,
  select: conversationSelect,
  trigger: conversationTrigger,
});
const themeSelectMenu = new SelectMenu({
  alignment: 'end',
  minWidth: 148,
  selectedLabel: themeValue,
  select: themeSelect,
  trigger: themeTrigger,
});
const languageSelectMenu = new SelectMenu({
  alignment: 'end',
  minWidth: 148,
  selectedLabel: languageValue,
  select: languageSelect,
  trigger: languageTrigger,
});

let locale: Locale = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
let themeSetting: ThemeSetting = 'system';
let extensionStatus: ExtensionStatus | null = null;
let providers: AgentProviderSummary[] = supportedProviders([]);
let conversations: ConversationSummary[] = [];
let currentProviderId = 'codex';
let currentConversation: ConversationSummary | null = null;
let timeline: TimelineItem[] = [];
let runningTurnId: string | null = null;
let loadingConversation = false;
let submitting = false;
let initializing = true;

function t(key: CopyKey): string {
  return copy[locale][key];
}

function tf(key: CopyKey, values: Record<string, string>): string {
  return t(key).replaceAll(/\{([^}]+)\}/g, (_, name: string) => values[name] ?? `{${name}}`);
}

function agentName(): string {
  return provider()?.name || t('assistant');
}

function applyLocale(): void {
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n as CopyKey | undefined;
    if (key && key in copy[locale]) node.textContent = t(key);
  }
  for (const node of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    const key = node.dataset.i18nPlaceholder as CopyKey | undefined;
    if (key && key in copy[locale]) node.placeholder = t(key);
  }
  input.placeholder = tf('composerPlaceholder', { agent: agentName() });
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const key = node.dataset.i18nTitle as CopyKey | undefined;
    if (key && key in copy[locale]) node.title = t(key);
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = node.dataset.i18nAria as CopyKey | undefined;
    if (key && key in copy[locale]) node.setAttribute('aria-label', t(key));
  }
  languageSelect.value = locale;
  renderAll();
  themeSelectMenu.sync();
  languageSelectMenu.sync();
}

function resolvedTheme(): 'dark' | 'light' {
  if (themeSetting !== 'system') return themeSetting;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(): void {
  document.documentElement.dataset.theme = resolvedTheme();
  themeSelect.value = themeSetting;
  themeSelectMenu.sync();
}

async function request(message: SidePanelRequest): Promise<SidePanelSuccessResponse> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.success) throw new Error(response?.error || 'PaneRelay request failed');
  return response as SidePanelSuccessResponse;
}

function setError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error || '');
  errorMessage.textContent = message;
  errorBanner.hidden = !message;
}

function provider(): AgentProviderSummary | undefined {
  return providers.find(item => item.id === currentProviderId);
}

function renderConnection(): void {
  const bridgeConnected = extensionStatus?.bridgeConnected ?? false;
  const currentProvider = provider();
  if (!bridgeConnected) {
    connectionLabel.textContent = t('bridgeDisconnected');
    statusDot.dataset.state = 'error';
  } else if (currentProvider?.status === 'unavailable' || currentProvider?.status === 'error') {
    connectionLabel.textContent = tf('providerUnavailable', {
      agent: currentProvider.name,
    });
    statusDot.dataset.state = 'error';
  } else if (currentProvider?.status === 'ready') {
    connectionLabel.textContent = t('connected');
    statusDot.dataset.state = 'ready';
  } else {
    connectionLabel.textContent = t('connecting');
    statusDot.dataset.state = 'idle';
  }

  providerSelect.replaceChildren();
  for (const item of providers) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} · ${t(
      item.status === 'ready' ? 'providerReady' : 'providerNotInstalled',
    )}`;
    option.title = item.setupHint || item.setup?.installCommand || item.description;
    providerSelect.append(option);
  }
  providerSelect.value = providers.some(item => item.id === currentProviderId)
    ? currentProviderId
    : 'codex';
  providerSelect.disabled = initializing;
  newConversationButton.disabled =
    initializing || !bridgeConnected || currentProvider?.status !== 'ready';
  providerSelectMenu.sync();
  providerTrigger.setAttribute(
    'aria-label',
    `${t('agentProvider')}: ${providerLabel.textContent}, ${connectionLabel.textContent}`,
  );
}

function renderConversations(): void {
  conversationSelect.replaceChildren();
  const fresh = document.createElement('option');
  fresh.value = '';
  fresh.textContent = t('newConversation');
  conversationSelect.append(fresh);
  for (const conversation of conversations) {
    const option = document.createElement('option');
    option.value = conversation.id;
    option.textContent = conversation.title;
    conversationSelect.append(option);
  }
  conversationSelect.value = currentConversation?.id || '';
  conversationSelect.disabled =
    initializing || loadingConversation || provider()?.status !== 'ready';
  const state = loadingConversation
    ? t('loadingConversation')
    : runningTurnId
      ? t('running')
      : currentConversation?.status === 'waiting'
        ? t('waiting')
        : '';
  conversationState.textContent = state;
  conversationState.dataset.state = loadingConversation
    ? 'loading'
    : runningTurnId
      ? 'running'
      : currentConversation?.status === 'waiting'
        ? 'waiting'
        : 'idle';
  conversationState.title = state;
  conversationSelectMenu.sync();
}

function renderAuthorization(): void {
  const status = extensionStatus;
  const mode = status?.authorizationMode ?? 'none';
  for (const button of scopeButtons) {
    button.dataset.active = String(button.dataset.scope === mode);
    button.disabled = !status;
  }
  releaseButton.hidden = mode === 'none' && !status?.controlledTab;

  if ((status?.controlledTabs.length ?? 0) > 1) {
    scopeTarget.textContent = t('controllingTabs').replace(
      '{count}',
      String(status?.controlledTabs.length),
    );
  } else if (status?.controlledTab) {
    scopeTarget.textContent = `${t('controlling')}: ${status.controlledTab.title}`;
  } else if (mode === 'single-tab' && status?.authorizedTab) {
    scopeTarget.textContent = `${t('authorized')}: ${status.authorizedTab.title}`;
  } else if (mode === 'all-tabs') {
    scopeTarget.textContent = t('allTabsEligible');
  } else {
    scopeTarget.textContent = t('noTabAuthorized');
  }
  const accessLabel = `${t('browserAccess')}: ${scopeTarget.textContent}`;
  accessToggle.dataset.authorized = String(mode !== 'none');
  accessToggle.dataset.controlled = String(Boolean(status?.controlledTab));
  accessToggle.title = accessLabel;
  accessToggle.setAttribute('aria-label', accessLabel);
  scopeHelp.textContent =
    mode === 'single-tab'
      ? t('scopeHelpSingle')
      : mode === 'all-tabs'
        ? t('scopeHelpAll')
        : t('scopeHelpNone');
}

function controlStateText(state: ControlSessionState): string {
  switch (state) {
    case 'allocated':
      return t('controlAllocated');
    case 'connected':
      return t('controlConnected');
    case 'active':
      return t('controlActive');
    case 'released':
      return t('controlReleased');
    case 'expired':
      return t('controlExpired');
    case 'failed':
      return t('controlFailed');
  }
}

function automationCategoryText(category: AutomationActivityCategory): string {
  switch (category) {
    case 'target':
      return t('categoryTarget');
    case 'navigation':
      return t('categoryNavigation');
    case 'interaction':
      return t('categoryInteraction');
    case 'page-content':
      return t('categoryPageContent');
    case 'browser-state':
      return t('categoryBrowserState');
    case 'network':
      return t('categoryNetwork');
    case 'emulation':
      return t('categoryEmulation');
    case 'artifact':
      return t('categoryArtifact');
    case 'other':
      return t('categoryOther');
  }
}

function automationLabelText(label: AutomationActivityLabel): string {
  switch (label) {
    case 'manage-target':
      return t('labelManageTarget');
    case 'navigate-page':
      return t('labelNavigatePage');
    case 'interact-with-page':
      return t('labelInteractWithPage');
    case 'read-page':
      return t('labelReadPage');
    case 'manage-browser-state':
      return t('labelManageBrowserState');
    case 'inspect-network':
      return t('labelInspectNetwork');
    case 'emulate-page':
      return t('labelEmulatePage');
    case 'create-artifact':
      return t('labelCreateArtifact');
    case 'run-browser-operation':
      return t('labelRunBrowserOperation');
  }
}

function automationStatusText(status: AutomationActivityStatus): string {
  switch (status) {
    case 'started':
      return t('automationStarted');
    case 'completed':
      return t('automationCompleted');
    case 'failed':
      return t('automationFailed');
    case 'denied':
      return t('automationDenied');
  }
}

function renderExternalControl(): void {
  const status = extensionStatus;
  const session = status?.controlSession ?? null;
  const activities = status?.automationActivities ?? [];
  externalControl.hidden = !session && activities.length === 0;
  if (externalControl.hidden) return;

  controlActor.textContent = session
    ? [session.actor.name, session.actor.sessionLabel].filter(Boolean).join(' · ')
    : t('externalControl');
  const metadata = session
    ? [
        controlStateText(session.state),
        t('controlTargets').replace('{count}', String(session.controlledTargetCount)),
        ...(session.heartbeatFreshness === 'fresh' ? [t('heartbeatLive')] : []),
      ]
    : [];
  controlMeta.textContent = metadata.join(' · ');
  controlGap.hidden = !status?.automationHistoryGap;
  controlReleaseButton.hidden =
    !status?.bridgeConnected ||
    !session ||
    session.state === 'released' ||
    session.state === 'expired' ||
    session.state === 'failed';

  externalActivities.replaceChildren();
  for (const activity of activities.slice(-5).reverse()) {
    const item = document.createElement('li');
    item.dataset.status = activity.status;
    const mark = document.createElement('span');
    mark.className = 'external-activity-mark';
    mark.setAttribute('aria-hidden', 'true');
    const content = document.createElement('span');
    content.className = 'external-activity-copy';
    content.append(textNode('strong', '', automationLabelText(activity.label)));
    content.append(
      textNode(
        'small',
        '',
        `${automationCategoryText(activity.category)} · ${automationStatusText(activity.status)}`,
      ),
    );
    const time = document.createElement('time');
    time.dateTime = activity.updatedAt;
    time.textContent = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(activity.updatedAt));
    item.append(mark, content, time);
    externalActivities.append(item);
  }
  externalActivities.hidden = activities.length === 0;
}

function renderEmptyState(): void {
  const bridgeConnected = extensionStatus?.bridgeConnected ?? false;
  const currentProvider = provider();
  const providerReady = currentProvider?.status === 'ready';
  const setup = currentProvider?.setup;
  const setupVisible = bridgeConnected && !providerReady && Boolean(setup);
  providerSetup.hidden = !setupVisible;
  providerInstallRow.hidden = !setup?.installCommand;
  providerInstall.textContent = setup?.installCommand || '';
  providerLoginRow.hidden = !setup?.loginCommand;
  providerLogin.textContent = setup?.loginCommand || '';
  const docsUrl = setup?.docsUrl?.startsWith('https://') ? setup.docsUrl : '';
  providerDocs.hidden = !docsUrl;
  if (docsUrl) providerDocs.href = docsUrl;
  else providerDocs.removeAttribute('href');
  if (!bridgeConnected) {
    emptyTitle.textContent = t('emptyBridgeTitle');
    emptyBody.textContent = extensionStatus?.error || t('emptyBridgeBody');
  } else if (!providerReady) {
    emptyTitle.textContent = tf('emptyProviderTitle', { agent: agentName() });
    emptyBody.textContent = currentProvider
      ? t(currentProvider.id === 'qoder' ? 'qoderSetupBody' : 'codexSetupBody')
      : t('emptyProviderBody');
  } else {
    emptyTitle.textContent = tf('emptyTitle', { agent: agentName() });
    emptyBody.textContent = t('emptyBody');
  }
  input.placeholder = tf('composerPlaceholder', { agent: agentName() });
  suggestions.hidden = !providerReady;
}

function textNode(tag: keyof HTMLElementTagNameMap, className: string, value: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

function iconNode(icon: IconNode, className: string): SVGElement {
  return createLucideElement(icon, {
    'aria-hidden': 'true',
    class: className,
  });
}

const INLINE_MARKDOWN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function appendInlineText(parent: HTMLElement, value: string): void {
  let offset = 0;
  for (const match of value.matchAll(INLINE_MARKDOWN)) {
    const index = match.index ?? 0;
    if (index > offset) parent.append(document.createTextNode(value.slice(offset, index)));
    const token = match[0];
    if (token.startsWith('`')) {
      parent.append(textNode('code', '', token.slice(1, -1)));
    } else if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else if (token.startsWith('*')) {
      const emphasis = document.createElement('em');
      emphasis.textContent = token.slice(1, -1);
      parent.append(emphasis);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (link) {
        const anchor = document.createElement('a');
        anchor.textContent = link[1]!;
        anchor.href = link[2]!;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        parent.append(anchor);
      } else {
        parent.append(document.createTextNode(token));
      }
    }
    offset = index + token.length;
  }
  if (offset < value.length) parent.append(document.createTextNode(value.slice(offset)));
}

function appendInlineLines(parent: HTMLElement, value: string): void {
  value.split('\n').forEach((line, index) => {
    if (index > 0) parent.append(document.createElement('br'));
    appendInlineText(parent, line);
  });
}

function markdownBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^#{1,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line) ||
    /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
  );
}

function richText(value: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'rich-text';
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index]!)) {
        codeLines.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      if (fence[1]) code.dataset.language = fence[1];
      pre.append(code);
      root.append(pre);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const tag = `h${heading[1]!.length}` as 'h1' | 'h2' | 'h3';
      const node = document.createElement(tag);
      appendInlineText(node, heading[2]!);
      root.append(node);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!)) {
        quoteLines.push(lines[index]!.replace(/^>\s?/, ''));
        index += 1;
      }
      const quote = document.createElement('blockquote');
      appendInlineLines(quote, quoteLines.join('\n'));
      root.append(quote);
      continue;
    }

    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]!);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const item = lines[index]!.match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!item) break;
        const listItem = document.createElement('li');
        appendInlineText(listItem, item[1]!);
        list.append(listItem);
        index += 1;
      }
      root.append(list);
      continue;
    }

    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      root.append(document.createElement('hr'));
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index]!.trim() && !markdownBlockStart(lines[index]!)) {
      paragraphLines.push(lines[index]!);
      index += 1;
    }
    const paragraph = document.createElement('p');
    appendInlineLines(paragraph, paragraphLines.join('\n'));
    root.append(paragraph);
  }

  return root;
}

function messageTime(value: string): HTMLTimeElement {
  const date = new Date(value);
  const time = document.createElement('time');
  time.className = 'message-time';
  if (!Number.isNaN(date.getTime())) {
    time.dateTime = date.toISOString();
    time.title = date.toLocaleString(locale);
    time.textContent = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return time;
}

function renderMessage(item: Extract<TimelineItem, { type: 'message' }>): HTMLElement {
  const node = document.createElement('article');
  node.className = `message ${item.message.role}`;
  node.dataset.streaming = String(Boolean(item.streaming));

  const shell = document.createElement('div');
  shell.className = 'message-shell';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.append(richText(item.message.text));

  if (item.message.role === 'assistant') {
    node.append(iconNode(Bot, 'message-avatar'));
    const heading = document.createElement('div');
    heading.className = 'message-heading';
    heading.append(textNode('span', '', provider()?.name || t('assistant')));
    heading.append(messageTime(item.message.createdAt));
    shell.append(heading, bubble);
    node.append(shell);
  } else {
    node.append(messageTime(item.message.createdAt));
    shell.append(bubble);
    node.append(shell);
  }
  return node;
}

function renderReasoning(item: Extract<TimelineItem, { type: 'reasoning' }>): HTMLElement {
  const node = document.createElement('details');
  node.className = 'reasoning-card';
  const summary = document.createElement('summary');
  summary.append(
    iconNode(ChevronRight, 'reasoning-chevron'),
    textNode('span', 'reasoning-title', t('thinking')),
    textNode('span', 'reasoning-preview', item.text.replace(/\s+/g, ' ').trim()),
  );
  node.append(summary);
  node.append(textNode('p', 'reasoning-content', item.text));
  return node;
}

function activityStatus(activity: ConversationActivity): string {
  switch (activity.status) {
    case 'running':
      return t('activityRunning');
    case 'completed':
      return t('activityCompleted');
    case 'failed':
      return t('activityFailed');
    case 'declined':
      return t('activityDeclined');
  }
}

function activityIcon(activity: ConversationActivity): IconNode {
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

function renderActivity(item: Extract<TimelineItem, { type: 'activity' }>): HTMLElement {
  const node = document.createElement('article');
  node.className = 'activity-card';
  node.dataset.status = item.activity.status;
  node.append(iconNode(activityIcon(item.activity), 'activity-icon'));
  const copyNode = document.createElement('div');
  copyNode.className = 'activity-copy';
  copyNode.append(textNode('div', 'activity-title', item.activity.title));
  if (item.activity.detail) {
    copyNode.append(textNode('div', 'activity-detail', item.activity.detail));
  }
  node.append(copyNode);
  node.append(textNode('span', 'activity-status', activityStatus(item.activity)));
  return node;
}

function approvalButton(
  label: string,
  decision: ConversationApprovalDecision,
  approval: ConversationApproval,
  primary = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (primary) button.className = 'approve';
  button.addEventListener('click', () => {
    void respondToApproval(approval, decision);
  });
  return button;
}

function renderApproval(item: Extract<TimelineItem, { type: 'approval' }>): HTMLElement {
  const node = document.createElement('article');
  node.className = 'approval-card';

  const body = document.createElement('div');
  body.className = 'approval-body';
  const heading = document.createElement('div');
  heading.className = 'approval-heading';
  heading.append(iconNode(ShieldQuestion, 'approval-icon'));
  const headingCopy = document.createElement('div');
  headingCopy.append(textNode('p', 'approval-kicker', t('approval')));
  headingCopy.append(textNode('h3', '', item.approval.title));
  if (item.approval.description) {
    headingCopy.append(textNode('p', '', item.approval.description));
  }
  heading.append(headingCopy);
  body.append(heading);
  if (item.approval.command) {
    body.append(textNode('pre', 'approval-code', item.approval.command));
  }
  if (item.approval.cwd) {
    const context = document.createElement('div');
    context.className = 'approval-context';
    context.append(
      textNode('span', '', t('workingDirectory')),
      textNode('code', '', item.approval.cwd),
    );
    body.append(context);
  }
  node.append(body);

  const actions = document.createElement('div');
  actions.className = 'approval-actions';
  if (item.approval.decisions.includes('accept')) {
    actions.append(approvalButton(t('allowOnce'), 'accept', item.approval, true));
  }
  if (item.approval.decisions.includes('acceptForSession')) {
    actions.append(approvalButton(t('allowSession'), 'acceptForSession', item.approval));
  }
  if (item.approval.decisions.includes('decline')) {
    actions.append(approvalButton(t('deny'), 'decline', item.approval));
  }
  if (item.approval.decisions.includes('declineForSession')) {
    actions.append(approvalButton(t('denySession'), 'declineForSession', item.approval));
  }
  if (item.approval.decisions.includes('cancel')) {
    actions.append(approvalButton(t('cancelApproval'), 'cancel', item.approval));
  }
  node.append(actions);
  return node;
}

function renderTimeline(): void {
  timelineElement.replaceChildren();
  loadingState.hidden = !initializing;
  emptyState.hidden = initializing || timeline.length > 0;
  timelineElement.hidden = timeline.length === 0;
  for (const item of timeline) {
    if (item.type === 'message') timelineElement.append(renderMessage(item));
    if (item.type === 'reasoning') timelineElement.append(renderReasoning(item));
    if (item.type === 'activity') timelineElement.append(renderActivity(item));
    if (item.type === 'approval') timelineElement.append(renderApproval(item));
    if (item.type === 'error') {
      const error = document.createElement('article');
      error.className = 'timeline-error';
      error.append(iconNode(CircleAlert, 'timeline-error-icon'));
      const errorCopy = document.createElement('div');
      errorCopy.className = 'timeline-error-copy';
      errorCopy.append(textNode('strong', '', t('errorTitle')));
      errorCopy.append(textNode('span', '', item.message));
      error.append(errorCopy);
      timelineElement.append(error);
    }
  }
}

function renderComposer(): void {
  const ready = extensionStatus?.bridgeConnected && provider()?.status === 'ready';
  input.disabled = initializing || !ready || submitting;
  sendButton.disabled = initializing || !ready || submitting || input.value.trim().length === 0;
  stopButton.hidden = !runningTurnId;
  sendButton.hidden = Boolean(runningTurnId);
}

function renderAll(): void {
  renderConnection();
  renderConversations();
  renderAuthorization();
  renderExternalControl();
  renderEmptyState();
  renderTimeline();
  renderComposer();
}

function scrollToBottom(force = false): void {
  const distance = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
  if (force || distance < 120) chatScroll.scrollTop = chatScroll.scrollHeight;
}

function addOrUpdateMessage(event: Extract<ConversationEvent, { kind: 'message.delta' }>): void {
  const existing = timeline.find(
    item => item.type === 'message' && item.message.id === event.messageId,
  );
  if (existing?.type === 'message') {
    existing.message.text += event.delta;
    existing.streaming = true;
    return;
  }
  timeline.push({
    type: 'message',
    streaming: true,
    message: {
      id: event.messageId,
      role: 'assistant',
      text: event.delta,
      ...(event.phase ? { phase: event.phase } : {}),
      createdAt: new Date().toISOString(),
    },
  });
}

function completeMessage(message: ConversationMessage): void {
  const existing = timeline.find(item => item.type === 'message' && item.message.id === message.id);
  if (existing?.type === 'message') {
    existing.message = message;
    existing.streaming = false;
  } else {
    timeline.push({ type: 'message', message });
  }
}

function handleConversationEvent(event: ConversationEvent): void {
  if ('conversationId' in event && event.conversationId !== currentConversation?.id) return;
  switch (event.kind) {
    case 'turn.started':
      runningTurnId = event.turnId;
      break;
    case 'message.delta':
      addOrUpdateMessage(event);
      break;
    case 'message.completed':
      completeMessage(event.message);
      break;
    case 'reasoning.delta': {
      const existing = timeline.find(item => item.type === 'reasoning' && item.id === event.itemId);
      if (existing?.type === 'reasoning') existing.text += event.delta;
      else timeline.push({ type: 'reasoning', id: event.itemId, text: event.delta });
      break;
    }
    case 'activity.updated': {
      const existing = timeline.find(
        item => item.type === 'activity' && item.activity.id === event.activity.id,
      );
      if (existing?.type === 'activity') existing.activity = event.activity;
      else timeline.push({ type: 'activity', activity: event.activity });
      break;
    }
    case 'approval.requested':
      timeline.push({ type: 'approval', approval: event.approval });
      if (currentConversation) currentConversation.status = 'waiting';
      break;
    case 'approval.resolved':
      timeline = timeline.filter(
        item => item.type !== 'approval' || item.approval.id !== event.approvalId,
      );
      break;
    case 'turn.completed':
      runningTurnId = null;
      if (currentConversation)
        currentConversation.status = event.status === 'failed' ? 'error' : 'idle';
      if (event.status === 'interrupted') {
        timeline.push({ type: 'error', id: crypto.randomUUID(), message: t('interrupted') });
      }
      if (event.status === 'failed') {
        timeline.push({
          type: 'error',
          id: crypto.randomUUID(),
          message: event.error || t('failed'),
        });
      }
      void refreshConversations(false);
      break;
    case 'usage.updated':
      break;
    case 'error':
      timeline.push({ type: 'error', id: crypto.randomUUID(), message: event.message });
      break;
  }
  renderAll();
  scrollToBottom();
}

async function loadConversation(detail: ConversationDetail): Promise<void> {
  currentConversation = detail.conversation;
  timeline = detail.messages.map(message => ({ type: 'message', message }));
  runningTurnId = detail.conversation.status === 'running' ? runningTurnId : null;
  setError('');
  renderAll();
  scrollToBottom(true);
}

async function refreshConversations(selectFirst = true): Promise<void> {
  if (provider()?.status !== 'ready') return;
  const response = await request({
    type: 'panerelay.conversation.list',
    providerId: currentProviderId,
  });
  conversations = response.conversations ?? [];
  renderConversations();
  if (selectFirst && !currentConversation && conversations[0]) {
    await resumeConversation(conversations[0].id);
  }
}

async function startConversation(): Promise<ConversationDetail> {
  loadingConversation = true;
  renderAll();
  try {
    const response = await request({
      type: 'panerelay.conversation.start',
      providerId: currentProviderId,
    });
    if (!response.conversation) throw new Error('PaneRelay did not create a conversation');
    conversations = [
      response.conversation.conversation,
      ...conversations.filter(item => item.id !== response.conversation?.conversation.id),
    ];
    await loadConversation(response.conversation);
    return response.conversation;
  } finally {
    loadingConversation = false;
    renderAll();
  }
}

async function resumeConversation(conversationId: string): Promise<void> {
  loadingConversation = true;
  renderAll();
  try {
    const response = await request({
      type: 'panerelay.conversation.resume',
      providerId:
        conversations.find(conversation => conversation.id === conversationId)?.providerId ??
        currentProviderId,
      conversationId,
    });
    if (!response.conversation) throw new Error('PaneRelay did not load the conversation');
    await loadConversation(response.conversation);
  } finally {
    loadingConversation = false;
    renderAll();
  }
}

async function ensureConversation(): Promise<ConversationSummary> {
  if (currentConversation) return currentConversation;
  return (await startConversation()).conversation;
}

async function sendMessage(text: string): Promise<void> {
  const message = text.trim();
  if (!message || submitting) return;
  submitting = true;
  setError('');
  renderComposer();
  try {
    const conversation = await ensureConversation();
    timeline.push({
      type: 'message',
      message: {
        id: crypto.randomUUID(),
        role: 'user',
        text: message,
        createdAt: new Date().toISOString(),
      },
    });
    input.value = '';
    resizeInput();
    renderAll();
    scrollToBottom(true);
    const response = await request({
      type: 'panerelay.conversation.send',
      providerId: conversationProviderId(conversation, currentProviderId),
      conversationId: conversation.id,
      text: message,
    });
    if (response.turnId) runningTurnId = response.turnId;
  } catch (error) {
    setError(error);
  } finally {
    submitting = false;
    renderAll();
  }
}

async function respondToApproval(
  approval: ConversationApproval,
  decision: ConversationApprovalDecision,
): Promise<void> {
  try {
    await request({
      type: 'panerelay.conversation.respond',
      providerId: conversationProviderId(currentConversation, currentProviderId),
      conversationId: approval.conversationId,
      approvalId: approval.id,
      decision,
    });
    timeline = timeline.filter(
      item => item.type !== 'approval' || item.approval.id !== approval.id,
    );
    renderAll();
  } catch (error) {
    setError(error);
  }
}

async function setAuthorization(mode: AuthorizationMode): Promise<void> {
  try {
    if (mode === 'all-tabs') {
      const granted = await chrome.permissions.request({
        origins: [...ALL_WEB_ORIGIN_PATTERNS],
      });
      if (!granted) throw new Error(t('chromeAccessDeniedAll'));
    } else if (mode === 'single-tab') {
      const authorization = originAuthorizationForUrl(extensionStatus?.activeTab?.url || '');
      if (!authorization) {
        throw new Error(t('unsupportedBrowserPage'));
      }
      const granted = await chrome.permissions.request({
        origins: [authorization.permissionPattern],
      });
      if (!granted) throw new Error(`${t('chromeAccessDeniedSite')}: ${authorization.origin}`);
    }
    const response = await request({ type: 'panerelay.authorization.set', mode });
    if (response.status) extensionStatus = response.status;
    setError('');
    renderAll();
  } catch (error) {
    setError(error);
  }
}

function resizeInput(): void {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
  renderComposer();
}

async function initialize(): Promise<void> {
  initializing = true;
  let providerDiscoveryCompleted = false;
  setError('');
  renderAll();
  try {
    const stored = await chrome.storage.local.get([LOCALE_KEY, PROVIDER_KEY, THEME_KEY]);
    if (stored[LOCALE_KEY] === 'en' || stored[LOCALE_KEY] === 'zh-CN') {
      locale = stored[LOCALE_KEY];
    }
    if (
      stored[THEME_KEY] === 'system' ||
      stored[THEME_KEY] === 'dark' ||
      stored[THEME_KEY] === 'light'
    ) {
      themeSetting = stored[THEME_KEY];
    }
    applyTheme();
    applyLocale();

    const statusResponse = await request({ type: 'panerelay.status.get' });
    extensionStatus = statusResponse.status ?? null;
    if (!extensionStatus?.bridgeConnected) {
      providers = supportedProviders([]);
      currentProviderId = selectProviderId(
        providers,
        typeof stored[PROVIDER_KEY] === 'string' ? stored[PROVIDER_KEY] : currentProviderId,
      );
      return;
    }
    const providerResponse = await request({ type: 'panerelay.agent.providers' });
    providers = supportedProviders(providerResponse.providers ?? []);
    providerDiscoveryCompleted = true;
    currentProviderId = selectProviderId(
      providers,
      typeof stored[PROVIDER_KEY] === 'string' ? stored[PROVIDER_KEY] : currentProviderId,
    );
    const selectedReady = provider()?.status === 'ready';
    renderAll();
    if (selectedReady) await refreshConversations(!currentConversation);
  } catch (error) {
    providers = supportedProviders(providerDiscoveryCompleted ? providers : []);
    currentProviderId = selectProviderId(providers, currentProviderId);
    setError(error);
  } finally {
    initializing = false;
    renderAll();
  }
}

function closeSettings(): void {
  themeSelectMenu.close();
  languageSelectMenu.close();
  settings.hidden = true;
  accessToggle.setAttribute('aria-expanded', 'false');
}

settingsClose.addEventListener('click', closeSettings);
accessToggle.addEventListener('click', () => {
  settings.hidden = false;
  accessToggle.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    browserScope.scrollIntoView({ block: 'nearest' });
    const activeButton =
      scopeButtons.find(button => button.dataset.active === 'true') ?? scopeButtons[0];
    activeButton?.focus();
  });
});
document.addEventListener('pointerdown', event => {
  if (
    !settings.hidden &&
    !settings.contains(event.target as Node) &&
    !accessToggle.contains(event.target as Node)
  ) {
    settings.hidden = true;
    accessToggle.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if (event.key === 'Escape') {
    closeSettings();
  }
});
themeSelect.addEventListener('change', () => {
  themeSetting = themeSelect.value as ThemeSetting;
  applyTheme();
  void chrome.storage.local.set({ [THEME_KEY]: themeSetting });
});
languageSelect.addEventListener('change', () => {
  locale = languageSelect.value as Locale;
  applyLocale();
  void chrome.storage.local.set({ [LOCALE_KEY]: locale });
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (themeSetting === 'system') applyTheme();
});

errorRetryButton.addEventListener('click', () => {
  void initialize();
});
errorDismissButton.addEventListener('click', () => {
  setError('');
});

newConversationButton.addEventListener('click', () => {
  void startConversation().catch(setError);
});
conversationSelect.addEventListener('change', () => {
  if (!conversationSelect.value) {
    currentConversation = null;
    runningTurnId = null;
    timeline = [];
    renderAll();
    return;
  }
  void resumeConversation(conversationSelect.value).catch(setError);
});
providerSelect.addEventListener('change', () => {
  currentProviderId = providerSelect.value;
  void chrome.storage.local.set({ [PROVIDER_KEY]: currentProviderId });
  currentConversation = null;
  conversations = [];
  timeline = [];
  runningTurnId = null;
  renderAll();
  void refreshConversations(true).catch(setError);
});

for (const button of scopeButtons) {
  button.addEventListener('click', () => {
    void setAuthorization(button.dataset.scope as AuthorizationMode);
  });
}
releaseButton.addEventListener('click', () => {
  void setAuthorization('none');
});
controlReleaseButton.addEventListener('click', () => {
  void setAuthorization('none');
});

composer.addEventListener('submit', event => {
  event.preventDefault();
  void sendMessage(input.value);
});
input.addEventListener('input', resizeInput);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendMessage(input.value);
  }
});
stopButton.addEventListener('click', () => {
  if (!currentConversation || !runningTurnId) return;
  void request({
    type: 'panerelay.conversation.interrupt',
    providerId: conversationProviderId(currentConversation, currentProviderId),
    conversationId: currentConversation.id,
    turnId: runningTurnId,
  }).catch(setError);
});
for (const button of suggestionButtons) {
  button.addEventListener('click', () => {
    const suggestion = button.dataset.suggestion;
    input.value =
      suggestion === 'summarize'
        ? t('suggestSummarizePrompt')
        : suggestion === 'inspect'
          ? t('suggestInspectPrompt')
          : t('suggestFindPrompt');
    resizeInput();
    input.focus();
  });
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const statusMessage = message as Partial<StatusChangedMessage>;
  if (statusMessage.type === 'panerelay.status.changed' && statusMessage.status) {
    const wasConnected = extensionStatus?.bridgeConnected ?? false;
    extensionStatus = statusMessage.status;
    if (statusMessage.status.error) setError(statusMessage.status.error);
    else if (statusMessage.status.bridgeConnected) setError('');
    renderAll();
    if (!wasConnected && statusMessage.status.bridgeConnected) void initialize();
    return;
  }
  const conversationMessage = message as Partial<ConversationChangedMessage>;
  if (conversationMessage.type === 'panerelay.conversation.event' && conversationMessage.event) {
    handleConversationEvent(conversationMessage.event);
  }
});

void initialize();
