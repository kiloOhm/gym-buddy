import * as Notifications from 'expo-notifications';
// Named import: eslint's import/namespace cannot follow the re-export chain of this enum.
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

/**
 * Local "Rest over" notification, so the phone alerts when a rest ends while the app is in the
 * background or the screen is off (JS timers, and so RestTimer's vibration, are paused then).
 *
 * - One notification at a time under a fixed identifier: scheduling replaces it, cancelling needs no id.
 * - Permission (POST_NOTIFICATIONS, Android 13+) is requested lazily on the first rest. If it is
 *   denied, everything silently falls back to the in-app bar and vibration.
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
export const REST_CHANNEL_ID = 'rest-timer';

const VIBRATION_PATTERN = [0, 400, 200, 400];

/** Read at call time (not import time) so tests can switch platforms. */
const enabled = () => Platform.OS !== 'web';

let setup: Promise<boolean> | null = null;
/** Serialises schedule/cancel so a cancel issued while a schedule is in flight still wins. */
let queue: Promise<unknown> = Promise.resolve();

if (enabled()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const foreground = AppState.currentState === 'active';
      return {
        shouldShowBanner: !foreground,
        shouldShowList: !foreground,
        shouldPlaySound: !foreground,
        shouldSetBadge: false,
      };
    },
  });
}

/** Creates the channel (required before the Android 13 permission prompt) and asks for permission once. */
function ensureReady(): Promise<boolean> {
  if (!setup) {
    setup = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
          name: 'Rest timer',
          description: 'Alerts when the rest between sets is over',
          importance: AndroidImportance.HIGH,
          vibrationPattern: VIBRATION_PATTERN,
          enableVibrate: true,
          sound: 'default',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      const asked = await Notifications.requestPermissionsAsync();
      return asked.granted;
    })().catch(() => false);
  }
  return setup;
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task).catch(() => {
    // Notifications are a bonus on top of the in-app timer; never surface their errors.
  });
  queue = next;
  return next;
}

/** Schedules (or replaces) the rest-end notification for the absolute time `endsAtMs`. */
export function scheduleRestEnd(endsAtMs: number): Promise<void> {
  if (!enabled()) return Promise.resolve();
  return enqueue(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
    if (!(await ensureReady())) return;
    if (endsAtMs <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTIFICATION_ID,
      content: {
        title: 'Rest over',
        body: 'Time for your next set.',
        sound: 'default',
        vibrate: VIBRATION_PATTERN,
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
  if (!enabled()) return Promise.resolve();
  return enqueue(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(REST_NOTIFICATION_ID);
  });
}

/** Test hook: forget the cached channel/permission setup. */
export function resetRestNotificationForTests() {
  setup = null;
  queue = Promise.resolve();
}
