import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import {
  cancelRestEnd,
  REST_CHANNEL_ID,
  REST_NOTIFICATION_ID,
  resetRestNotificationForTests,
  scheduleRestEnd,
} from '@/store/restNotification';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: jest.fn(async () => 'rest-end'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  dismissNotificationAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 6, DEFAULT: 3 },
  AndroidNotificationPriority: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;
// Captured before beforeEach clears the mocks: the handler is installed once at import.
const handlerCall = N.setNotificationHandler.mock.calls[0];
const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('restNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRestNotificationForTests();
    setOS('android');
  });
  afterAll(() => setOS(originalOS));

  it('schedules an alarm-clock notification at the absolute end time on its channel', async () => {
    const endsAt = Date.now() + 90_000;
    await scheduleRestEnd(endsAt);
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      REST_CHANNEL_ID,
      expect.objectContaining({ importance: 6, sound: 'default', vibrationPattern: expect.any(Array) }),
    );
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: REST_NOTIFICATION_ID,
        content: expect.objectContaining({ title: 'Rest over' }),
        trigger: { type: 'date', date: endsAt, channelId: REST_CHANNEL_ID, delivery: 'alarmClock' },
      }),
    );
  });

  it('asks for permission lazily, once, and stays silent when denied', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await scheduleRestEnd(Date.now() + 60_000);
    await scheduleRestEnd(Date.now() + 60_000);
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not prompt when the user can no longer be asked', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await scheduleRestEnd(Date.now() + 60_000);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('replaces the previous notification and skips end times in the past', async () => {
    await scheduleRestEnd(Date.now() - 1);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REST_NOTIFICATION_ID);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancel removes the pending and the shown notification, after an in-flight schedule', async () => {
    void scheduleRestEnd(Date.now() + 60_000);
    await cancelRestEnd();
    const scheduled = N.scheduleNotificationAsync.mock.invocationCallOrder[0];
    const cancels = N.cancelScheduledNotificationAsync.mock.invocationCallOrder;
    expect(cancels[cancels.length - 1]).toBeGreaterThan(scheduled);
    expect(N.dismissNotificationAsync).toHaveBeenCalledWith(REST_NOTIFICATION_ID);
  });

  it('never throws when the native call fails', async () => {
    N.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(scheduleRestEnd(Date.now() + 60_000)).resolves.toBeUndefined();
  });

  it('is a no-op on web', async () => {
    setOS('web');
    await scheduleRestEnd(Date.now() + 60_000);
    await cancelRestEnd();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('hides banner and sound in the foreground, shows them in the background', async () => {
    expect(handlerCall).toBeDefined();
    const handler = handlerCall[0]!;
    const original = AppState.currentState;
    try {
      Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
      await expect(handler.handleNotification({} as never)).resolves.toMatchObject({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
      });
      AppState.currentState = 'background';
      await expect(handler.handleNotification({} as never)).resolves.toMatchObject({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
      });
    } finally {
      AppState.currentState = original;
    }
  });
});
