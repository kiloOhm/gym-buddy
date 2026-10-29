import * as Notifications from 'expo-notifications';
// Named import: eslint's import/namespace cannot follow the re-export chain of this enum.
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

/**
 * Plumbing shared by the local notifications (rest end, deload advice): the foreground handler,
 * the Android channels, the lazy permission request and one queue for schedule/cancel calls.
 *
 * - Permission (POST_NOTIFICATIONS, Android 13+) is requested lazily, once, by the first
 *   notification that is scheduled. If it is denied, every notification silently does nothing.
 * - In the foreground the handler suppresses banner, list entry and sound: the in-app UI already
 *   covers both notifications.
 * - Web: notifications are disabled; callers check notificationsEnabled() and do nothing.
 */

export const REST_CHANNEL_ID = 'rest-timer';
export const DELOAD_CHANNEL_ID = 'deload-advice';
export const REST_VIBRATION_PATTERN = [0, 400, 200, 400];

/** Read at call time (not import time) so tests can switch platforms. */
export const notificationsEnabled = () => Platform.OS !== 'web';

let setup: Promise<boolean> | null = null;
/** Serialises schedule/cancel so a cancel issued while a schedule is in flight still wins. */
let queue: Promise<unknown> = Promise.resolve();

if (notificationsEnabled()) {
  try {
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
  } catch {
    // The store imports this module; a missing native module (e.g. in an unmocked jest test)
    // must not break it. Without the handler, notifications simply show with default policy.
  }
}

/** Creates the channels (required before the Android 13 permission prompt) and asks for permission once. */
export function ensureNotificationsReady(): Promise<boolean> {
  if (!setup) {
    setup = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
          name: 'Rest timer',
          description: 'Alerts when the rest between sets is over',
          importance: AndroidImportance.HIGH,
          vibrationPattern: REST_VIBRATION_PATTERN,
          enableVibrate: true,
          sound: 'default',
        });
        await Notifications.setNotificationChannelAsync(DELOAD_CHANNEL_ID, {
          name: 'Deload advice',
          description: 'Reminds you when your training shows signs of fatigue',
          importance: AndroidImportance.DEFAULT,
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

/** Runs the task after every earlier one; its errors are swallowed. */
export function enqueueNotificationTask(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task).catch(() => {
    // Notifications are a bonus on top of the in-app UI; never surface their errors.
  });
  queue = next;
  return next;
}

/** Test hook: forget the cached channel/permission setup and the queue. */
export function resetNotificationsForTests() {
  setup = null;
  queue = Promise.resolve();
}
