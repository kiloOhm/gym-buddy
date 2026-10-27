import { BUILT_IN_EXERCISES as EXERCISES } from '@/data/exercises';
import type { Exercise } from '@/types';
import { MUSCLE_GROUPS } from '@/types';

import { computeCoverage, coverageLevel, emptyCoverage, summarizePlan } from './coverage';

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
    ex({ id: 'squat', muscles: { quads: 1, glutes: 0.7, lower_back: 0.3 }, formDifficulty: 4, injuryRisk: 4 }),
    ex({ id: 'bench', muscles: { chest: 1, front_delts: 0.5, triceps: 0.5 }, formDifficulty: 3, injuryRisk: 4 }),
    ex({ id: 'curl', muscles: { biceps: 1, forearms: 0.3 }, formDifficulty: 1, injuryRisk: 1 }),
    ex({ id: 'thirds', muscles: { abs: 0.1 }, formDifficulty: 2, injuryRisk: 3 }),
  ].map((e) => [e.id, e]),
);

describe('emptyCoverage', () => {
  it('has every muscle at zero', () => {
    const c = emptyCoverage();
    expect(Object.keys(c).sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect(Object.values(c).every((v) => v === 0)).toBe(true);
  });
});

describe('computeCoverage', () => {
  it('sums sets × activation per muscle', () => {
    const c = computeCoverage(
      [
        { exerciseId: 'squat', sets: 4 },
        { exerciseId: 'bench', sets: 3 },
        { exerciseId: 'squat', sets: 2 },
      ],
      DB,
    );
    expect(c.quads).toBe(6);
    expect(c.glutes).toBe(4.2);
    expect(c.lower_back).toBe(1.8);
    expect(c.chest).toBe(3);
    expect(c.triceps).toBe(1.5);
    expect(c.biceps).toBe(0);
  });

  it('rounds to 2 decimals to avoid float noise', () => {
    const c = computeCoverage([{ exerciseId: 'thirds', sets: 3 }], DB);
    expect(c.abs).toBe(0.3); // 3 × 0.1 = 0.30000000000000004 unrounded
  });

  it('ignores unknown exercise IDs', () => {
    const c = computeCoverage(
      [
        { exerciseId: 'nope', sets: 10 },
        { exerciseId: 'curl', sets: 3 },
      ],
      DB,
    );
    expect(c).toEqual({ ...emptyCoverage(), biceps: 3, forearms: 0.9 });
  });

  it('returns empty coverage for no items', () => {
    expect(computeCoverage([], DB)).toEqual(emptyCoverage());
  });
});

describe('coverageLevel', () => {
  it.each([
    [0, 'none'],
    [0.01, 'light'],
    [3.99, 'light'],
    [4, 'moderate'],
    [9.99, 'moderate'],
    [10, 'high'],
    [25, 'high'],
  ] as const)('%p → %s', (sets, level) => {
    expect(coverageLevel(sets)).toBe(level);
  });
});

describe('summarizePlan', () => {
  it('returns zeros for an empty plan', () => {
    expect(summarizePlan([], DB)).toEqual({ totalSets: 0, avgFormDifficulty: 0, maxInjuryRisk: 0, riskiest: undefined });
  });

  it('returns zeros when every ID is unknown', () => {
    const s = summarizePlan([{ exerciseId: 'nope', sets: 5 }], DB);
    expect(s.totalSets).toBe(0);
    expect(s.avgFormDifficulty).toBe(0);
    expect(s.maxInjuryRisk).toBe(0);
    expect(s.riskiest).toBeUndefined();
  });

  it('totals sets, averages form difficulty to 1 decimal and finds the riskiest', () => {
    const s = summarizePlan(
      [
        { exerciseId: 'curl', sets: 3 },
        { exerciseId: 'bench', sets: 4 },
        { exerciseId: 'nope', sets: 9 },
        { exerciseId: 'squat', sets: 5 },
      ],
      DB,
    );
    expect(s.totalSets).toBe(12);
    expect(s.avgFormDifficulty).toBe(2.7); // (1 + 3 + 4) / 3 = 2.666…
    expect(s.maxInjuryRisk).toBe(4);
    // bench and squat tie at risk 4; the first one wins.
    expect(s.riskiest?.id).toBe('bench');
  });
});

describe('database invariants', () => {
  it('computeCoverage on the real DB yields finite, non-negative values', () => {
    const c = computeCoverage(EXERCISES.map((e) => ({ exerciseId: e.id, sets: 3 })));
    for (const m of MUSCLE_GROUPS) {
      expect(Number.isFinite(c[m])).toBe(true);
      expect(c[m]).toBeGreaterThanOrEqual(0);
    }
  });

  it('summarizePlan on the real DB stays within rating bounds', () => {
    const s = summarizePlan(EXERCISES.map((e) => ({ exerciseId: e.id, sets: 2 })));
    expect(s.totalSets).toBe(EXERCISES.length * 2);
    if (EXERCISES.length > 0) {
      expect(s.avgFormDifficulty).toBeGreaterThanOrEqual(1);
      expect(s.avgFormDifficulty).toBeLessThanOrEqual(5);
      expect(s.maxInjuryRisk).toBe(Math.max(...EXERCISES.map((e) => e.injuryRisk)));
    }
  });
});
