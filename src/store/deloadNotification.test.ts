import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  cancelDeloadAdvice,
  DELOAD_CHANNEL_ID,
  DELOAD_NOTIFICATION_ID,
  resetDeloadNotificationForTests,
  scheduleDeloadAdvice,
} from '@/store/deloadNotification';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: jest.fn(async () => 'deload-advice'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  dismissNotificationAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 6, DEFAULT: 3 },
  AndroidNotificationPriority: { HIGH: 'high', DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;
const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('deloadNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDeloadNotificationForTests();
    setOS('android');
  });
  afterAll(() => setOS(originalOS));

  it('schedules a date notification with the body on the deload channel', async () => {
    const fireAt = Date.now() + 3_600_000;
    await scheduleDeloadAdvice(fireAt, 'Quads: over 20 effective sets a week for 2 weeks');
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      DELOAD_CHANNEL_ID,
      expect.objectContaining({ name: 'Deload advice', importance: 3, sound: 'default' }),
    );
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: DELOAD_NOTIFICATION_ID,
      content: {
        title: 'Time for a deload?',
        body: 'Quads: over 20 effective sets a week for 2 weeks',
        sound: 'default',
        priority: 'default',
      },
      trigger: { type: 'date', date: fireAt, channelId: DELOAD_CHANNEL_ID },
    });
  });

  it('cancels the pending reminder before scheduling the new one', async () => {
    await scheduleDeloadAdvice(Date.now() + 60_000, 'x');
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DELOAD_NOTIFICATION_ID);
    expect(N.cancelScheduledNotificationAsync.mock.invocationCallOrder[0]).toBeLessThan(
      N.scheduleNotificationAsync.mock.invocationCallOrder[0],
    );
  });

  it('cancel removes the pending and dismisses the shown reminder', async () => {
    await cancelDeloadAdvice();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DELOAD_NOTIFICATION_ID);
    expect(N.dismissNotificationAsync).toHaveBeenCalledWith(DELOAD_NOTIFICATION_ID);
  });

  it('schedules nothing when permission is denied', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await scheduleDeloadAdvice(Date.now() + 60_000, 'x');
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never throws when the native call fails', async () => {
    N.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(scheduleDeloadAdvice(Date.now() + 60_000, 'x')).resolves.toBeUndefined();
    N.dismissNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(cancelDeloadAdvice()).resolves.toBeUndefined();
  });

  it('is a no-op on web', async () => {
    setOS('web');
    await scheduleDeloadAdvice(Date.now() + 60_000, 'x');
    await cancelDeloadAdvice();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
