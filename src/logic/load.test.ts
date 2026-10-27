import { getExerciseMap } from '@/data/exercises';
import type { Exercise, SessionExercise, WorkoutSession } from '@/types';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/types';

import { emptyCoverage, type Coverage } from './coverage';
import { LOAD_THRESHOLDS, loadHints, loadLevel, recentMuscleLoad } from './load';

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'muscles'>): Exercise {
  return {
    name: partial.id,
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    formDifficulty: 2,
    injuryRisk: 2,
    cues: [],
    ...partial,
  };
}

const DB: Record<string, Exercise> = Object.fromEntries(
  [
    ex({ id: 'bench', muscles: { chest: 1, triceps: 0.5 }, equipment: ['barbell', 'bench'], injuryRisk: 4 }),
    ex({ id: 'pushup', muscles: { chest: 1, triceps: 0.5 }, injuryRisk: 1, formDifficulty: 2 }),
    ex({ id: 'db_press', muscles: { chest: 1 }, equipment: ['dumbbell', 'bench'], injuryRisk: 1, formDifficulty: 1 }),
    ex({ id: 'cable_fly', muscles: { chest: 1 }, equipment: ['cable'], injuryRisk: 1, formDifficulty: 3 }),
    ex({ id: 'pec_deck', muscles: { chest: 0.9 }, equipment: ['machine'], injuryRisk: 1, formDifficulty: 1 }),
    ex({ id: 'curl', muscles: { biceps: 1, forearms: 0.3 }, injuryRisk: 1, formDifficulty: 1 }),
  ].map((e) => [e.id, e]),
);

const NOW = Date.parse('2026-10-27T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function sessionExercise(exerciseId: string, completed: number, skipped = 0): SessionExercise {
  return {
    id: `${exerciseId}-${completed}-${skipped}`,
    exerciseId,
    targetSets: completed + skipped,
    targetReps: 10,
    restSec: 90,
    sets: [
      ...Array.from({ length: completed }, () => ({ reps: 10, weight: 20, completed: true })),
      ...Array.from({ length: skipped }, () => ({ reps: 10, weight: 20, completed: false })),
    ],
  };
}

function session(id: string, daysAgo: number | undefined, exercises: SessionExercise[]): WorkoutSession {
  const finished = daysAgo === undefined ? undefined : new Date(NOW - daysAgo * DAY).toISOString();
  return {
    id,
    planName: id,
    startedAt: new Date(NOW - (daysAgo ?? 0) * DAY - 3600_000).toISOString(),
    finishedAt: finished,
    exercises,
  };
}

function coverage(values: Partial<Coverage> = {}): Coverage {
  return { ...emptyCoverage(), ...values };
}

describe('loadLevel', () => {
  it('buckets at the thresholds', () => {
    expect(loadLevel(0)).toBe('none');
    expect(loadLevel(-1)).toBe('none');
    expect(loadLevel(0.3)).toBe('low');
    expect(loadLevel(LOAD_THRESHOLDS.low - 0.01)).toBe('low');
    expect(loadLevel(LOAD_THRESHOLDS.low)).toBe('good');
    expect(loadLevel(LOAD_THRESHOLDS.high)).toBe('good');
    expect(loadLevel(LOAD_THRESHOLDS.high + 0.01)).toBe('high');
  });
});

describe('recentMuscleLoad', () => {
  it('counts sessions finished within the window and drops older ones', () => {
    const load = recentMuscleLoad(
      [session('inside', 6.9, [sessionExercise('bench', 3)]), session('outside', 7.1, [sessionExercise('bench', 5)])],
      NOW,
      DB,
    );
    expect(load.chest).toBe(3);
    expect(load.triceps).toBe(1.5);
  });

  it('ignores unfinished sessions', () => {
    const load = recentMuscleLoad([session('active', undefined, [sessionExercise('bench', 4)])], NOW, DB);
    expect(load.chest).toBe(0);
  });

  it('only counts completed sets', () => {
    const load = recentMuscleLoad([session('mixed', 1, [sessionExercise('curl', 2, 3)])], NOW, DB);
    expect(load.biceps).toBe(2);
    expect(load.forearms).toBe(0.6);
  });

  it('sums across sessions in the window', () => {
    const load = recentMuscleLoad(
      [session('a', 1, [sessionExercise('bench', 3)]), session('b', 3, [sessionExercise('pushup', 2)])],
      NOW,
      DB,
    );
    expect(load.chest).toBe(5);
  });

  it('defaults to the real database and Date.now()', () => {
    const recent: WorkoutSession = {
      id: 'x',
      planName: 'x',
      startedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      finishedAt: new Date(Date.now() - 3600_000).toISOString(),
      exercises: [sessionExercise('barbell_bench_press', 3)],
    };
    expect(recentMuscleLoad([recent]).chest).toBe(3);
  });
});

describe('loadHints', () => {
  const ALL = [...EQUIPMENT];

  it('never includes good muscles', () => {
    const load = coverage(Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 10])));
    expect(loadHints(load, ALL, DB)).toEqual([]);
    const hints = loadHints(coverage({ chest: 10 }), ALL, DB);
    expect(hints.find((h) => h.muscle === 'chest')).toBeUndefined();
  });

  it('orders high (desc), then none, then low (asc)', () => {
    const base = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 10]));
    const load = coverage({ ...base, chest: 22, quads: 30, biceps: 0, calves: 0, lats: 3, abs: 1 });
    const hints = loadHints(load, ALL, DB);
    expect(hints.map((h) => [h.muscle, h.level])).toEqual([
      ['quads', 'high'],
      ['chest', 'high'],
      ['biceps', 'none'],
      ['calves', 'none'],
      ['abs', 'low'],
      ['lats', 'low'],
    ]);
    expect(hints[0].effectiveSets).toBe(30);
  });

  it('gives no suggestions for high muscles', () => {
    const [hint] = loadHints(coverage({ chest: 25 }), ALL, DB);
    expect(hint).toMatchObject({ muscle: 'chest', level: 'high', suggestions: [] });
  });

  it('suggests up to two 1.0-primary exercises, safest first', () => {
    const chest = loadHints(coverage({ chest: 1 }), ALL, DB).find((h) => h.muscle === 'chest')!;
    expect(chest.level).toBe('low');
    // Ranked by injuryRisk then formDifficulty; pec_deck (0.9) never qualifies.
    expect(chest.suggestions.map((e) => e.id)).toEqual(['db_press', 'pushup']);
  });

  it('respects available equipment', () => {
    const chest = loadHints(coverage(), ['bodyweight', 'barbell', 'bench', 'machine'], DB).find(
      (h) => h.muscle === 'chest',
    )!;
    expect(chest.level).toBe('none');
    expect(chest.suggestions.map((e) => e.id)).toEqual(['pushup', 'bench']);
    const none = loadHints(coverage(), ['machine'], DB).find((h) => h.muscle === 'chest')!;
    expect(none.suggestions).toEqual([]);
  });

  it('with the real database and all equipment, every muscle gets a suggestion', () => {
    const hints = loadHints(emptyCoverage(), ALL);
    expect(hints).toHaveLength(MUSCLE_GROUPS.length);
    for (const h of hints) {
      expect(h.level).toBe('none');
      expect(h.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(h.suggestions.length).toBeLessThanOrEqual(2);
      for (const s of h.suggestions) expect(getExerciseMap()[s.id].muscles[h.muscle]).toBe(1);
    }
  });

  it('with the real database, bodyweight-only suggestions need nothing else', () => {
    for (const h of loadHints(emptyCoverage(), ['bodyweight'])) {
      for (const s of h.suggestions) expect(s.equipment).toEqual(['bodyweight']);
    }
  });
});
