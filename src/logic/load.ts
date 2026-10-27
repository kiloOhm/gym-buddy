import { EXERCISE_BY_ID } from '@/data/exercises';
import type { Equipment, Exercise, MuscleGroup, WorkoutSession } from '@/types';
import { MUSCLE_GROUPS } from '@/types';

import { computeCoverage, type Coverage } from './coverage';

export const LOAD_WINDOW_DAYS = 7;
/** Effective sets per muscle per rolling 7 days. Below `low` counts as untrained/under-trained, above `high` as overtraining risk. */
export const LOAD_THRESHOLDS = { low: 4, high: 20 } as const;

export type LoadLevel = 'none' | 'low' | 'good' | 'high';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SUGGESTIONS = 2;

/** 0 → none, (0, low) → low, [low, high] → good, > high → high. */
export function loadLevel(effectiveSets: number): LoadLevel {
  if (effectiveSets <= 0) return 'none';
  if (effectiveSets < LOAD_THRESHOLDS.low) return 'low';
  if (effectiveSets <= LOAD_THRESHOLDS.high) return 'good';
  return 'high';
}

/**
 * Effective sets per muscle over the completed sets of sessions finished within
 * the last LOAD_WINDOW_DAYS days before `now`. Unfinished sessions are ignored.
 */
export function recentMuscleLoad(
  sessions: readonly WorkoutSession[],
  now: number = Date.now(),
  db: Record<string, Exercise> = EXERCISE_BY_ID,
): Coverage {
  const since = now - LOAD_WINDOW_DAYS * DAY_MS;
  const items = sessions
    .filter((s) => {
      if (!s.finishedAt) return false;
      const t = Date.parse(s.finishedAt);
      return Number.isFinite(t) && t >= since && t <= now;
    })
    .flatMap((s) =>
      s.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => x.completed).length })),
    );
  return computeCoverage(items, db);
}

export interface LoadHint {
  muscle: MuscleGroup;
  level: LoadLevel;
  effectiveSets: number;
  /** For 'none'/'low': up to 2 exercises whose activation of this muscle is 1.0 and whose equipment is all available; best (lowest injuryRisk, then formDifficulty) first. Empty for 'high'. */
  suggestions: Exercise[];
}

function suggestFor(
  muscle: MuscleGroup,
  available: ReadonlySet<Equipment>,
  db: Record<string, Exercise>,
): Exercise[] {
  return Object.values(db)
    .filter((e) => e.muscles[muscle] === 1 && e.equipment.every((eq) => available.has(eq)))
    .sort(
      (a, b) =>
        a.injuryRisk - b.injuryRisk || a.formDifficulty - b.formDifficulty || a.name.localeCompare(b.name),
    )
    .slice(0, MAX_SUGGESTIONS);
}

const LEVEL_ORDER: Record<LoadLevel, number> = { high: 0, none: 1, low: 2, good: 3 };

/** One entry per muscle group that is 'none', 'low' or 'high' (never 'good'), ordered: 'high' first (desc by sets), then 'none', then 'low' (asc by sets). */
export function loadHints(
  load: Coverage,
  availableEquipment: readonly Equipment[],
  db: Record<string, Exercise> = EXERCISE_BY_ID,
): LoadHint[] {
  const available = new Set(availableEquipment);
  const hints: LoadHint[] = [];
  for (const muscle of MUSCLE_GROUPS) {
    const effectiveSets = load[muscle] ?? 0;
    const level = loadLevel(effectiveSets);
    if (level === 'good') continue;
    hints.push({
      muscle,
      level,
      effectiveSets,
      suggestions: level === 'high' ? [] : suggestFor(muscle, available, db),
    });
  }
  return hints.sort((a, b) => {
    const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (byLevel !== 0) return byLevel;
    return a.level === 'high' ? b.effectiveSets - a.effectiveSets : a.effectiveSets - b.effectiveSets;
  });
}
