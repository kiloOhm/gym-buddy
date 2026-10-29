import type { Exercise, SessionExercise, WorkoutSession } from '@/types';

import {
  adviceKey,
  deloadReasons,
  describeReason,
  inDeloadCooldown,
  nextAdviceTime,
  strengthDecline,
  sustainedHighLoad,
  trainingStreak,
  type DeloadReason,
} from './deload';

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'muscles'>): Exercise {
  return {
    name: partial.id,
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    difficulty: 2,
    cues: [],
    ...partial,
  };
}

const DB: Record<string, Exercise> = Object.fromEntries(
  [
    ex({ id: 'squat', name: 'Barbell back squat', muscles: { quads: 1, glutes: 0.6 } }),
    ex({ id: 'goblet_squat', name: 'Goblet squat', muscles: { quads: 1, glutes: 0.5 } }),
    ex({ id: 'bench', name: 'Bench press', muscles: { chest: 1, triceps: 0.5 } }),
    ex({ id: 'curl', name: 'Curl', muscles: { biceps: 1, forearms: 0.3 } }),
  ].map((e) => [e.id, e]),
);

const NOW = Date.parse('2026-10-27T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

type SetSpec = [weight: number, reps: number, completed?: boolean];

function block(exerciseId: string, sets: SetSpec[], substitutedFor?: string): SessionExercise {
  return {
    id: `${exerciseId}-${Math.random()}`,
    exerciseId,
    ...(substitutedFor ? { substitutedFor } : {}),
    targetSets: sets.length,
    targetReps: 5,
    restSec: 90,
    sets: sets.map(([weight, reps, completed = true]) => ({ weight, reps, completed })),
  };
}

let nextId = 0;
function session(finishedAt: number | undefined, exercises: SessionExercise[], deload = false): WorkoutSession {
  return {
    id: `s${nextId++}`,
    planName: 'Plan',
    startedAt: new Date((finishedAt ?? NOW) - 3_600_000).toISOString(),
    ...(finishedAt !== undefined ? { finishedAt: new Date(finishedAt).toISOString() } : {}),
    exercises,
    ...(deload ? { deload: true } : {}),
  };
}

/** One session per weight, oldest first, three days apart and ending a day before NOW. */
function lift(exerciseId: string, weights: number[], reps = 1): WorkoutSession[] {
  return weights
    .map((w, i) => session(NOW - DAY - (weights.length - 1 - i) * 3 * DAY, [block(exerciseId, [[w, reps]])]))
    .reverse(); // the store keeps sessions newest first
}

/** One session per week (a day into each window), `sets[k]` completed sets of curls in window k. */
function weekly(sets: number[], deloadWeeks: number[] = []): WorkoutSession[] {
  return sets.map((n, k) =>
    session(NOW - k * WEEK - DAY, [block('curl', Array.from({ length: n }, (): SetSpec => [10, 10]))], deloadWeeks.includes(k)),
  );
}

describe('strengthDecline', () => {
  it('is undefined without history', () => {
    expect(strengthDecline([], 'squat', NOW)).toBeUndefined();
    expect(deloadReasons([], NOW, DB)).toEqual([]);
  });

  it('reports four strictly falling sessions with at least 5 % total drop', () => {
    expect(strengthDecline(lift('squat', [100, 98, 96, 94]), 'squat', NOW)).toEqual({
      kind: 'decline',
      exerciseId: 'squat',
      from: 100,
      to: 94,
    });
  });

  it('uses the Epley estimate of the top set, rounded to one decimal', () => {
    // 100 × 5 → 116.67, 94 × 5 → 109.67
    expect(strengthDecline(lift('squat', [100, 98, 96, 94], 5), 'squat', NOW)).toMatchObject({ from: 116.7, to: 109.7 });
  });

  it('only looks at the latest four sessions', () => {
    expect(strengthDecline(lift('squat', [90, 100, 98, 96, 94]), 'squat', NOW)).toMatchObject({ from: 100, to: 94 });
    expect(strengthDecline(lift('squat', [100, 98, 96, 94, 95]), 'squat', NOW)).toBeUndefined();
  });

  it('needs four sessions', () => {
    expect(strengthDecline(lift('squat', [100, 95, 90]), 'squat', NOW)).toBeUndefined();
  });

  it('needs a strict fall every session', () => {
    expect(strengthDecline(lift('squat', [100, 98, 98, 90]), 'squat', NOW)).toBeUndefined();
    expect(strengthDecline(lift('squat', [100, 97, 99, 90]), 'squat', NOW)).toBeUndefined();
  });

  it('needs a total drop of at least 5 %', () => {
    expect(strengthDecline(lift('squat', [100, 99, 97, 95.5]), 'squat', NOW)).toBeUndefined();
    expect(strengthDecline(lift('squat', [100, 99, 97, 95]), 'squat', NOW)).toMatchObject({ to: 95 });
  });

  it('ignores deload, unfinished and unparseable sessions and incomplete or empty sets', () => {
    const history = [
      ...lift('squat', [100, 98, 96, 94]),
      session(NOW - 12 * 3600_000, [block('squat', [[50, 5]])], true),
      session(undefined, [block('squat', [[40, 5]])]),
      { ...session(NOW, [block('squat', [[30, 5]])]), finishedAt: 'not a date' },
      session(NOW - 6 * 3600_000, [block('squat', [[200, 5, false], [0, 5], [80, 0]])]),
    ];
    expect(strengthDecline(history, 'squat', NOW)).toMatchObject({ from: 100, to: 94 });
  });

  it('takes the best set over every block of the lift in a session', () => {
    const history = lift('squat', [100, 98, 96, 94]);
    history[0] = { ...history[0], exercises: [...history[0].exercises, block('squat', [[99, 1]])] };
    expect(strengthDecline(history, 'squat', NOW)).toBeUndefined();
  });

  it('ignores a decline whose latest session is older than 28 days', () => {
    const history = lift('squat', [100, 98, 96, 94]); // latest session a day before NOW
    expect(strengthDecline(history, 'squat', NOW + 27 * DAY)).toMatchObject({ to: 94 });
    expect(strengthDecline(history, 'squat', NOW + 28 * DAY)).toBeUndefined();
    expect(deloadReasons(history, NOW + 28 * DAY, DB)).toEqual([]);
  });

  it('counts a substitution under the exercise actually done', () => {
    const history = [100, 98, 96, 94]
      .map((w, i) => session(NOW - (4 - i) * DAY, [block('goblet_squat', [[w, 1]], 'squat')]))
      .reverse();
    expect(strengthDecline(history, 'squat', NOW)).toBeUndefined();
    expect(strengthDecline(history, 'goblet_squat', NOW)).toMatchObject({ exerciseId: 'goblet_squat' });
  });
});

describe('sustainedHighLoad', () => {
  const heavy = (at: number) => session(at, [block('curl', Array.from({ length: 21 }, (): SetSpec => [10, 10]))]);

  it('flags a muscle that was high in both of the last two weeks', () => {
    expect(sustainedHighLoad([heavy(NOW - DAY), heavy(NOW - 8 * DAY)], NOW, DB)).toEqual([
      { kind: 'load', muscle: 'biceps', weeks: 2 },
    ]);
  });

  it('counts deload sessions as training', () => {
    const history = [heavy(NOW - DAY), { ...heavy(NOW - 8 * DAY), deload: true }];
    expect(sustainedHighLoad(history, NOW, DB)).toHaveLength(1);
  });

  it('ignores a single high week', () => {
    expect(sustainedHighLoad([heavy(NOW - DAY)], NOW, DB)).toEqual([]);
    expect(sustainedHighLoad([heavy(NOW - 8 * DAY)], NOW, DB)).toEqual([]);
  });

  it('ignores exactly 20 effective sets (good, not high)', () => {
    const twenty = (at: number) => session(at, [block('curl', Array.from({ length: 20 }, (): SetSpec => [10, 10]))]);
    expect(sustainedHighLoad([twenty(NOW - DAY), twenty(NOW - 8 * DAY)], NOW, DB)).toEqual([]);
  });
});

describe('trainingStreak', () => {
  it('reports six training weeks without a lighter week', () => {
    expect(trainingStreak(weekly([10, 10, 10, 10, 10, 10]), NOW)).toEqual({ kind: 'streak', weeks: 6 });
  });

  it('needs six weeks', () => {
    expect(trainingStreak(weekly([10, 10, 10, 10, 10]), NOW)).toBeUndefined();
    expect(trainingStreak([], NOW)).toBeUndefined();
  });

  it('stops at the first week without training', () => {
    const history = weekly([10, 10, 10, 10, 10, 10, 10]).filter((_, k) => k !== 2);
    expect(trainingStreak(history, NOW)).toBeUndefined();
  });

  it('is broken by a week with a deload session', () => {
    expect(trainingStreak(weekly([10, 10, 10, 10, 10, 10, 10], [2]), NOW)).toBeUndefined();
    expect(trainingStreak(weekly([10, 10, 10, 10, 10, 10, 10, 10], [7]), NOW)).toEqual({ kind: 'streak', weeks: 7 });
  });

  it('is broken by a week under 60 % of the median', () => {
    expect(trainingStreak(weekly([10, 5, 10, 10, 10, 10, 10]), NOW)).toBeUndefined();
    expect(trainingStreak(weekly([10, 10, 10, 10, 10, 10, 6]), NOW)).toEqual({ kind: 'streak', weeks: 7 });
  });

  it('sums every session in a week and only counts completed sets', () => {
    const history = weekly([10, 10, 10, 10, 10, 10]);
    // Week 1: 3 completed (7 skipped) is under 60 % of the median 10; 4 more in a second session make it 7.
    history[1] = session(NOW - WEEK - DAY, [block('curl', [...Array(3).fill([10, 10]), ...Array(7).fill([10, 10, false])])]);
    expect(trainingStreak(history, NOW)).toBeUndefined();
    history.push(session(NOW - WEEK - 2 * DAY, [block('curl', Array(4).fill([10, 10]))]));
    expect(trainingStreak(history, NOW)).toEqual({ kind: 'streak', weeks: 6 });
  });

  it('reports the length of longer streaks, capped at 26 weeks', () => {
    expect(trainingStreak(weekly(Array(9).fill(10)), NOW)).toEqual({ kind: 'streak', weeks: 9 });
    expect(trainingStreak(weekly(Array(40).fill(10)), NOW)).toEqual({ kind: 'streak', weeks: 26 });
  });

  it('puts a session exactly seven days old into the previous week', () => {
    const history = weekly([10, 10, 10, 10, 10, 10]);
    history[0] = session(NOW - WEEK, [block('curl', Array(10).fill([10, 10]))]);
    // Week 0 is now empty.
    expect(trainingStreak(history, NOW)).toBeUndefined();
  });
});

describe('cooldown and deloadReasons', () => {
  const declining = lift('squat', [100, 98, 96, 94]);

  it('returns nothing within 14 days of a finished deload session', () => {
    const recent = session(NOW - 3 * DAY, [block('squat', [[60, 5]])], true);
    expect(inDeloadCooldown([recent], NOW)).toBe(true);
    expect(deloadReasons([...declining, recent], NOW, DB)).toEqual([]);
  });

  it('gives advice again after the cooldown', () => {
    const old = session(NOW - 15 * DAY, [block('squat', [[60, 5]])], true);
    expect(inDeloadCooldown([old], NOW)).toBe(false);
    expect(deloadReasons([...declining, old], NOW, DB)).toHaveLength(1);
  });

  it('ignores unfinished deload sessions for the cooldown', () => {
    expect(inDeloadCooldown([session(undefined, [], true)], NOW)).toBe(false);
  });

  it('sorts declines by exercise id, then load in muscle order, then the streak', () => {
    const heavy = (at: number) =>
      session(at, [
        block('curl', Array.from({ length: 21 }, (): SetSpec => [10, 10])),
        block('bench', Array.from({ length: 21 }, (): SetSpec => [0, 10])),
      ]);
    const history = [
      ...lift('squat', [100, 98, 96, 94]),
      ...lift('bench', [80, 78, 76, 74]),
      heavy(NOW - 2 * DAY),
      heavy(NOW - 9 * DAY),
      ...weekly([10, 10, 10, 10, 10, 10]).slice(2),
    ];
    const reasons = deloadReasons(history, NOW, DB);
    expect(adviceKey(reasons)).toBe('decline:bench|decline:squat|load:chest|load:biceps|streak');
  });
});

describe('adviceKey', () => {
  it('is empty for no reasons', () => {
    expect(adviceKey([])).toBe('');
  });

  it('joins the reasons in order', () => {
    const reasons: DeloadReason[] = [
      { kind: 'decline', exerciseId: 'barbell_back_squat', from: 102, to: 95 },
      { kind: 'load', muscle: 'quads', weeks: 2 },
      { kind: 'streak', weeks: 8 },
    ];
    expect(adviceKey(reasons)).toBe('decline:barbell_back_squat|load:quads|streak');
  });
});

describe('describeReason', () => {
  it('describes every kind', () => {
    expect(describeReason({ kind: 'decline', exerciseId: 'squat', from: 102, to: 95.5 }, DB, 'kg')).toBe(
      'Barbell back squat: estimated max fell 3 sessions in a row (102 → 95.5 kg)',
    );
    expect(describeReason({ kind: 'load', muscle: 'quads', weeks: 2 }, DB, 'kg')).toBe(
      'Quads: over 20 effective sets a week for 2 weeks',
    );
    expect(describeReason({ kind: 'streak', weeks: 6 }, DB, 'lb')).toBe('6 weeks of training without a lighter week');
  });

  it('names an unknown exercise', () => {
    expect(describeReason({ kind: 'decline', exerciseId: 'gone', from: 225, to: 200 }, DB, 'lb')).toBe(
      'Unknown exercise: estimated max fell 3 sessions in a row (225 → 200 lb)',
    );
  });
});

describe('nextAdviceTime', () => {
  it('reminds today at 09:00 before 08:00', () => {
    expect(nextAdviceTime(new Date(2026, 9, 29, 7, 59, 59, 999).getTime())).toBe(new Date(2026, 9, 29, 9).getTime());
    expect(nextAdviceTime(new Date(2026, 9, 29, 0, 0).getTime())).toBe(new Date(2026, 9, 29, 9).getTime());
  });

  it('reminds tomorrow at 09:00 from 08:00 on', () => {
    expect(nextAdviceTime(new Date(2026, 9, 29, 8, 0).getTime())).toBe(new Date(2026, 9, 30, 9).getTime());
    expect(nextAdviceTime(new Date(2026, 9, 29, 23, 59, 59).getTime())).toBe(new Date(2026, 9, 30, 9).getTime());
    expect(nextAdviceTime(new Date(2026, 11, 31, 18, 0).getTime())).toBe(new Date(2027, 0, 1, 9).getTime());
  });

  it('zeroes minutes, seconds and milliseconds', () => {
    const d = new Date(nextAdviceTime(new Date(2026, 9, 29, 14, 37, 12, 345).getTime()));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([9, 0, 0, 0]);
  });
});
