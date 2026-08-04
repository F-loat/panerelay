import type {
  ConversationActivity,
  ConversationApproval,
  ConversationApprovalDecision,
} from '@panerelay/protocol';
import {
  Bot,
  ChevronRight,
  CircleAlert,
  FilePenLine,
  ListCollapse,
  PanelTop,
  ScanSearch,
  Search,
  ShieldQuestion,
  Sparkles,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import {
  selectedAgentName,
  type SidepanelController,
  type SidepanelState,
} from '../sidepanel-controller.js';
import { translate, type CopyKey, type Locale } from '../i18n.js';
import { isPanerelaySetupFailure } from '../setup-guidance.js';
import { AuthorizationPanel } from './access-settings.js';
import {
  PanerelaySetupGuide,
  type SetupIntegration,
  type SetupIntegrationSelection,
} from './setup-guide.js';
import { useCopy } from './presentation.js';

const INLINE_MARKDOWN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function inlineText(value: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let offset = 0;
  let sequence = 0;
  for (const match of value.matchAll(INLINE_MARKDOWN)) {
    const index = match.index ?? 0;
    if (index > offset) nodes.push(value.slice(offset, index));
    const token = match[0];
    const key = `${keyPrefix}-${sequence++}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      nodes.push(
        link ? (
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    }
    offset = index + token.length;
  }
  if (offset < value.length) nodes.push(value.slice(offset));
  return nodes;
}

type TableAlignment = 'center' | 'left' | 'right';

function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  const leadingPipe = trimmed.startsWith('|');
  const trailingPipe = trimmed.endsWith('|') && !trimmed.endsWith('\\|');
  const value = trimmed.slice(leadingPipe ? 1 : 0, trailingPipe ? -1 : undefined);
  const cells: string[] = [];
  let cell = '';
  let inCode = false;
  let structuralPipes = leadingPipe || trailingPipe ? 1 : 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    const next = value[index + 1];
    if (character === '\\' && next === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (character === '`') {
      inCode = !inCode;
      cell += character;
      continue;
    }
    if (character === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
      structuralPipes += 1;
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return structuralPipes > 0 ? cells : null;
}

function tableAlignments(line: string, columns: number): TableAlignment[] | null {
  const cells = splitTableRow(line);
  if (!cells || cells.length !== columns) return null;
  const alignments: TableAlignment[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    alignments.push(
      cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left',
    );
  }
  return alignments;
}

function tableStart(
  lines: readonly string[],
  index: number,
): { alignments: TableAlignment[]; header: string[] } | null {
  const header = splitTableRow(lines[index] ?? '');
  if (!header || header.length === 0) return null;
  const alignments = tableAlignments(lines[index + 1] ?? '', header.length);
  return alignments ? { alignments, header } : null;
}

function normalizedTableRow(line: string, columns: number): string[] | null {
  const cells = splitTableRow(line);
  if (!cells) return null;
  if (cells.length < columns) return [...cells, ...Array(columns - cells.length).fill('')];
  if (cells.length === columns) return cells;
  return [...cells.slice(0, columns - 1), cells.slice(columns - 1).join(' | ')];
}

function RichText({ value }: { value: string }) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;
  const blockStart = (line: string) =>
    /^ {0,3}```|^#{1,3}\s+|^>\s?|^[-*+]\s+|^\d+[.)]\s+|^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(
      line,
    );

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const key = `block-${index}`;
    const compactFence = line.match(/^ {0,3}```([\w+-]*)[ \t]+(.+?)[ \t]+```\s*(.*)$/);
    if (compactFence) {
      nodes.push(
        <pre key={key}>
          <code data-language={compactFence[1] || undefined}>{compactFence[2]}</code>
        </pre>,
      );
      if (compactFence[3]) {
        nodes.push(<p key={`${key}-trailing`}>{inlineText(compactFence[3], `${key}-trailing`)}</p>);
      }
      index += 1;
      continue;
    }
    const fence = line.match(/^ {0,3}```([\w+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^ {0,3}```\s*$/.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(
        <pre key={key}>
          <code data-language={fence[1] || undefined}>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    const table = tableStart(lines, index);
    if (table) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index]?.trim()) {
        const row = normalizedTableRow(lines[index] ?? '', table.header.length);
        if (!row) break;
        rows.push(row);
        index += 1;
      }
      nodes.push(
        <div className="rich-table-scroll" key={key}>
          <table>
            <thead>
              <tr>
                {table.header.map((cell, column) => (
                  <th
                    data-align={table.alignments[column]}
                    key={`${key}-header-${column}`}
                    scope="col"
                  >
                    {inlineText(cell, `${key}-header-${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            {rows.length > 0 && (
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${key}-row-${rowIndex}`}>
                    {row.map((cell, column) => (
                      <td
                        data-align={table.alignments[column]}
                        key={`${key}-row-${rowIndex}-${column}`}
                      >
                        {inlineText(cell, `${key}-row-${rowIndex}-${column}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = inlineText(heading[2] ?? '', key);
      nodes.push(
        heading[1]?.length === 1 ? (
          <h1 key={key}>{content}</h1>
        ) : heading[1]?.length === 2 ? (
          <h2 key={key}>{content}</h2>
        ) : (
          <h3 key={key}>{content}</h3>
        ),
      );
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      nodes.push(<blockquote key={key}>{inlineText(quote.join('\n'), key)}</blockquote>);
      continue;
    }
    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1] ?? '');
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(<li key={`${key}-${index}`}>{inlineText(item[1] ?? '', `${key}-${index}`)}</li>);
        index += 1;
      }
      nodes.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      continue;
    }
    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push(<hr key={key} />);
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !blockStart(lines[index] ?? '') &&
      !tableStart(lines, index)
    ) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    nodes.push(<p key={key}>{inlineText(paragraph.join('\n'), key)}</p>);
  }
  return <div className="rich-text">{nodes}</div>;
}

function MessageTime({ locale, value }: { locale: Locale; value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <time className="message-time" />;
  return (
    <time
      className="message-time"
      dateTime={date.toISOString()}
      title={date.toLocaleString(locale)}
    >
      {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

function activityStatus(locale: Locale, activity: ConversationActivity): string {
  const keys: Record<ConversationActivity['status'], CopyKey> = {
    running: 'activityRunning',
    completed: 'activityCompleted',
    failed: 'activityFailed',
    declined: 'activityDeclined',
  };
  return translate(locale, keys[activity.status]);
}

function activityTitle(title: string): string {
  return title.replace(/^panerelay_browser(?=\s*(?:·|$))/, 'panerelay');
}

function activityIcon(activity: ConversationActivity): LucideIcon {
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

function errorPresentation(message: string): { advice: CopyKey; type: CopyKey } {
  const normalized = message.toLocaleLowerCase();
  if (/timed out|timeout/.test(normalized)) {
    return { advice: 'errorAdviceTimeout', type: 'errorTypeTimeout' };
  }
  if (/disconnect|connection|closed|exited|ended|unavailable/.test(normalized)) {
    return { advice: 'errorAdviceConnection', type: 'errorTypeConnection' };
  }
  return { advice: 'errorAdviceGeneral', type: 'errorTypeGeneral' };
}

function reasoningStatusText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const maximum = 240;
  return normalized.length > maximum ? `…${normalized.slice(-maximum)}` : normalized;
}

function TurnFeedback({ state }: { state: SidepanelState }) {
  const { t, tf } = useCopy(state);
  const providerName = selectedAgentName(state);
  const starting = state.turnFeedback === 'starting';
  const reasoning = starting ? '' : reasoningStatusText(state.activeReasoning?.text ?? '');

  if (!state.turnFeedback) return null;

  return (
    <article aria-live="polite" className="turn-feedback" role="status">
      <Bot aria-hidden="true" className="message-avatar" />
      <div className="turn-feedback-shell">
        <div className="message-heading">{providerName}</div>
        <div className="turn-feedback-bubble">
          <span className="turn-feedback-copy">
            <strong>
              {tf(starting ? 'startingConversation' : 'agentWorking', {
                agent: providerName,
              })}
            </strong>
            <small data-reasoning={reasoning ? 'true' : 'false'}>
              {reasoning || t(starting ? 'startingConversationDetail' : 'agentWorkingDetail')}
            </small>
          </span>
          <span aria-hidden="true" className="turn-feedback-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </article>
  );
}

export function Timeline({
  controller,
  scrollRef,
}: {
  controller: SidepanelController;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const { state } = controller;
  const { t } = useCopy(state);
  const providerName = selectedAgentName(state);
  const followingBottomRef = useRef(true);
  const lastScrollRequestRef = useRef(-1);
  const lastWorkspaceRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const updateFollowingBottom = () => {
      const distance = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
      followingBottomRef.current = distance <= 96;
    };
    updateFollowingBottom();
    scroll.addEventListener('scroll', updateFollowingBottom, { passive: true });
    return () => scroll.removeEventListener('scroll', updateFollowingBottom);
  }, [scrollRef]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const workspaceRevision = state.workspace?.revision ?? null;
    const forceFollow =
      lastScrollRequestRef.current !== state.scrollRequest ||
      lastWorkspaceRevisionRef.current !== workspaceRevision;
    lastScrollRequestRef.current = state.scrollRequest;
    lastWorkspaceRevisionRef.current = workspaceRevision;
    if (forceFollow) followingBottomRef.current = true;
    if (!followingBottomRef.current) return;
    scroll.scrollTop = scroll.scrollHeight;
  }, [
    scrollRef,
    state.scrollRequest,
    state.timeline,
    state.turnFeedback,
    state.workspace?.revision,
  ]);

  return (
    <div className="timeline flex flex-col gap-3 px-3 pt-[15px] pb-5">
      {state.timeline.map(item => {
        if (item.type === 'message') {
          return (
            <article
              className={`message ${item.message.role}`}
              data-streaming={Boolean(item.streaming)}
              key={`message-${item.message.id}`}
            >
              {item.message.role === 'assistant' ? (
                <>
                  <Bot aria-hidden="true" className="message-avatar" />
                  <div className="message-shell">
                    <div className="message-heading">
                      <span>{providerName}</span>
                      <MessageTime locale={state.locale} value={item.message.createdAt} />
                    </div>
                    <div className="message-bubble">
                      <RichText value={item.message.text} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <MessageTime locale={state.locale} value={item.message.createdAt} />
                  <div className="message-shell">
                    <div className="message-bubble">
                      <RichText value={item.message.text} />
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        }
        if (item.type === 'reasoning') {
          if (state.turnFeedback === 'working' && state.activeReasoning?.id === item.id) {
            return null;
          }
          return (
            <details className="reasoning-card" key={`reasoning-${item.id}`}>
              <summary>
                <ChevronRight aria-hidden="true" className="reasoning-chevron" />
                <span className="reasoning-title">{t('thinking')}</span>
                <span className="reasoning-preview">{item.text.replace(/\s+/g, ' ').trim()}</span>
              </summary>
              <p className="reasoning-content">{item.text}</p>
            </details>
          );
        }
        if (item.type === 'activity') {
          const Icon = activityIcon(item.activity);
          const expandable = item.activity.status !== 'running';
          const setupFailure =
            item.activity.status === 'failed' &&
            isPanerelaySetupFailure(
              [item.activity.title, item.activity.detail].filter(Boolean).join('\n'),
            );
          return (
            <div className="activity-stack" key={`activity-${item.activity.id}`}>
              {expandable ? (
                <details
                  className="activity-card activity-card-expandable"
                  data-status={item.activity.status}
                >
                  <summary
                    aria-label={`${t('activityDetails')}: ${activityTitle(item.activity.title)}`}
                    className="activity-card-summary"
                  >
                    <Icon aria-hidden="true" className="activity-icon" />
                    <div className="activity-copy">
                      <div className="activity-title">{activityTitle(item.activity.title)}</div>
                      {item.activity.detail && (
                        <div className="activity-detail">{item.activity.detail}</div>
                      )}
                    </div>
                    <span className="activity-status">
                      {activityStatus(state.locale, item.activity)}
                    </span>
                  </summary>
                  <div className="activity-detail-expanded">
                    <div className="activity-command-expanded">{item.activity.title}</div>
                    {item.activity.output && (
                      <div className="activity-output-expanded">{item.activity.output}</div>
                    )}
                    {item.activity.detail && (
                      <div className="activity-extra-expanded">{item.activity.detail}</div>
                    )}
                  </div>
                </details>
              ) : (
                <article className="activity-card" data-status={item.activity.status}>
                  <Icon aria-hidden="true" className="activity-icon" />
                  <div className="activity-copy">
                    <div className="activity-title">{activityTitle(item.activity.title)}</div>
                    {item.activity.detail && (
                      <div className="activity-detail">{item.activity.detail}</div>
                    )}
                  </div>
                  <span className="activity-status">
                    {activityStatus(state.locale, item.activity)}
                  </span>
                </article>
              )}
              {setupFailure && <PanerelaySetupGuide controller={controller} />}
            </div>
          );
        }
        if (item.type === 'approval') {
          return (
            <ApprovalCard
              approval={item.approval}
              controller={controller}
              key={`approval-${item.approval.id}`}
            />
          );
        }
        const error = errorPresentation(item.message);
        return (
          <div className="timeline-error-stack" key={`error-${item.id}`}>
            <details
              className="activity-card activity-card-expandable timeline-error mx-2"
              data-status="failed"
            >
              <summary aria-label={t('errorDetails')} className="activity-card-summary">
                <CircleAlert aria-hidden="true" className="activity-icon" />
                <div className="activity-copy">
                  <div className="activity-title">{t('errorTitle')}</div>
                  <div className="activity-detail">{item.message}</div>
                </div>
                <span className="activity-status">{t('activityFailed')}</span>
              </summary>
              <dl className="timeline-error-detail">
                <div>
                  <dt>{t('errorType')}</dt>
                  <dd>{t(error.type)}</dd>
                </div>
                <div>
                  <dt>{t('errorSuggestedAction')}</dt>
                  <dd>{t(error.advice)}</dd>
                </div>
              </dl>
            </details>
            {isPanerelaySetupFailure(item.message) && (
              <PanerelaySetupGuide controller={controller} />
            )}
          </div>
        );
      })}
      <TurnFeedback state={state} />
    </div>
  );
}

function ApprovalCard({
  approval,
  controller,
}: {
  approval: ConversationApproval;
  controller: SidepanelController;
}) {
  const { t } = useCopy(controller.state);
  const labels: Record<ConversationApprovalDecision, CopyKey> = {
    accept: 'allowOnce',
    acceptForSession: 'allowSession',
    decline: 'deny',
    declineForSession: 'denySession',
    cancel: 'cancelApproval',
  };
  return (
    <article className="approval-card">
      <div className="approval-body">
        <div className="approval-heading">
          <ShieldQuestion aria-hidden="true" className="approval-icon" />
          <div>
            <p className="approval-kicker">{t('approval')}</p>
            <h3>{approval.title}</h3>
            {approval.description && <p>{approval.description}</p>}
          </div>
        </div>
        {approval.command && <pre className="approval-code">{approval.command}</pre>}
        {approval.cwd && (
          <div className="approval-context">
            <span>{t('workingDirectory')}</span>
            <code>{approval.cwd}</code>
          </div>
        )}
      </div>
      <div className="approval-actions">
        {approval.decisions.map(decision => (
          <button
            className={decision === 'accept' ? 'approve' : undefined}
            key={decision}
            onClick={() => void controller.respondToApproval(approval, decision)}
            type="button"
          >
            {t(labels[decision])}
          </button>
        ))}
      </div>
    </article>
  );
}

export function Welcome({
  controller,
  onToggleSetupIntegration,
  selectedSetupIntegrations,
}: {
  controller: SidepanelController;
  onToggleSetupIntegration: (integration: SetupIntegration) => void;
  selectedSetupIntegrations: Readonly<SetupIntegrationSelection>;
}) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const bridgeConnected = state.extensionStatus?.bridgeConnected ?? false;
  const nativeHostMissing = state.extensionStatus?.nativeHostState === 'missing';
  const providerReady = provider?.status === 'ready';
  const setup = provider?.setup;
  const title = !bridgeConnected
    ? t(nativeHostMissing ? 'nativeHostMissingTitle' : 'emptyBridgeTitle')
    : !providerReady
      ? tf('emptyProviderTitle', { agent: selectedAgentName(state) })
      : tf('emptyTitle', { agent: selectedAgentName(state) });
  const body = !bridgeConnected
    ? t(nativeHostMissing ? 'nativeHostMissingBody' : 'emptyBridgeBody')
    : !providerReady
      ? provider
        ? t(
            provider.id === 'qoder'
              ? 'qoderSetupBody'
              : provider.id === 'opencode'
                ? 'opencodeSetupBody'
                : provider.id === 'claude'
                  ? 'claudeSetupBody'
                  : 'codexSetupBody',
          )
        : t('emptyProviderBody')
      : t('emptyBody');
  const docsUrl = setup?.docsUrl?.startsWith('https://') ? setup.docsUrl : '';
  const suggestions = [
    {
      key: 'summarize' as const,
      icon: ListCollapse,
      title: t('suggestSummarize'),
      body: t('suggestSummarizeBody'),
    },
    {
      key: 'inspect' as const,
      icon: ScanSearch,
      title: t('suggestInspect'),
      body: t('suggestInspectBody'),
    },
    {
      key: 'find' as const,
      icon: Search,
      title: t('suggestFind'),
      body: t('suggestFindBody'),
    },
  ];

  return (
    <div className="empty-state flex min-h-full flex-col items-center justify-center px-[18px] py-7 text-center">
      <Sparkles aria-hidden="true" className="empty-mark shrink-0" />
      {nativeHostMissing ? (
        <>
          <h2>{title}</h2>
          <p>{body}</p>
          <PanerelaySetupGuide
            controller={controller}
            nativeHost
            onToggleIntegration={onToggleSetupIntegration}
            selectedIntegrations={selectedSetupIntegrations}
          />
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <p>
            {body}
            {bridgeConnected && !providerReady && provider && setup && (
              <>
                {state.locale === 'en' ? ' ' : ''}
                <button
                  aria-busy={state.providerDiscoveryPending}
                  className="provider-discovery-inline"
                  disabled={state.providerDiscoveryPending}
                  onClick={() => void controller.retryProviderDiscovery()}
                  type="button"
                >
                  {t('providerDiscoveryRetry')}
                </button>
                {state.locale === 'en' ? '.' : '。'}
              </>
            )}
          </p>
        </>
      )}
      {bridgeConnected && !providerReady && setup && (
        <div className="provider-setup">
          {setup.installCommand && (
            <div className="provider-setup-step">
              <strong>{t('providerInstallCommand')}</strong>
              <code>{setup.installCommand}</code>
            </div>
          )}
          {setup.loginCommand && (
            <div className="provider-setup-step">
              <strong>{t('providerLoginCommand')}</strong>
              <code>{setup.loginCommand}</code>
            </div>
          )}
          {docsUrl && (
            <a className="provider-setup-docs" href={docsUrl} rel="noreferrer" target="_blank">
              {t('providerSetupDocs')}
            </a>
          )}
        </div>
      )}
      {bridgeConnected && (
        <div className="suggestions">
          {providerReady &&
            suggestions.map(suggestion => {
              const Icon = suggestion.icon;
              return (
                <button
                  aria-label={suggestion.title}
                  key={suggestion.key}
                  onClick={() => controller.useSuggestion(suggestion.key)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="suggestion-icon" />
                  <span>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.body}</small>
                  </span>
                  <ChevronRight aria-hidden="true" className="suggestion-arrow" />
                </button>
              );
            })}
          <AuthorizationPanel compact controller={controller} />
        </div>
      )}
    </div>
  );
}
