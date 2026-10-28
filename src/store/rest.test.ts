import { useRestStore } from '@/store/rest';
import { cancelRestEnd, scheduleRestEnd } from '@/store/restNotification';

jest.mock('@/store/restNotification', () => ({
  scheduleRestEnd: jest.fn(async () => undefined),
  cancelRestEnd: jest.fn(async () => undefined),
}));

const schedule = scheduleRestEnd as jest.Mock;
const cancel = cancelRestEnd as jest.Mock;

describe('rest store: notification wiring', () => {
  beforeEach(() => {
    useRestStore.setState({ endsAt: null, totalSec: 0 });
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });
  afterEach(() => jest.restoreAllMocks());

  it('start schedules the notification at endsAt', () => {
    useRestStore.getState().start(90);
    expect(useRestStore.getState().endsAt).toBe(1_090_000);
    expect(schedule).toHaveBeenCalledWith(1_090_000);
  });

  it('start with no rest time does nothing', () => {
    useRestStore.getState().start(0);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('extend reschedules for the new end', () => {
    useRestStore.getState().start(90);
    useRestStore.getState().extend(30);
    expect(useRestStore.getState()).toMatchObject({ endsAt: 1_120_000, totalSec: 120 });
    expect(schedule).toHaveBeenLastCalledWith(1_120_000);
  });

  it('extend after the end does not reschedule', () => {
    useRestStore.getState().start(90);
    (Date.now as jest.Mock).mockReturnValue(1_100_000);
    useRestStore.getState().extend(30);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('clear cancels a running rest, and is quiet when nothing runs', () => {
    useRestStore.getState().clear();
    expect(cancel).not.toHaveBeenCalled();
    useRestStore.getState().start(90);
    useRestStore.getState().clear();
    expect(useRestStore.getState().endsAt).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
