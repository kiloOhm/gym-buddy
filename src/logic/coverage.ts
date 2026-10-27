import { getExerciseMap } from '@/data/exercises';
import type { Exercise, MuscleGroup } from '@/types';
import { MUSCLE_GROUPS } from '@/types';

/** Effective sets per muscle group (sets × activation, summed over exercises). */
export type Coverage = Record<MuscleGroup, number>;

export type CoverageLevel = 'none' | 'light' | 'moderate' | 'high';

export interface CoverageItem {
  exerciseId: string;
  sets: number;
}

export function emptyCoverage(): Coverage {
  return Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Coverage;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Sum of sets × activation for every muscle. Unknown exercise IDs are ignored. */
export function computeCoverage(
  items: readonly CoverageItem[],
  db: Record<string, Exercise> = getExerciseMap(),
): Coverage {
  const coverage = emptyCoverage();
  for (const item of items) {
    const exercise = db[item.exerciseId];
    if (!exercise) continue;
    for (const muscle of MUSCLE_GROUPS) {
      const activation = exercise.muscles[muscle];
      if (activation) coverage[muscle] += item.sets * activation;
    }
  }
  for (const muscle of MUSCLE_GROUPS) coverage[muscle] = round(coverage[muscle], 2);
  return coverage;
}

/** Bucket effective sets into a level for display (per-session buckets). */
export function coverageLevel(effectiveSets: number): CoverageLevel {
  if (effectiveSets <= 0) return 'none';
  if (effectiveSets < 4) return 'light';
  if (effectiveSets < 10) return 'moderate';
  return 'high';
}

export interface PlanSummary {
  totalSets: number;
  /** Average difficulty over planned exercises, 1..5 (1 decimal); 0 when empty. */
  avgDifficulty: number;
  /** 1..5; 0 when empty. */
  maxDifficulty: number;
  /** The first exercise with the highest difficulty, if any. */
  hardest?: Exercise;
}

export function summarizePlan(
  items: readonly CoverageItem[],
  db: Record<string, Exercise> = getExerciseMap(),
): PlanSummary {
  let totalSets = 0;
  let difficultySum = 0;
  let count = 0;
  let hardest: Exercise | undefined;
  for (const item of items) {
    const exercise = db[item.exerciseId];
    if (!exercise) continue;
    totalSets += item.sets;
    difficultySum += exercise.difficulty;
    count += 1;
    if (!hardest || exercise.difficulty > hardest.difficulty) hardest = exercise;
  }
  return {
    totalSets,
    avgDifficulty: count === 0 ? 0 : round(difficultySum / count, 1),
    maxDifficulty: hardest?.difficulty ?? 0,
    hardest,
  };
}
