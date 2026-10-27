import type { WorkoutSession } from '@/types';

export interface RepRange {
  min: number;
  max: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_WINDOW_MS = 30 * DAY_MS;

/**
 * Band around the target: half-width = max(1, round(target * 0.2)), min clamped to 1.
 * 6 → 5–7, 8 → 6–10, 10 → 8–12, 15 → 12–18, 3 → 2–4, 1 → 1–2.
 */
export function repRange(targetReps: number): RepRange {
  const half = Math.max(1, Math.round(targetReps * 0.2));
  const max = Math.max(1, targetReps + half);
  return { min: Math.max(1, targetReps - half), max };
}

/** Epley factor; a single rep is the 1RM itself (standard convention, keeps 1-rep sets exact). */
const epley = (reps: number) => (reps <= 1 ? 1 : 1 + reps / 30);

/** Epley 1RM: weight * (1 + reps / 30); a 1-rep set returns its weight unchanged. */
export function estimateOneRepMax(weight: number, reps: number): number {
  return weight * epley(reps);
}

/** Weight you could lift for targetReps given a set of weight×reps (via Epley both ways). */
export function estimateWeightAtReps(weight: number, reps: number, targetReps: number): number {
  return estimateOneRepMax(weight, reps) / epley(targetReps);
}

export interface ExerciseStats {
  range: RepRange;
  /** Heaviest comparable set ever. */
  best?: number;
  /** Top comparable set of the most recent session that has one. */
  last?: number;
  /** Mean of comparable sets in sessions finished within the last 30 days. */
  avg30d?: number;
  /** True when no completed set fell inside the rep range and the values were converted from other rep counts. */
  approximate: boolean;
  /** Number of comparable sets used. */
  sampleCount: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface SessionSets {
  finishedAt: number;
  sets: { weight: number; reps: number }[];
}

/**
 * Best / last / 30-day average weight for an exercise at a target rep count.
 *
 * Only completed sets with weight > 0 and reps > 0 from finished sessions count. Sets whose reps
 * fall inside repRange(targetReps) are used as-is; if there are none anywhere, every set is
 * converted to targetReps via Epley and `approximate` is true. Returns undefined when the exercise
 * has no usable sets. Weights are rounded to 1 decimal (avg30d is rounded after averaging).
 * `last` comes from the session with the latest finishedAt (ties: the one earlier in `sessions`).
 * avg30d includes sessions with finishedAt >= now - 30 days.
 */
export function exerciseStats(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  targetReps: number,
  now: number = Date.now(),
): ExerciseStats | undefined {
  const range = repRange(targetReps);

  const all: SessionSets[] = [];
  for (const session of sessions) {
    if (!session.finishedAt) continue;
    const finishedAt = Date.parse(session.finishedAt);
    if (!Number.isFinite(finishedAt)) continue;
    const sets: SessionSets['sets'] = [];
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (s.completed && s.weight > 0 && s.reps > 0) sets.push({ weight: s.weight, reps: s.reps });
      }
    }
    if (sets.length > 0) all.push({ finishedAt, sets });
  }
  if (all.length === 0) return undefined;

  const inRange = (reps: number) => reps >= range.min && reps <= range.max;
  const approximate = !all.some((s) => s.sets.some((set) => inRange(set.reps)));

  // Comparable weights per session.
  const comparable = all
    .map(({ finishedAt, sets }) => ({
      finishedAt,
      weights: approximate
        ? sets.map((s) => estimateWeightAtReps(s.weight, s.reps, targetReps))
        : sets.filter((s) => inRange(s.reps)).map((s) => s.weight),
    }))
    .filter((s) => s.weights.length > 0);

  let best = -Infinity;
  let latest = comparable[0];
  let sampleCount = 0;
  let recentSum = 0;
  let recentCount = 0;
  for (const s of comparable) {
    sampleCount += s.weights.length;
    best = Math.max(best, ...s.weights);
    if (s.finishedAt > latest.finishedAt) latest = s;
    if (s.finishedAt >= now - AVG_WINDOW_MS) {
      for (const w of s.weights) recentSum += w;
      recentCount += s.weights.length;
    }
  }

  return {
    range,
    best: round1(best),
    last: round1(Math.max(...latest.weights)),
    avg30d: recentCount > 0 ? round1(recentSum / recentCount) : undefined,
    approximate,
    sampleCount,
  };
}
