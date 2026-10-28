import { BUILT_IN_EXERCISES as EXERCISES } from '@/data/exercises';
import type { Exercise } from '@/types';

import { muscleSimilarity, suggestAlternatives } from './alternatives';

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'muscles'>): Exercise {
  return {
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    difficulty: 2,
    cues: [],
    ...partial,
  };
}

const PRESS_MUSCLES = { chest: 1, front_delts: 0.5, triceps: 0.5 };

const FIXTURES: Exercise[] = [
  ex({
    id: 'barbell_bench',
    name: 'Barbell bench press',
    equipment: ['barbell', 'bench'],
    pattern: 'horizontal_push',
    compound: true,
    muscles: PRESS_MUSCLES,
    difficulty: 3,
  }),
  ex({
    id: 'dumbbell_bench',
    name: 'Dumbbell bench press',
    equipment: ['dumbbell', 'bench'],
    pattern: 'horizontal_push',
    compound: true,
    muscles: PRESS_MUSCLES,
    difficulty: 2,
  }),
  ex({
    id: 'machine_press',
    name: 'Machine chest press',
    equipment: ['machine'],
    pattern: 'horizontal_push',
    compound: true,
    muscles: PRESS_MUSCLES,
    difficulty: 1,
  }),
  ex({
    id: 'cable_fly',
    name: 'Cable fly',
    equipment: ['cable'],
    pattern: 'isolation',
    compound: false,
    muscles: { chest: 1, front_delts: 0.3 },
    difficulty: 1,
  }),
  ex({
    id: 'push_up',
    name: 'Push-up',
    equipment: ['bodyweight'],
    pattern: 'horizontal_push',
    compound: true,
    muscles: { chest: 1, triceps: 0.6, front_delts: 0.4, abs: 0.2 },
    difficulty: 2,
  }),
  ex({
    id: 'guillotine_press',
    name: 'Smith guillotine press',
    equipment: ['smith_machine'],
    pattern: 'horizontal_push',
    compound: true,
    muscles: { chest: 1, front_delts: 0.6, triceps: 0.4 },
    difficulty: 5,
  }),
  ex({
    id: 'close_grip',
    name: 'Close-grip press',
    equipment: ['barbell', 'bench'],
    pattern: 'horizontal_push',
    compound: true,
    // Similar vector, but the original's primary (chest) is only 0.4 here.
    muscles: { triceps: 1, chest: 0.4, front_delts: 0.5 },
    difficulty: 3,
  }),
  ex({
    id: 'leg_press',
    name: 'Leg press',
    equipment: ['machine'],
    pattern: 'squat',
    compound: true,
    muscles: { quads: 1, glutes: 0.5, adductors: 0.3 },
    difficulty: 2,
  }),
];
const DB: Record<string, Exercise> = Object.fromEntries(FIXTURES.map((e) => [e.id, e]));

function ids(list: { exercise: Exercise }[]): string[] {
  return list.map((a) => a.exercise.id);
}

describe('muscleSimilarity', () => {
  it('is 1 for identical vectors and symmetric', () => {
    expect(muscleSimilarity(DB.barbell_bench, DB.dumbbell_bench)).toBeCloseTo(1, 10);
    expect(muscleSimilarity(DB.cable_fly, DB.push_up)).toBeCloseTo(muscleSimilarity(DB.push_up, DB.cable_fly), 10);
  });

  it('is 0 for disjoint muscles', () => {
    expect(muscleSimilarity(DB.barbell_bench, DB.leg_press)).toBe(0);
  });

  it('is 0 when either vector is empty', () => {
    const empty = ex({ id: 'e', name: 'Empty', muscles: {} });
    expect(muscleSimilarity(empty, DB.barbell_bench)).toBe(0);
    expect(muscleSimilarity(empty, empty)).toBe(0);
  });

  it('stays within [0, 1] for partial overlap', () => {
    const s = muscleSimilarity(DB.barbell_bench, DB.cable_fly);
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
  });
});

describe('suggestAlternatives', () => {
  it('returns [] for an unknown ID', () => {
    expect(suggestAlternatives('nope', {}, DB)).toEqual([]);
  });

  it('never returns the original', () => {
    expect(ids(suggestAlternatives('barbell_bench', { limit: 100 }, DB))).not.toContain('barbell_bench');
  });

  it('filters out unrelated exercises and ones missing the primary muscle', () => {
    const result = ids(suggestAlternatives('barbell_bench', { limit: 100 }, DB));
    expect(result).not.toContain('leg_press');
    expect(result).not.toContain('close_grip');
    expect(result.sort()).toEqual(['cable_fly', 'dumbbell_bench', 'guillotine_press', 'machine_press', 'push_up']);
  });

  it('respects excludeIds', () => {
    const result = ids(suggestAlternatives('barbell_bench', { excludeIds: ['dumbbell_bench', 'push_up'] }, DB));
    expect(result).not.toContain('dumbbell_bench');
    expect(result).not.toContain('push_up');
    expect(result.length).toBeGreaterThan(0);
  });

  it('ranks a more demanding variant below an easier one', () => {
    const result = suggestAlternatives('barbell_bench', { limit: 100 }, DB);
    const score = (id: string) => result.find((a) => a.exercise.id === id)!.score;
    expect(score('dumbbell_bench')).toBe(1);
    expect(score('guillotine_press')).toBeLessThan(score('dumbbell_bench'));
    // 0.55 × sim + 0.2 + 0.15 + 0 (two points harder) − 0.05 × 2
    const sim = muscleSimilarity(DB.barbell_bench, DB.guillotine_press);
    expect(score('guillotine_press')).toBeCloseTo(0.55 * sim + 0.25, 3);
  });

  it('sorts by score desc, then name asc, and keeps scores in [0, 1]', () => {
    const result = suggestAlternatives('barbell_bench', { limit: 100 }, DB);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const cur = result[i];
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
      if (prev.score === cur.score) expect(prev.exercise.name.localeCompare(cur.exercise.name)).toBeLessThan(0);
    }
    for (const a of result) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(1);
    }
    // Dumbbell bench and machine press tie at 1.0; name breaks the tie.
    expect(ids(result).slice(0, 2)).toEqual(['dumbbell_bench', 'machine_press']);
  });

  it('respects limit (default 5)', () => {
    expect(suggestAlternatives('barbell_bench', {}, DB)).toHaveLength(5);
    expect(suggestAlternatives('barbell_bench', { limit: 2 }, DB)).toHaveLength(2);
    expect(suggestAlternatives('barbell_bench', { limit: 0 }, DB)).toEqual([]);
  });

  it('explains each suggestion', () => {
    const result = suggestAlternatives('barbell_bench', { limit: 100 }, DB);
    const reasons = (id: string) => result.find((a) => a.exercise.id === id)!.reasons;
    expect(reasons('dumbbell_bench')).toEqual([
      'Same movement pattern',
      'Hits Chest like the original',
      'Easier',
      'Needs: Dumbbells, Bench',
    ]);
    expect(reasons('cable_fly')).toEqual([
      'Different pattern, same muscles',
      'Hits Chest like the original',
      'Easier',
      'Needs: Cable station',
    ]);
    expect(reasons('guillotine_press')).toContain('More demanding');
    expect(reasons('push_up')).toContain('No equipment needed');
  });

  it('reports the same difficulty', () => {
    const db = { ...DB, twin: { ...DB.barbell_bench, id: 'twin', name: 'Twin' } };
    const twin = suggestAlternatives('barbell_bench', { limit: 100 }, db).find((a) => a.exercise.id === 'twin')!;
    expect(twin.reasons).toContain('Same difficulty');
  });
});

describe('database invariants (real exercise DB)', () => {
  it.each(EXERCISES.map((e) => [e.id]))('%s: suggestions are well-formed', (id) => {
    const limit = 5;
    const result = suggestAlternatives(id, { limit });
    expect(result.length).toBeLessThanOrEqual(limit);
    expect(ids(result)).not.toContain(id);
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(1);
      if (i > 0) expect(result[i - 1].score).toBeGreaterThanOrEqual(a.score);
      expect(a.reasons.length).toBeGreaterThan(0);
    }
  });
});
