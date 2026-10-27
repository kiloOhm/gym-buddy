import { EXERCISE_BY_ID } from '@/data/exercises';
import { SEED_PLANS } from '@/data/seedPlans';

describe('SEED_PLANS', () => {
  it('is a four-day push/pull/legs/arms split', () => {
    expect(SEED_PLANS.map((p) => p.name)).toEqual(['Push', 'Pull', 'Legs', 'Arms']);
  });

  it('only references exercises that exist', () => {
    for (const plan of SEED_PLANS) {
      for (const e of plan.exercises) {
        expect(EXERCISE_BY_ID[e.exerciseId]).toBeDefined();
      }
    }
  });

  it('has at most five exercises per day, no duplicates, and sensible set/rep/rest values', () => {
    for (const plan of SEED_PLANS) {
      const ids = plan.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(plan.exercises.length).toBeGreaterThanOrEqual(4);
      expect(plan.exercises.length).toBeLessThanOrEqual(5);
      for (const e of plan.exercises) {
        expect(e.sets).toBeGreaterThanOrEqual(1);
        expect(e.sets).toBeLessThanOrEqual(10);
        expect(e.reps).toBeGreaterThanOrEqual(1);
        expect(e.reps).toBeLessThanOrEqual(30);
        expect(e.restSec).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
