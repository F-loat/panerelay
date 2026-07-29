import type {
  AutomationActivity,
  AutomationActivitySnapshotMessage,
  AutomationActivityUpdatedMessage,
  ControlSessionChangedMessage,
  ControlSessionSummary,
} from '@panerelay/protocol';

export const MAX_VISIBLE_AUTOMATION_ACTIVITIES = 50;

export interface ControlActivityState {
  epoch: string | null;
  sequence: number;
  session: ControlSessionSummary | null;
  activities: AutomationActivity[];
  historyGap: boolean;
}

export type ControlActivityMessage =
  | ControlSessionChangedMessage
  | AutomationActivitySnapshotMessage
  | AutomationActivityUpdatedMessage;

export function createControlActivityState(): ControlActivityState {
  return {
    epoch: null,
    sequence: 0,
    session: null,
    activities: [],
    historyGap: false,
  };
}

function changedEpoch(state: ControlActivityState, epoch: string): boolean {
  return state.epoch !== null && state.epoch !== epoch;
}

function boundedActivities(activities: AutomationActivity[]): AutomationActivity[] {
  return activities.slice(-MAX_VISIBLE_AUTOMATION_ACTIVITIES);
}

export function reduceControlActivity(
  state: ControlActivityState,
  message: ControlActivityMessage,
): ControlActivityState {
  if (message.type === 'control.activity.snapshot') {
    if (state.epoch === message.epoch && message.sequence < state.sequence) return state;
    const epochChanged = changedEpoch(state, message.epoch);
    const unavailableRange =
      !epochChanged &&
      state.epoch !== null &&
      message.sequence > state.sequence &&
      message.firstRetainedSequence !== undefined &&
      message.firstRetainedSequence > state.sequence + 1;
    return {
      epoch: message.epoch,
      sequence: Math.max(state.sequence, message.sequence),
      session: epochChanged ? null : state.session,
      activities: boundedActivities(message.activities),
      historyGap: state.historyGap || epochChanged || unavailableRange,
    };
  }

  const epochChanged = changedEpoch(state, message.epoch);
  const previousSequence = epochChanged ? 0 : state.sequence;
  const skippedSequence =
    !epochChanged && state.epoch !== null && message.sequence > previousSequence + 1;
  const nextBase: ControlActivityState = {
    epoch: message.epoch,
    sequence: Math.max(previousSequence, message.sequence),
    session: epochChanged ? null : state.session,
    activities: epochChanged ? [] : state.activities,
    historyGap: state.historyGap || epochChanged || skippedSequence,
  };

  if (message.type === 'control.session.changed') {
    return {
      ...nextBase,
      session: message.session,
    };
  }

  const activities = nextBase.activities.filter(activity => activity.id !== message.activity.id);
  activities.push(message.activity);
  return {
    ...nextBase,
    activities: boundedActivities(activities),
  };
}
