import type { WorkoutSession } from '@/types';

import { estimateOneRepMax, estimateWeightAtReps, exerciseStats, repRange } from './stats';

type S = [reps: number, weight: number, completed: boolean];

const NOW = Date.parse('2026-03-01T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

function session(id: string, finishedAt: string | undefined, exerciseId: string, sets: S[]): WorkoutSession {
  return {
    id,
    planName: 'P',
    startedAt: finishedAt ?? daysAgo(0),
    finishedAt,
    exercises: [
      {
        id: `${id}-e`,
        exerciseId,
        targetSets: sets.length,
        targetReps: 6,
        restSec: 60,
        sets: sets.map(([reps, weight, completed]) => ({ reps, weight, completed })),
      },
    ],
  };
}

describe('repRange', () => {
  it.each([
    [6, 5, 7],
    [8, 6, 10],
    [10, 8, 12],
    [15, 12, 18],
    [3, 2, 4],
  ])('target %i → %i–%i', (target, min, max) => {
    expect(repRange(target)).toEqual({ min, max });
  });

  it('clamps the lower bound at 1 for tiny targets', () => {
    expect(repRange(1)).toEqual({ min: 1, max: 2 });
    expect(repRange(2)).toEqual({ min: 1, max: 3 });
  });
});

describe('Epley', () => {
  it('estimates a 1RM, treating a single rep as the 1RM itself', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('round-trips and converts between rep counts', () => {
    expect(estimateWeightAtReps(100, 1, 1)).toBe(100);
    // 133.33 / (1 + 5/30) = 114.29 (the brief's "about 115.6" does not match Epley).
    expect(estimateWeightAtReps(100, 10, 5)).toBeCloseTo(114.3, 1);
    expect(estimateWeightAtReps(100, 10, 1)).toBeCloseTo(133.3, 1);
  });
});

describe('exerciseStats', () => {
  it('computes best, last and 30-day average from in-range sets', () => {
    const sessions = [
      session('new', daysAgo(2), 'squat', [[6, 90, true], [6, 85, true], [12, 120, true]]),
      session('mid', daysAgo(10), 'squat', [[5, 87.5, true], [7, 87.5, true]]),
      session('old', daysAgo(60), 'squat', [[6, 100, true]]),
    ];
    const stats = exerciseStats(sessions, 'squat', 6, NOW);
    expect(stats).toEqual({
      range: { min: 5, max: 7 },
      best: 100, // the 60-day-old session still counts for best
      last: 90,
      avg30d: 87.5, // (90 + 85 + 87.5 + 87.5) / 4, without the old 100
      approximate: false,
      sampleCount: 5,
    });
  });

  it('uses the most recent session with in-range sets for last, not the heaviest', () => {
    const sessions = [
      session('heavy', daysAgo(20), 'squat', [[6, 110, true]]),
      session('recent', daysAgo(1), 'squat', [[6, 80, true], [6, 82.5, true]]),
      session('outOfRangeOnly', daysAgo(0), 'squat', [[15, 60, true]]),
    ];
    const stats = exerciseStats(sessions, 'squat', 6, NOW);
    expect(stats?.last).toBe(82.5);
    expect(stats?.best).toBe(110);
  });

  it('leaves avg30d undefined when all sessions are older than 30 days', () => {
    const stats = exerciseStats([session('old', daysAgo(45), 'squat', [[6, 100, true]])], 'squat', 6, NOW);
    expect(stats?.avg30d).toBeUndefined();
    expect(stats?.last).toBe(100);
  });

  it('approximates from other rep counts when nothing is in range', () => {
    const sessions = [
      session('a', daysAgo(3), 'squat', [[10, 100, true]]),
      session('b', daysAgo(40), 'squat', [[1, 140, true]]),
    ];
    const stats = exerciseStats(sessions, 'squat', 5, NOW);
    // 100×10 → 133.33 / (35/30) = 114.3 at 5 reps; 140×1 → 140 / (35/30) = 120.0
    expect(stats).toEqual({
      range: { min: 4, max: 6 },
      best: 120,
      last: 114.3,
      avg30d: 114.3,
      approximate: true,
      sampleCount: 2,
    });
  });

  it('ignores uncompleted sets, zero-weight sets and unfinished sessions', () => {
    const sessions = [
      session('open', undefined, 'squat', [[6, 200, true]]),
      session('done', daysAgo(1), 'squat', [[6, 150, false], [6, 0, true], [0, 90, true], [6, 70, true]]),
    ];
    const stats = exerciseStats(sessions, 'squat', 6, NOW);
    expect(stats).toMatchObject({ best: 70, last: 70, avg30d: 70, approximate: false, sampleCount: 1 });
  });

  it('returns undefined for an unknown exercise or no usable sets', () => {
    const sessions = [session('a', daysAgo(1), 'squat', [[6, 100, true]])];
    expect(exerciseStats(sessions, 'bench', 6, NOW)).toBeUndefined();
    expect(exerciseStats([session('b', daysAgo(1), 'bench', [[6, 0, true]])], 'bench', 6, NOW)).toBeUndefined();
  });

  it('does not approximate when any session has an in-range set', () => {
    const sessions = [
      session('other', daysAgo(1), 'squat', [[12, 100, true]]),
      session('match', daysAgo(5), 'squat', [[6, 80, true]]),
    ];
    const stats = exerciseStats(sessions, 'squat', 6, NOW);
    expect(stats).toMatchObject({ best: 80, last: 80, avg30d: 80, approximate: false, sampleCount: 1 });
  });

  it('rounds output weights to one decimal', () => {
    const sessions = [session('a', daysAgo(1), 'squat', [[6, 80.25, true], [6, 80.3, true], [6, 80.3, true]])];
    const stats = exerciseStats(sessions, 'squat', 6, NOW);
    expect(stats?.best).toBe(80.3);
    expect(stats?.avg30d).toBe(80.3); // 80.2833 → 80.3
  });
});
