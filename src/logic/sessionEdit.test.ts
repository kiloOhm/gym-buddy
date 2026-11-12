import {
  appendExercise,
  appendSet,
  removeExercise,
  removeSet,
  setDuration,
  shiftStart,
  sortNewestFirst,
  updateSet,
} from './sessionEdit';
import type { WorkoutSession } from '@/types';

const base: WorkoutSession = {
  id: 's1',
  planName: 'Push',
  startedAt: '2026-11-10T18:00:00.000Z',
  finishedAt: '2026-11-10T19:00:00.000Z',
  exercises: [
    {
      id: 'e1',
      exerciseId: 'barbell_bench_press',
      targetSets: 2,
      targetReps: 8,
      restSec: 120,
      sets: [
        { weight: 80, reps: 8, completed: true },
        { weight: 80, reps: 6, completed: false },
      ],
    },
    { id: 'e2', exerciseId: 'push_up', targetSets: 1, targetReps: 15, restSec: 60, sets: [] },
  ],
};

describe('set edits', () => {
  it('patches one set without touching the input', () => {
    const next = updateSet(base, 'e1', 1, { reps: 7, completed: true });
    expect(next.exercises[0].sets[1]).toEqual({ weight: 80, reps: 7, completed: true });
    expect(next.exercises[0].sets[0]).toBe(base.exercises[0].sets[0]);
    expect(base.exercises[0].sets[1].reps).toBe(6);
  });

  it('appends a done copy of the last set, or the target reps when there is none', () => {
    expect(appendSet(base, 'e1').exercises[0].sets[2]).toEqual({ weight: 80, reps: 6, completed: true });
    expect(appendSet(base, 'e2').exercises[1].sets).toEqual([{ weight: 0, reps: 15, completed: true }]);
  });

  it('removes a set by index and an exercise by id', () => {
    expect(removeSet(base, 'e1', 0).exercises[0].sets).toEqual([{ weight: 80, reps: 6, completed: false }]);
    expect(removeExercise(base, 'e1').exercises.map((e) => e.id)).toEqual(['e2']);
  });
});

describe('appendExercise', () => {
  const earlier: WorkoutSession = {
    id: 'old',
    planName: 'Legs',
    startedAt: '2026-11-01T18:00:00.000Z',
    finishedAt: '2026-11-01T19:00:00.000Z',
    exercises: [
      {
        id: 'x',
        exerciseId: 'barbell_back_squat',
        targetSets: 2,
        targetReps: 5,
        restSec: 180,
        sets: [
          { weight: 100, reps: 5, completed: true },
          { weight: 100, reps: 4, completed: false },
        ],
      },
    ],
  };
  const later: WorkoutSession = { ...earlier, id: 'new', startedAt: '2026-11-11T18:00:00.000Z', finishedAt: '2026-11-11T19:00:00.000Z' };

  it('copies the completed sets of the last performance before this workout, all marked done', () => {
    const laterHeavier = {
      ...later,
      exercises: [{ ...earlier.exercises[0], sets: [{ weight: 120, reps: 5, completed: true }] }],
    };
    const next = appendExercise(base, 'barbell_back_squat', [laterHeavier, earlier, base]);
    const added = next.exercises[2];
    expect(added.exerciseId).toBe('barbell_back_squat');
    expect(added.sets).toEqual([{ weight: 100, reps: 5, completed: true }]);
    expect(added.targetSets).toBe(1);
    expect(added.targetReps).toBe(5);
  });

  it('falls back to three empty sets of ten', () => {
    const added = appendExercise(base, 'plank', []).exercises[2];
    expect(added.sets).toEqual([
      { weight: 0, reps: 10, completed: true },
      { weight: 0, reps: 10, completed: true },
      { weight: 0, reps: 10, completed: true },
    ]);
  });
});

describe('times', () => {
  it('shifts start and finish together', () => {
    const next = shiftStart(base, -24 * 60 - 30);
    expect(next.startedAt).toBe('2026-11-09T17:30:00.000Z');
    expect(next.finishedAt).toBe('2026-11-09T18:30:00.000Z');
  });

  it('sets the duration from the start, at least one minute', () => {
    expect(setDuration(base, 45).finishedAt).toBe('2026-11-10T18:45:00.000Z');
    expect(setDuration(base, 0).finishedAt).toBe('2026-11-10T18:01:00.000Z');
  });
});

describe('sortNewestFirst', () => {
  it('orders by finish time, newest first, stable for ties', () => {
    const s = (id: string, finishedAt?: string): WorkoutSession => ({ id, planName: id, startedAt: '', finishedAt, exercises: [] });
    const sorted = sortNewestFirst([s('a', '2026-01-01'), s('b', '2026-01-03'), s('c', '2026-01-01'), s('d')]);
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']);
  });
});
