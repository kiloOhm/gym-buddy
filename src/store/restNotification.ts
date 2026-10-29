import * as Notifications from 'expo-notifications';

import {
  enqueueNotificationTask,
  ensureNotificationsReady,
  notificationsEnabled,
  REST_CHANNEL_ID,
  REST_VIBRATION_PATTERN,
  resetNotificationsForTests,
} from './notifications';

/**
 * Local "Rest over" notification, so the phone alerts when a rest ends while the app is in the
 * background or the screen is off (JS timers, and so RestTimer's vibration, are paused then).
 *
 * - One notification at a time under a fixed identifier: scheduling replaces it, cancelling needs no id.
 * - Permission (POST_NOTIFICATIONS, Android 13+) is requested lazily on the first rest (shared
 *   setup in notifications.ts). If it is denied, everything silently falls back to the in-app bar
 *   and vibration.
 * - In the foreground the handler suppresses banner, list entry and sound: the in-app "Rest over"
 *   bar and Vibration.vibrate already cover it.
 * - Web: every function is a no-op; the PWA keeps the in-app vibration only.
 *
 * Exactness (checked against expo-notifications 58.1.7,
 * android/.../service/delegates/ExpoSchedulingDelegate.kt `setupAlarm`): if
 * `AlarmManager.canScheduleExactAlarms()` is false on Android 12+ the trigger is scheduled with
 * `setAndAllowWhileIdle()`, which the system may defer by minutes. With the permission, delivery
 * 'alarmClock' uses `setAlarmClock()`, which is never deferred for battery or OEM policies (the
 * source notes OEMs do defer `setExactAndAllowWhileIdle()`, the 'bestEffort' path). So app.json
 * declares USE_EXACT_ALARM (auto-granted on Android 13+; fine for a sideloaded timer app, Play
 * restricts it) and SCHEDULE_EXACT_ALARM (covers Android 12/12L, where it is granted at install),
 * and we schedule with `delivery: 'alarmClock'`. Side effect: Android shows an alarm icon in the
 * status bar while a rest is running.
 */

export const REST_NOTIFICATION_ID = 'rest-end';
export { REST_CHANNEL_ID };

/** Schedules (or replaces) the rest-end notification for the absolute time `endsAtMs`. */
export function scheduleRestEnd(endsAtMs: number): Promise<void> {
  if (!notificationsEnabled()) return Promise.resolve();
  return enqueueNotificationTask(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
    if (!(await ensureNotificationsReady())) return;
    if (endsAtMs <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTIFICATION_ID,
      content: {
        title: 'Rest over',
        body: 'Time for your next set.',
        sound: 'default',
        vibrate: REST_VIBRATION_PATTERN,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endsAtMs,
        channelId: REST_CHANNEL_ID,
        delivery: 'alarmClock',
      },
    });
  });
}

/** Cancels a pending rest-end notification and removes one already shown. */
export function cancelRestEnd(): Promise<void> {
  if (!notificationsEnabled()) return Promise.resolve();
  return enqueueNotificationTask(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(REST_NOTIFICATION_ID);
  });
}

/** Test hook: forget the cached channel/permission setup. */
export function resetRestNotificationForTests() {
  resetNotificationsForTests();
}
