import type { WorkoutSession } from '@/types';

import { bestWeight, lastPerformance } from './history';

function session(id: string, finishedAt: string, exerciseId: string, sets: [number, number, boolean][]): WorkoutSession {
  return {
    id,
    planName: 'P',
    startedAt: finishedAt,
    finishedAt,
    exercises: [
      {
        id: `${id}-e`,
        exerciseId,
        targetSets: sets.length,
        targetReps: 10,
        restSec: 60,
        sets: sets.map(([reps, weight, completed]) => ({ reps, weight, completed })),
      },
    ],
  };
}

describe('lastPerformance', () => {
  it('returns the newest finished session with completed sets', () => {
    const sessions = [
      session('old', '2026-01-01T10:00:00Z', 'squat', [[10, 60, true]]),
      session('new', '2026-02-01T10:00:00Z', 'squat', [[8, 80, true], [8, 80, false]]),
    ];
    const lp = lastPerformance(sessions, 'squat');
    expect(lp?.date).toBe('2026-02-01T10:00:00Z');
    expect(lp?.sets).toEqual([{ reps: 8, weight: 80, completed: true }]);
  });

  it('skips sessions where nothing was completed', () => {
    const sessions = [session('s', '2026-01-01T10:00:00Z', 'squat', [[10, 60, false]])];
    expect(lastPerformance(sessions, 'squat')).toBeUndefined();
  });
});

describe('bestWeight', () => {
  it('finds the heaviest completed set', () => {
    const sessions = [
      session('a', '2026-01-01T10:00:00Z', 'squat', [[10, 60, true], [5, 100, false]]),
      session('b', '2026-01-02T10:00:00Z', 'squat', [[5, 90, true]]),
    ];
    expect(bestWeight(sessions, 'squat')).toBe(90);
    expect(bestWeight(sessions, 'bench')).toBeUndefined();
  });
});
