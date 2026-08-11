import type { ConversationActivity, ConversationMessage } from '@panerelay/protocol';
import { describe, expect, it } from 'vitest';
import type { TimelineItem } from '../../shared/conversation-timeline.js';
import { groupTimelineActivities } from './activity-groups.js';

function activity(id: string, status: ConversationActivity['status'] = 'completed'): TimelineItem {
  return {
    type: 'activity',
    turnId: 'turn-1',
    activity: { id, kind: 'command', title: `Command ${id}`, status },
  };
}

function message(id: string): TimelineItem {
  const value: ConversationMessage = {
    id,
    role: 'assistant',
    text: `Message ${id}`,
    createdAt: '2026-08-11T00:00:00.000Z',
  };
  return { type: 'message', message: value, turnId: 'turn-1' };
}

describe('groupTimelineActivities', () => {
  it('groups each maximal adjacent activity run without mutating the source timeline', () => {
    const timeline = [message('before'), activity('one'), activity('two'), message('after')];
    const rendered = groupTimelineActivities(timeline);

    expect(rendered.map(item => item.type)).toEqual(['message', 'activity-group', 'message']);
    expect(rendered[1]).toMatchObject({
      type: 'activity-group',
      id: 'one',
      activities: [{ activity: { id: 'one' } }, { activity: { id: 'two' } }],
      latest: { id: 'two' },
      status: 'completed',
    });
    expect(timeline.map(item => item.type)).toEqual(['message', 'activity', 'activity', 'message']);
  });

  it('keeps isolated activities as their original render item', () => {
    const item = activity('only');
    expect(groupTimelineActivities([message('before'), item, message('after')])).toEqual([
      message('before'),
      item,
      message('after'),
    ]);
  });

  it.each(['message', 'reasoning', 'approval', 'error'] as const)(
    'does not group across a %s boundary',
    boundary => {
      const separators: Record<typeof boundary, TimelineItem> = {
        message: message('separator'),
        reasoning: { type: 'reasoning', id: 'reasoning', text: 'Inspecting' },
        approval: {
          type: 'approval',
          approval: {
            id: 'approval',
            conversationId: 'conversation',
            turnId: 'turn-1',
            kind: 'command',
            title: 'Approve',
            decisions: ['accept', 'decline'],
          },
        },
        error: { type: 'error', id: 'error', message: 'Failed' },
      };
      const rendered = groupTimelineActivities([
        activity('before'),
        separators[boundary],
        activity('after'),
      ]);
      expect(rendered.map(item => item.type)).toEqual(['activity', boundary, 'activity']);
    },
  );

  it('prioritizes live work while retaining mixed failure counts', () => {
    const [group] = groupTimelineActivities([
      activity('completed'),
      activity('failed', 'failed'),
      activity('declined', 'declined'),
      activity('running', 'running'),
    ]);
    expect(group).toMatchObject({
      type: 'activity-group',
      latest: { id: 'running' },
      status: 'running',
      failedCount: 1,
      declinedCount: 1,
    });
  });

  it('uses failed, declined, then completed as terminal aggregate priority', () => {
    expect(groupTimelineActivities([activity('one'), activity('two', 'failed')])[0]).toMatchObject({
      status: 'failed',
    });
    expect(
      groupTimelineActivities([activity('one'), activity('two', 'declined')])[0],
    ).toMatchObject({ status: 'declined' });
    expect(groupTimelineActivities([activity('one'), activity('two')])[0]).toMatchObject({
      status: 'completed',
    });
  });
});
