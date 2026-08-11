import type { ConversationActivity } from '@panerelay/protocol';
import type { TimelineItem } from '../../shared/conversation-timeline.js';

export type ActivityTimelineItem = Extract<TimelineItem, { type: 'activity' }>;

export interface ActivityGroupRenderItem {
  type: 'activity-group';
  id: string;
  activities: ActivityTimelineItem[];
  latest: ConversationActivity;
  status: ConversationActivity['status'];
  failedCount: number;
  declinedCount: number;
}

export type TimelineRenderItem = TimelineItem | ActivityGroupRenderItem;

function aggregateActivityStatus(
  activities: readonly ActivityTimelineItem[],
): ConversationActivity['status'] {
  if (activities.some(item => item.activity.status === 'running')) return 'running';
  if (activities.some(item => item.activity.status === 'failed')) return 'failed';
  if (activities.some(item => item.activity.status === 'declined')) return 'declined';
  return 'completed';
}

function activityGroup(activities: ActivityTimelineItem[]): ActivityGroupRenderItem {
  const latest = activities.at(-1)?.activity;
  if (!latest) throw new Error('An activity group requires at least one activity');
  return {
    type: 'activity-group',
    id: activities[0]?.activity.id ?? latest.id,
    activities,
    latest,
    status: aggregateActivityStatus(activities),
    failedCount: activities.filter(item => item.activity.status === 'failed').length,
    declinedCount: activities.filter(item => item.activity.status === 'declined').length,
  };
}

export function groupTimelineActivities(timeline: readonly TimelineItem[]): TimelineRenderItem[] {
  const rendered: TimelineRenderItem[] = [];
  let activities: ActivityTimelineItem[] = [];

  const flushActivities = () => {
    if (activities.length === 1) rendered.push(activities[0]!);
    if (activities.length > 1) rendered.push(activityGroup(activities));
    activities = [];
  };

  for (const item of timeline) {
    if (item.type === 'activity') {
      activities.push(item);
      continue;
    }
    flushActivities();
    rendered.push(item);
  }
  flushActivities();

  return rendered;
}
