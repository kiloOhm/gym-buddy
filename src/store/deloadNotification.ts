import * as Notifications from 'expo-notifications';

import {
  DELOAD_CHANNEL_ID,
  enqueueNotificationTask,
  ensureNotificationsReady,
  notificationsEnabled,
  resetNotificationsForTests,
} from './notifications';

/**
 * Local "Time for a deload?" reminder, scheduled once per set of deload reasons (see
 * refreshDeloadAdvice in the store) for a morning hour. One notification at a time under a fixed
 * identifier. No exact-alarm delivery: a reminder a few minutes late does not matter.
 * Web: every function is a no-op; the Home card is the only hint there.
 */

export const DELOAD_NOTIFICATION_ID = 'deload-advice';
export { DELOAD_CHANNEL_ID };

/**
 * Replaces any pending deload reminder with one at fireAtMs. No-op on web or without
 * permission; never throws.
 */
export function scheduleDeloadAdvice(fireAtMs: number, body: string): Promise<void> {
  if (!notificationsEnabled()) return Promise.resolve();
  return enqueueNotificationTask(async () => {
    await Notifications.cancelScheduledNotificationAsync(DELOAD_NOTIFICATION_ID);
    if (!(await ensureNotificationsReady())) return;
    if (fireAtMs <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: DELOAD_NOTIFICATION_ID,
      content: {
        title: 'Time for a deload?',
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAtMs,
        channelId: DELOAD_CHANNEL_ID,
      },
    });
  });
}

/** Cancels the pending reminder and dismisses a shown one. */
export function cancelDeloadAdvice(): Promise<void> {
  if (!notificationsEnabled()) return Promise.resolve();
  return enqueueNotificationTask(async () => {
    await Notifications.cancelScheduledNotificationAsync(DELOAD_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(DELOAD_NOTIFICATION_ID);
  });
}

/** Test hook: forget the cached channel/permission setup. */
export function resetDeloadNotificationForTests() {
  resetNotificationsForTests();
}
