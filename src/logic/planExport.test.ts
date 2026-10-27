import { getExerciseMap } from '@/data/exercises';
import type { Exercise, WorkoutPlan } from '@/types';

import {
  dedupePlans,
  type ExportedPlan,
  parsePlanExport,
  planFingerprint,
  serializePlans,
  suggestedFileName,
} from './planExport';

const NOW = new Date(2026, 9, 27, 21, 0, 0); // local time, 27 Oct 2026

function plan(name: string, exercises: [string, number, number, number][]): WorkoutPlan {
  return {
    id: `plan-${name}`,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    exercises: exercises.map(([exerciseId, sets, reps, restSec], i) => ({
      id: `pe-${name}-${i}`,
      exerciseId,
      sets,
      reps,
      restSec,
    })),
  };
}

const PUSH = plan('Push', [
  ['barbell_bench_press', 4, 6, 150],
  ['overhead_press', 3, 8, 120],
]);
const PULL = plan('Pull', [['barbell_bench_press', 3, 10, 90]]);

function fileWith(plans: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'gym-buddy-plans', version: 1, exportedAt: NOW.toISOString(), plans, ...extra });
}

function fixtureExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    muscles: { chest: 1 },
    difficulty: 1,
    cues: [],
  };
}

describe('serializePlans', () => {
  it('writes the header and pretty-prints with 2 spaces', () => {
    const json = serializePlans([PUSH], NOW);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('gym-buddy-plans');
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe(NOW.toISOString());
    expect(json).toContain('\n  "format"');
  });

  it('drops ids and timestamps', () => {
    const json = serializePlans([PUSH, PULL], NOW);
    expect(json).not.toContain('plan-Push');
    expect(json).not.toContain('pe-Push');
    expect(json).not.toContain('createdAt');
    expect(json).not.toContain('updatedAt');
    expect(json).not.toMatch(/"id"/);
    expect(JSON.parse(json).plans[0]).toEqual({
      name: 'Push',
      exercises: [
        { exerciseId: 'barbell_bench_press', sets: 4, reps: 6, restSec: 150 },
        { exerciseId: 'overhead_press', sets: 3, reps: 8, restSec: 120 },
      ],
    });
  });

  it('round-trips through parsePlanExport', () => {
    const result = parsePlanExport(serializePlans([PUSH, PULL], NOW));
    expect(result.warnings).toEqual([]);
    expect(result.plans).toEqual(
      [PUSH, PULL].map((p) => ({
        name: p.name,
        exercises: p.exercises.map(({ exerciseId, sets, reps, restSec }) => ({ exerciseId, sets, reps, restSec })),
      })),
    );
  });
});

describe('suggestedFileName', () => {
  it('uses the generic name for several plans', () => {
    expect(suggestedFileName([PUSH, PULL], NOW)).toBe('gym-buddy-plans-2026-10-27.json');
  });

  it('uses the generic name for no plans', () => {
    expect(suggestedFileName([], NOW)).toBe('gym-buddy-plans-2026-10-27.json');
  });

  it('includes the slugified plan name for a single plan', () => {
    expect(suggestedFileName([PUSH], NOW)).toBe('gym-buddy-plan-push-2026-10-27.json');
    expect(suggestedFileName([plan('  Upper Body / Día 1! ', [])], NOW)).toBe(
      'gym-buddy-plan-upper-body-dia-1-2026-10-27.json',
    );
  });

  it('falls back when the name has no usable characters', () => {
    expect(suggestedFileName([plan('💪', [])], NOW)).toBe('gym-buddy-plan-plan-2026-10-27.json');
  });
});

describe('parsePlanExport errors', () => {
  it('rejects invalid JSON', () => {
    expect(() => parsePlanExport('{not json')).toThrow('not valid JSON');
  });

  it('rejects a missing or wrong format', () => {
    expect(() => parsePlanExport(JSON.stringify({ version: 1, plans: [] }))).toThrow('not a Gym Buddy plans file');
    expect(() => parsePlanExport(fileWith([], { format: 'other' }))).toThrow('not a Gym Buddy plans file');
    expect(() => parsePlanExport('[]')).toThrow('not a Gym Buddy plans file');
    expect(() => parsePlanExport('null')).toThrow('not a Gym Buddy plans file');
  });

  it('rejects an unsupported version', () => {
    expect(() => parsePlanExport(fileWith([], { version: 2 }))).toThrow('Unsupported file version (2)');
    expect(() => parsePlanExport(fileWith([], { version: undefined }))).toThrow('Unsupported file version');
  });

  it('rejects plans that are not an array', () => {
    expect(() => parsePlanExport(fileWith({ name: 'Push' }))).toThrow('does not contain a list of plans');
    expect(() => parsePlanExport(fileWith(undefined))).toThrow('does not contain a list of plans');
  });

  it('rejects a plan without a string name', () => {
    expect(() => parsePlanExport(fileWith([{ exercises: [] }]))).toThrow('Plan 1 has no name');
    expect(() => parsePlanExport(fileWith([{ name: 'A', exercises: [] }, { name: 3, exercises: [] }]))).toThrow(
      'Plan 2 has no name',
    );
    expect(() => parsePlanExport(fileWith(['Push']))).toThrow('Plan 1 has no name');
  });

  it('rejects a plan without an exercises array', () => {
    expect(() => parsePlanExport(fileWith([{ name: 'Push' }]))).toThrow('Plan 1 has no exercise list');
    expect(() => parsePlanExport(fileWith([{ name: 'Push', exercises: {} }]))).toThrow('Plan 1 has no exercise list');
  });
});

describe('parsePlanExport fix-ups', () => {
  const bench = getExerciseMap().barbell_bench_press.name;

  it('skips unknown exercises with a warning', () => {
    const result = parsePlanExport(
      fileWith([
        {
          name: 'Push',
          exercises: [
            { exerciseId: 'foo_bar', sets: 3, reps: 10, restSec: 90 },
            { exerciseId: 'barbell_bench_press', sets: 4, reps: 6, restSec: 150 },
          ],
        },
      ]),
    );
    expect(result.plans[0].exercises).toEqual([
      { exerciseId: 'barbell_bench_press', sets: 4, reps: 6, restSec: 150 },
    ]);
    expect(result.warnings).toEqual(["Push: skipped unknown exercise 'foo_bar'"]);
  });

  it('skips exercises without an id', () => {
    const result = parsePlanExport(fileWith([{ name: 'Push', exercises: [{ sets: 3 }, 'x'] }]));
    expect(result.plans[0].exercises).toEqual([]);
    expect(result.warnings).toEqual([
      'Push: skipped exercise 1 without an exercise id',
      'Push: skipped exercise 2 without an exercise id',
      'Push: no exercises',
    ]);
  });

  it('clamps out-of-range values', () => {
    const result = parsePlanExport(
      fileWith([{ name: 'Push', exercises: [{ exerciseId: 'barbell_bench_press', sets: 50, reps: 0, restSec: 9999 }] }]),
    );
    expect(result.plans[0].exercises[0]).toEqual({ exerciseId: 'barbell_bench_press', sets: 10, reps: 1, restSec: 600 });
    expect(result.warnings).toEqual([
      `Push / ${bench}: sets 50 adjusted to 10`,
      `Push / ${bench}: reps 0 adjusted to 1`,
      `Push / ${bench}: restSec 9999 adjusted to 600`,
    ]);
  });

  it('clamps negative rest and rounds fractions', () => {
    const result = parsePlanExport(
      fileWith([{ name: 'Push', exercises: [{ exerciseId: 'barbell_bench_press', sets: 3.6, reps: 8, restSec: -5 }] }]),
    );
    expect(result.plans[0].exercises[0]).toEqual({ exerciseId: 'barbell_bench_press', sets: 4, reps: 8, restSec: 0 });
    expect(result.warnings).toHaveLength(2);
  });

  it('defaults missing and non-numeric values', () => {
    const result = parsePlanExport(
      fileWith([{ name: 'Push', exercises: [{ exerciseId: 'barbell_bench_press', sets: 'four', reps: null }] }]),
    );
    expect(result.plans[0].exercises[0]).toEqual({ exerciseId: 'barbell_bench_press', sets: 3, reps: 10, restSec: 90 });
    expect(result.warnings).toEqual([
      `Push / ${bench}: invalid sets, using 3`,
      `Push / ${bench}: missing reps, using 10`,
      `Push / ${bench}: missing restSec, using 90`,
    ]);
  });

  it('keeps a plan that ends up empty, with a warning', () => {
    const result = parsePlanExport(fileWith([{ name: 'Empty', exercises: [] }]));
    expect(result.plans).toEqual([{ name: 'Empty', exercises: [] }]);
    expect(result.warnings).toEqual(['Empty: no exercises']);
  });

  it('trims names and falls back for empty ones', () => {
    const result = parsePlanExport(
      fileWith([
        { name: '  Legs  ', exercises: [] },
        { name: '   ', exercises: [] },
      ]),
    );
    expect(result.plans.map((p) => p.name)).toEqual(['Legs', 'Imported plan']);
  });

  it('honours a custom exercise db', () => {
    const db = { my_move: fixtureExercise('my_move', 'My move') };
    const result = parsePlanExport(
      fileWith([
        {
          name: 'Custom',
          exercises: [
            { exerciseId: 'my_move', sets: 2, reps: 5, restSec: 60 },
            { exerciseId: 'barbell_bench_press', sets: 4, reps: 6, restSec: 150 },
          ],
        },
      ]),
      db,
    );
    expect(result.plans[0].exercises).toEqual([{ exerciseId: 'my_move', sets: 2, reps: 5, restSec: 60 }]);
    expect(result.warnings).toEqual(["Custom: skipped unknown exercise 'barbell_bench_press'"]);
  });
});

function exported(source: WorkoutPlan, name = source.name): ExportedPlan {
  return {
    name,
    exercises: source.exercises.map(({ exerciseId, sets, reps, restSec }) => ({ exerciseId, sets, reps, restSec })),
  };
}

describe('planFingerprint', () => {
  it('is deterministic and 8 hex chars', () => {
    const fp = planFingerprint(PUSH.exercises);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(planFingerprint(PUSH.exercises)).toBe(fp);
  });

  it('ignores the plan name and plan/exercise ids', () => {
    const renamed = plan('Something else', [
      ['barbell_bench_press', 4, 6, 150],
      ['overhead_press', 3, 8, 120],
    ]);
    expect(renamed.id).not.toBe(PUSH.id);
    expect(renamed.exercises[0].id).not.toBe(PUSH.exercises[0].id);
    expect(planFingerprint(renamed.exercises)).toBe(planFingerprint(PUSH.exercises));
    expect(planFingerprint(exported(PUSH).exercises)).toBe(planFingerprint(PUSH.exercises));
  });

  it('is order-sensitive', () => {
    const reversed = [...PUSH.exercises].reverse();
    expect(planFingerprint(reversed)).not.toBe(planFingerprint(PUSH.exercises));
  });

  it('changes when sets, reps or rest change', () => {
    const base = planFingerprint(PUSH.exercises);
    const tweak = (patch: Partial<WorkoutPlan['exercises'][number]>) =>
      planFingerprint([{ ...PUSH.exercises[0], ...patch }, PUSH.exercises[1]]);
    expect(tweak({ sets: 5 })).not.toBe(base);
    expect(tweak({ reps: 7 })).not.toBe(base);
    expect(tweak({ restSec: 151 })).not.toBe(base);
  });

  it('distinguishes field boundaries', () => {
    expect(planFingerprint([{ exerciseId: 'a', sets: 1, reps: 11, restSec: 0 }])).not.toBe(
      planFingerprint([{ exerciseId: 'a', sets: 11, reps: 1, restSec: 0 }]),
    );
  });
});

describe('dedupePlans', () => {
  it('skips plans identical to an existing plan, naming the existing plan', () => {
    const result = dedupePlans([exported(PUSH, 'My push day'), exported(PULL)], [PUSH]);
    expect(result.plans.map((p) => p.name)).toEqual(['Pull']);
    expect(result.skipped).toEqual(["My push day: identical to existing plan 'Push'"]);
  });

  it('skips duplicates within the file, keeping the first occurrence', () => {
    const result = dedupePlans([exported(PUSH, 'A'), exported(PULL), exported(PUSH, 'B')], []);
    expect(result.plans.map((p) => p.name)).toEqual(['A', 'Pull']);
    expect(result.skipped).toEqual(['B: duplicate within the file']);
  });

  it('keeps a plan with the same name but different content', () => {
    const changedPush = plan('Push', [['barbell_bench_press', 5, 5, 180]]);
    const result = dedupePlans([exported(changedPush)], [PUSH]);
    expect(result.plans.map((p) => p.name)).toEqual(['Push']);
    expect(result.skipped).toEqual([]);
  });

  it('keeps everything when nothing matches', () => {
    const result = dedupePlans([exported(PUSH), exported(PULL)], []);
    expect(result.plans).toHaveLength(2);
    expect(result.skipped).toEqual([]);
  });
});
