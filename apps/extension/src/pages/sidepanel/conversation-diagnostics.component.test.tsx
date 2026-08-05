import type { ConversationApprovalDecision } from '@panerelay/protocol';
import { describe, expect, it } from 'vitest';
import type { ExtensionStatus } from '../../shared/messages.js';
import { createInitialSidepanelState } from './sidepanel-state.js';
import {
  conversationDiagnosticsRecord,
  hasConversationDiagnostics,
  serializeConversationDiagnostics,
} from './conversation-diagnostics.js';

describe('conversation diagnostics', () => {
  it('serializes the selected normalized state in timeline order', () => {
    const extensionStatus: ExtensionStatus = {
      bridgeConnected: true,
      nativeHostState: 'connected',
      defaultProvider: null,
      browserUseDefault: null,
      browserDefault: null,
      authorizationRequest: null,
      activeTab: { id: 21, title: 'Yuque dashboard', url: 'https://yuque.example/dashboard' },
      authorizationMode: 'single-tab',
      authorizedOriginPatterns: ['https://yuque.example/*'],
      authorizedTab: {
        id: 21,
        title: 'Yuque dashboard',
        url: 'https://yuque.example/dashboard',
      },
      controlledTab: { id: 22, title: 'PRD', url: 'https://docs.example/prd' },
      controlledTabs: [
        { id: 22, title: 'PRD', url: 'https://docs.example/prd' },
        { id: 21, title: 'Yuque dashboard', url: 'https://yuque.example/dashboard' },
      ],
      controlSession: {
        id: 'control-session-1',
        actor: { kind: 'automation', name: 'agent-browser', sessionLabel: 'panerelay-v2' },
        state: 'active',
        participantCount: 1,
        observedTargetCount: 2,
        controlledTargetCount: 2,
        heartbeatFreshness: 'fresh',
        updatedAt: '2026-08-05T02:59:45.000Z',
      },
      automationActivities: [
        {
          id: 'browser-activity-1',
          sessionId: 'control-session-1',
          actor: { kind: 'automation', name: 'agent-browser' },
          targetId: 'opaque-target-1',
          category: 'page-content',
          label: 'read-page',
          status: 'completed',
          sequence: 8,
          startedAt: '2026-08-05T02:59:40.000Z',
          updatedAt: '2026-08-05T02:59:41.000Z',
        },
      ],
      automationHistoryGap: false,
    };
    const state = {
      ...createInitialSidepanelState('en'),
      extensionStatus,
      providers: [
        {
          id: 'qoder',
          name: 'Qoder',
          status: 'ready' as const,
          description: 'Provider description is not exported',
          version: '1.1.2',
          model: 'auto',
          capabilities: { approvals: true, streaming: true },
          setupHint: 'private setup hint',
        },
      ],
      currentProviderId: 'qoder',
      providerPreparations: { qoder: { status: 'ready' as const } },
      workspace: {
        kind: 'conversation' as const,
        providerId: 'qoder',
        conversationId: 'conversation-1',
        revision: 'revision-2',
        cwd: '/workspace/project',
      },
      currentConversation: {
        id: 'conversation-1',
        providerId: 'qoder',
        model: 'qoder-model',
        title: 'Restored conversation',
        preview: 'Latest answer',
        status: 'running' as const,
        createdAt: '2026-08-05T01:00:00.000Z',
        updatedAt: '2026-08-05T02:00:00.000Z',
      },
      timeline: [
        {
          type: 'message' as const,
          streaming: true,
          turnId: 'turn-1',
          message: {
            id: 'assistant-1',
            role: 'assistant' as const,
            text: 'Inspecting',
            phase: 'commentary' as const,
            createdAt: '2026-08-05T01:01:00.000Z',
          },
        },
        {
          type: 'activity' as const,
          turnId: 'turn-1',
          activity: {
            id: 'tool-1',
            kind: 'browser' as const,
            title: 'agent-browser snapshot',
            status: 'completed' as const,
            output: 'Snapshot complete',
          },
        },
        {
          type: 'reasoning' as const,
          id: 'reasoning-1',
          text: 'Checking the result',
          turnId: 'turn-1',
        },
        {
          type: 'approval' as const,
          approval: {
            id: 'approval-1',
            conversationId: 'conversation-1',
            turnId: 'turn-1',
            kind: 'command' as const,
            title: 'Run command',
            command: 'pnpm test',
            cwd: '/workspace/project',
            decisions: ['accept', 'decline'] as ConversationApprovalDecision[],
          },
        },
        {
          type: 'error' as const,
          id: 'error-1',
          message: 'Provider disconnected',
          turnId: 'turn-1',
        },
      ],
      runningTurnId: 'turn-1',
      turnFeedback: 'working' as const,
      activeReasoning: { id: 'reasoning-1', text: 'Checking the result' },
      diagnostics: {
        panelInstanceId: 'panel-instance-1',
        load: {
          source: 'provider-resume' as const,
          loadedAt: '2026-08-05T02:59:00.000Z',
          conversationId: 'conversation-1',
        },
        eventTrace: [
          {
            sequence: 1,
            receivedAt: '2026-08-05T02:59:30.000Z',
            kind: 'activity.updated' as const,
            conversationId: 'conversation-1',
            turnId: 'turn-1',
            activityId: 'tool-1',
            status: 'completed',
          },
          {
            sequence: 2,
            receivedAt: '2026-08-05T02:59:31.000Z',
            kind: 'message.delta' as const,
            conversationId: 'conversation-1',
            turnId: 'turn-1',
            messageId: 'assistant-1',
            phase: 'final' as const,
            deltaLength: 10,
          },
        ],
        droppedEventCount: 0,
      },
      composerText: 'composer-draft-secret',
      pageComments: [
        {
          id: 'comment-1',
          comment: 'page-comment-secret',
          element: {
            selector: '#secret',
            tagName: 'DIV',
            text: 'page-element-secret',
            rect: { height: 1, left: 1, top: 1, width: 1 },
          },
          page: { title: 'Secret page', url: 'https://secret.example/' },
        },
      ],
      pastedImages: [
        {
          id: 'image-1',
          size: 10,
          data: 'image-data-secret',
          mimeType: 'image/png',
        },
      ],
    };

    const record = conversationDiagnosticsRecord(state, '2026-08-05T03:00:00.000Z');

    expect(record).toMatchObject({
      schema: 'panerelay.conversation-diagnostics',
      version: 3,
      capturedAt: '2026-08-05T03:00:00.000Z',
      contentPolicy: {
        messageText: 'full',
        reasoningText: 'metrics-only',
        activityOutput: 'metrics-only',
        tabMetadata: 'full',
        automationActivity: 'metadata-only',
      },
      browserContext: {
        activeTab: {
          id: 21,
          title: 'Yuque dashboard',
          url: 'https://yuque.example/dashboard',
        },
        authorization: {
          mode: 'single-tab',
          tab: { id: 21 },
        },
        control: {
          tab: { id: 22, title: 'PRD', url: 'https://docs.example/prd' },
          tabs: [{ id: 22 }, { id: 21 }],
          session: { id: 'control-session-1', actor: { name: 'agent-browser' } },
          historyGap: false,
          activities: [
            {
              id: 'browser-activity-1',
              targetId: 'opaque-target-1',
              label: 'read-page',
              status: 'completed',
            },
          ],
        },
      },
      provider: {
        id: 'qoder',
        name: 'Qoder',
        status: 'ready',
        version: '1.1.2',
        defaultModel: 'auto',
      },
      workspace: {
        kind: 'conversation',
        conversationId: 'conversation-1',
        revision: 'revision-2',
      },
      conversation: { id: 'conversation-1', model: 'qoder-model', status: 'running' },
      view: {
        timelineLength: 5,
        runningTurnId: 'turn-1',
        activeReasoningId: 'reasoning-1',
      },
      capture: {
        panelInstanceId: 'panel-instance-1',
        load: { source: 'provider-resume', conversationId: 'conversation-1' },
        eventTraceDropped: 0,
      },
    });
    expect(record.timeline.map(item => [item.index, item.type])).toEqual([
      [0, 'message'],
      [1, 'activity'],
      [2, 'reasoning'],
      [3, 'approval'],
      [4, 'error'],
    ]);
    expect(record.timeline[0]).toMatchObject({
      id: 'assistant-1',
      text: 'Inspecting',
      turnId: 'turn-1',
      phase: 'commentary',
      streaming: true,
    });
    expect(record.timeline[1]).toMatchObject({
      id: 'tool-1',
      kind: 'browser',
      status: 'completed',
      turnId: 'turn-1',
      outputSummary: { characterCount: 17, lineCount: 1 },
    });
    expect(record.timeline[2]).toMatchObject({
      id: 'reasoning-1',
      turnId: 'turn-1',
      textSummary: { characterCount: 19, lineCount: 1 },
    });
    expect(record.timeline[3]).toMatchObject({
      id: 'approval-1',
      turnId: 'turn-1',
      command: 'pnpm test',
      decisions: ['accept', 'decline'],
    });
    expect(record.capture.eventTrace.map(event => event.kind)).toEqual([
      'activity.updated',
      'message.delta',
    ]);

    const serialized = serializeConversationDiagnostics(state, '2026-08-05T03:00:00.000Z');
    expect(JSON.parse(serialized)).toEqual(record);
    expect(serialized).not.toContain('private setup hint');
    expect(serialized).not.toContain('composer-draft-secret');
    expect(serialized).not.toContain('page-comment-secret');
    expect(serialized).not.toContain('page-element-secret');
    expect(serialized).not.toContain('image-data-secret');
    expect(serialized).not.toContain('Snapshot complete');
    expect(serialized).not.toContain('Checking the result');
  });

  it('reports unavailable browser context explicitly', () => {
    const state = {
      ...createInitialSidepanelState('en'),
      currentConversation: {
        id: 'conversation-1',
        providerId: 'codex',
        title: 'Conversation',
        preview: '',
        status: 'idle' as const,
        createdAt: '2026-08-05T01:00:00.000Z',
        updatedAt: '2026-08-05T01:00:00.000Z',
      },
    };

    expect(conversationDiagnosticsRecord(state, '2026-08-05T03:00:00.000Z')).toMatchObject({
      version: 3,
      browserContext: null,
    });
  });

  it('requires a conversation or timeline entry before enabling the action', () => {
    const empty = createInitialSidepanelState('en');
    expect(hasConversationDiagnostics(empty)).toBe(false);
    expect(
      hasConversationDiagnostics({
        ...empty,
        timeline: [{ type: 'reasoning', id: 'reasoning-1', text: 'Working' }],
      }),
    ).toBe(true);
    expect(
      hasConversationDiagnostics({
        ...empty,
        currentConversation: {
          id: 'conversation-1',
          providerId: 'codex',
          title: 'Conversation',
          preview: '',
          status: 'idle',
          createdAt: '2026-08-05T01:00:00.000Z',
          updatedAt: '2026-08-05T01:00:00.000Z',
        },
      }),
    ).toBe(true);
  });
});
