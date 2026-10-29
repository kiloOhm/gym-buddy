import AsyncStorage from '@react-native-async-storage/async-storage';

import { getExerciseMap } from '@/data/exercises';
import { describeReason, nextAdviceTime, SNOOZE_DAYS } from '@/logic/deload';
import { DEFAULT_SETTINGS, migratePersistedState, PERSIST_VERSION, useGymStore } from '@/store';
import { cancelDeloadAdvice, scheduleDeloadAdvice } from '@/store/deloadNotification';
import type { SessionExercise, WorkoutPlan, WorkoutSession } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/store/deloadNotification', () => ({
  scheduleDeloadAdvice: jest.fn(async () => undefined),
  cancelDeloadAdvice: jest.fn(async () => undefined),
}));

const schedule = scheduleDeloadAdvice as jest.Mock;
const cancel = cancelDeloadAdvice as jest.Mock;

const NOW = Date.parse('2026-10-27T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

let nextId = 0;
function block(exerciseId: string, weight: number): SessionExercise {
  return {
    id: `b${nextId++}`,
    exerciseId,
    targetSets: 1,
    targetReps: 1,
    restSec: 90,
    sets: [{ weight, reps: 1, completed: true }],
  };
}

/** Finished sessions (newest first) of one lift at the given weights, oldest first, a day apart before `end`. */
function lift(exerciseId: string, weights: number[], end = NOW): WorkoutSession[] {
  return weights
    .map((w, i) => {
      const at = end - (weights.length - i) * DAY;
      return {
        id: `s${nextId++}`,
        planName: 'Plan',
        startedAt: new Date(at - 3_600_000).toISOString(),
        finishedAt: new Date(at).toISOString(),
        exercises: [block(exerciseId, w)],
      };
    })
    .reverse();
}

const squatDecline = () => lift('barbell_back_squat', [100, 98, 96, 94]);
const benchDecline = () => lift('barbell_bench_press', [80, 78, 76, 74]);

const store = () => useGymStore.getState();

describe('store: deload advice', () => {
  beforeEach(() => {
    useGymStore.setState({
      sessions: [],
      activeSession: null,
      deloadAdvice: null,
      plans: [],
      customExercises: [],
      settings: DEFAULT_SETTINGS,
    });
    jest.clearAllMocks();
  });

  it('records the advice and schedules one reminder with the first reason', () => {
    useGymStore.setState({ sessions: [...squatDecline(), ...benchDecline()] });
    store().refreshDeloadAdvice(NOW);
    const advice = store().deloadAdvice;
    expect(advice).toMatchObject({
      key: 'decline:barbell_back_squat|decline:barbell_bench_press',
      since: new Date(NOW).toISOString(),
      notifiedFor: 'decline:barbell_back_squat|decline:barbell_bench_press',
    });
    expect(advice?.snoozedUntil).toBeUndefined();
    const first = describeReason(advice!.reasons[0], getExerciseMap(), 'kg');
    expect(first).toBe(`${getExerciseMap().barbell_back_squat.name}: estimated max fell 3 sessions in a row (100 → 94 kg)`);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(nextAdviceTime(NOW), `${first} · 1 more`);
  });

  it('has no "more" suffix for a single reason, and uses the weight unit', () => {
    useGymStore.setState({ sessions: squatDecline(), settings: { weightUnit: 'lb' } });
    store().refreshDeloadAdvice(NOW);
    expect(schedule).toHaveBeenCalledWith(nextAdviceTime(NOW), expect.stringMatching(/\(100 → 94 lb\)$/));
  });

  it('does not reschedule or rewrite the state for the same reasons', () => {
    useGymStore.setState({ sessions: squatDecline() });
    store().refreshDeloadAdvice(NOW);
    const before = store().deloadAdvice;
    store().refreshDeloadAdvice(NOW + DAY);
    expect(store().deloadAdvice).toBe(before);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('reschedules for a changed reason set and restarts `since`', () => {
    useGymStore.setState({ sessions: squatDecline() });
    store().refreshDeloadAdvice(NOW);
    useGymStore.setState({ sessions: [...squatDecline(), ...benchDecline()] });
    store().refreshDeloadAdvice(NOW + DAY);
    expect(store().deloadAdvice).toMatchObject({
      key: 'decline:barbell_back_squat|decline:barbell_bench_press',
      since: new Date(NOW + DAY).toISOString(),
      notifiedFor: 'decline:barbell_back_squat|decline:barbell_bench_press',
    });
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenLastCalledWith(nextAdviceTime(NOW + DAY), expect.stringContaining('· 1 more'));
  });

  it('snooze hides the advice, moves the reminder a week out, and survives a refresh', () => {
    useGymStore.setState({ sessions: squatDecline() });
    store().refreshDeloadAdvice(NOW);
    const body = schedule.mock.calls[0][1] as string;
    store().snoozeDeloadAdvice(NOW);
    const fireAt = nextAdviceTime(NOW + SNOOZE_DAYS * DAY);
    const until = new Date(fireAt).toISOString();
    expect(store().deloadAdvice).toMatchObject({ snoozedUntil: until, notifiedFor: 'decline:barbell_back_squat' });
    expect(cancel).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenLastCalledWith(fireAt, body);

    // Nothing changes on a plain refresh while snoozed.
    store().refreshDeloadAdvice(NOW + DAY);
    expect(schedule).toHaveBeenCalledTimes(2);

    // A new reason set while snoozed: the reminder keeps its time but gets the new text.
    useGymStore.setState({ sessions: [...squatDecline(), ...benchDecline()] });
    store().refreshDeloadAdvice(NOW + 2 * DAY);
    expect(store().deloadAdvice).toMatchObject({
      key: 'decline:barbell_back_squat|decline:barbell_bench_press',
      snoozedUntil: until,
      notifiedFor: 'decline:barbell_back_squat|decline:barbell_bench_press',
    });
    expect(schedule).toHaveBeenCalledTimes(3);
    expect(schedule).toHaveBeenLastCalledWith(fireAt, expect.stringContaining('· 1 more'));

    // After the snooze the card is back and no further reminder goes out.
    store().refreshDeloadAdvice(fireAt + DAY);
    expect(store().deloadAdvice?.snoozedUntil).toBeUndefined();
    expect(schedule).toHaveBeenCalledTimes(3);
  });

  it('a deload session clears a snoozed reminder too', () => {
    useGymStore.setState({ sessions: squatDecline() });
    store().refreshDeloadAdvice(NOW);
    store().snoozeDeloadAdvice(NOW);
    useGymStore.setState({ sessions: [] });
    store().refreshDeloadAdvice(NOW + DAY);
    expect(store().deloadAdvice).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('snooze without advice does nothing', () => {
    store().snoozeDeloadAdvice(NOW);
    expect(store().deloadAdvice).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('clears the advice and cancels the reminder when the reasons are gone', () => {
    useGymStore.setState({ sessions: squatDecline() });
    store().refreshDeloadAdvice(NOW);
    useGymStore.setState({ sessions: [] });
    store().refreshDeloadAdvice(NOW);
    expect(store().deloadAdvice).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    store().refreshDeloadAdvice(NOW);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('startDeloadSession halves the planned sets and flags the session', () => {
    const plan: WorkoutPlan = {
      id: 'p1',
      name: 'Legs',
      createdAt: '',
      updatedAt: '',
      exercises: [
        { id: 'a', exerciseId: 'barbell_back_squat', sets: 3, reps: 5, restSec: 180 },
        { id: 'b', exerciseId: 'leg_press', sets: 1, reps: 10, restSec: 90 },
        { id: 'c', exerciseId: 'dumbbell_curl', sets: 4, reps: 12, restSec: 60 },
      ],
    };
    useGymStore.setState({ plans: [plan], sessions: squatDecline() });
    const session = store().startDeloadSession('p1');
    expect(store().activeSession).toBe(session);
    expect(session).toMatchObject({ planId: 'p1', planName: 'Legs', deload: true });
    expect(session.exercises.map((e) => [e.targetSets, e.sets.length])).toEqual([
      [2, 2],
      [1, 1],
      [2, 2],
    ]);
    // Weights are prefilled from the last performance like startSession.
    expect(session.exercises[0].sets[0]).toMatchObject({ weight: 94, completed: false });
    expect(store().startSession('p1').deload).toBeUndefined();
  });

  it('importSessions refreshes the advice', () => {
    store().importSessions(squatDecline());
    expect(store().deloadAdvice?.key).toBe('decline:barbell_back_squat');
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('finishSession and deleteSession refresh the advice', () => {
    const now = Date.now();
    const history = lift('barbell_back_squat', [100, 98, 96], now);
    useGymStore.setState({
      sessions: history,
      activeSession: {
        id: 'active',
        planName: 'Plan',
        startedAt: new Date(now).toISOString(),
        exercises: [block('barbell_back_squat', 94)],
      },
    });
    store().finishSession();
    expect(store().deloadAdvice?.key).toBe('decline:barbell_back_squat');
    expect(schedule).toHaveBeenCalledTimes(1);
    store().deleteSession('active');
    expect(store().deloadAdvice).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('store: deload advice persistence', () => {
  it('migration leaves a missing deloadAdvice missing', () => {
    expect(migratePersistedState({ sessions: [] }, PERSIST_VERSION)).toEqual({ sessions: [] });
    expect(PERSIST_VERSION).toBe(2);
  });

  it('hydrating state saved without deloadAdvice keeps it null', async () => {
    useGymStore.setState({ deloadAdvice: null });
    await AsyncStorage.setItem(
      'gym-buddy-v1',
      JSON.stringify({
        state: { seeded: true, plans: [], sessions: [], activeSession: null, settings: DEFAULT_SETTINGS, customExercises: [] },
        version: PERSIST_VERSION,
      }),
    );
    await useGymStore.persist.rehydrate();
    expect(store().hydrated).toBe(true);
    expect(store().deloadAdvice).toBeNull();
  });

  it('persists the advice', () => {
    const advice = { key: 'streak', reasons: [{ kind: 'streak' as const, weeks: 6 }], since: '2026-10-27T12:00:00.000Z' };
    useGymStore.setState({ deloadAdvice: advice });
    const partialize = useGymStore.persist.getOptions().partialize!;
    expect((partialize(store()) as { deloadAdvice: unknown }).deloadAdvice).toEqual(advice);
  });
});
