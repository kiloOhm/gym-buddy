import { getExerciseMap } from '@/data/exercises';
import type { Equipment, Exercise, MuscleGroup } from '@/types';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS } from '@/types';

export interface Alternative {
  exercise: Exercise;
  /** 0..1, higher is a closer substitute. */
  score: number;
  /** Short human-readable reasons, e.g. "Same movement pattern", "Easier on form". */
  reasons: string[];
}

export interface AlternativeOptions {
  /** Only exercises whose every equipment item is in this list are suggested. */
  availableEquipment: readonly Equipment[];
  /** Exercise IDs to leave out (e.g. everything already in the session). */
  excludeIds?: readonly string[];
  /** Default 5. */
  limit?: number;
}

/** Minimum activation a candidate needs on one of the original's primary muscles. */
const MIN_PRIMARY_ACTIVATION = 0.5;
/** Minimum muscle-vector similarity for a candidate to be considered at all. */
const MIN_SIMILARITY = 0.4;
const DEFAULT_LIMIT = 5;

function activation(exercise: Exercise, muscle: MuscleGroup): number {
  return exercise.muscles[muscle] ?? 0;
}

/** 0..1 similarity of two exercises' muscle activation vectors. */
export function muscleSimilarity(a: Exercise, b: Exercise): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const m of MUSCLE_GROUPS) {
    const x = activation(a, m);
    const y = activation(b, m);
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.min(1, Math.max(0, dot / Math.sqrt(normA * normB)));
}

/**
 * Primary muscles of an exercise: those at 1.0. Falls back to the most
 * activated muscle(s) if the data has no 1.0 entry.
 */
function primaryMuscles(exercise: Exercise): MuscleGroup[] {
  const max = Math.max(0, ...MUSCLE_GROUPS.map((m) => activation(exercise, m)));
  if (max === 0) return [];
  const target = max >= 1 ? 1 : max;
  return MUSCLE_GROUPS.filter((m) => activation(exercise, m) >= target);
}

function equipmentReason(equipment: readonly Equipment[]): string {
  const needed = equipment.filter((e) => e !== 'bodyweight');
  if (needed.length === 0) return 'No equipment needed';
  return `Needs: ${needed.map((e) => EQUIPMENT_LABELS[e]).join(', ')}`;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Ranked substitutes for an exercise, best first. Empty if the ID is unknown. */
export function suggestAlternatives(
  exerciseId: string,
  options: AlternativeOptions,
  db: Record<string, Exercise> = getExerciseMap(),
): Alternative[] {
  const original = db[exerciseId];
  if (!original) return [];

  const available = new Set<Equipment>(options.availableEquipment);
  const excluded = new Set(options.excludeIds ?? []);
  const primaries = primaryMuscles(original);
  const limit = options.limit ?? DEFAULT_LIMIT;

  const results: Alternative[] = [];
  for (const candidate of Object.values(db)) {
    if (candidate.id === original.id || excluded.has(candidate.id)) continue;
    if (!candidate.equipment.every((e) => available.has(e))) continue;

    // Shared primary: the original's primary the candidate hits hardest.
    let sharedPrimary: MuscleGroup | undefined;
    for (const m of primaries) {
      if (activation(candidate, m) < MIN_PRIMARY_ACTIVATION) continue;
      if (!sharedPrimary || activation(candidate, m) > activation(candidate, sharedPrimary)) sharedPrimary = m;
    }
    if (!sharedPrimary) continue;

    const similarity = muscleSimilarity(original, candidate);
    if (similarity < MIN_SIMILARITY) continue;

    const samePattern = candidate.pattern === original.pattern;
    const sameCompound = candidate.compound === original.compound;
    const easierOrEqualForm = candidate.formDifficulty <= original.formDifficulty;
    const lowerOrEqualRisk = candidate.injuryRisk <= original.injuryRisk;
    const safety = easierOrEqualForm && lowerOrEqualRisk ? 1 : easierOrEqualForm || lowerOrEqualRisk ? 0.5 : 0;
    const extraRisk = Math.max(0, candidate.injuryRisk - original.injuryRisk);

    const raw =
      0.55 * similarity +
      0.2 * (samePattern ? 1 : 0) +
      0.15 * (sameCompound ? 1 : 0) +
      0.1 * safety -
      0.05 * extraRisk;
    const score = round(Math.min(1, Math.max(0, raw)), 3);

    const reasons: string[] = [
      samePattern ? 'Same movement pattern' : 'Different pattern, same muscles',
      `Hits ${MUSCLE_LABELS[sharedPrimary]} like the original`,
    ];
    if (candidate.formDifficulty < original.formDifficulty) reasons.push('Easier on form');
    else if (candidate.formDifficulty === original.formDifficulty) reasons.push('Same technique demand');
    else reasons.push('More technical');
    if (candidate.injuryRisk < original.injuryRisk) reasons.push('Lower injury risk');
    else if (candidate.injuryRisk === original.injuryRisk) reasons.push('Same injury risk');
    else reasons.push('Higher injury risk');
    reasons.push(equipmentReason(candidate.equipment));

    results.push({ exercise: candidate, score, reasons });
  }

  results.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
  return results.slice(0, Math.max(0, limit));
}
