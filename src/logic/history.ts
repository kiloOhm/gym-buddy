import type { SetLog, WorkoutSession } from '@/types';

export interface LastPerformance {
  date: string; // ISO
  sets: SetLog[];
}

/** Most recent finished session that contains the exercise, with its completed sets. */
export function lastPerformance(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
): LastPerformance | undefined {
  const sorted = [...sessions]
    .filter((s) => s.finishedAt)
    .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1));
  for (const session of sorted) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const done = ex.sets.filter((s) => s.completed);
    if (done.length === 0) continue;
    return { date: session.finishedAt!, sets: done };
  }
  return undefined;
}

/** Heaviest completed weight for an exercise across all sessions, or undefined. */
export function bestWeight(sessions: readonly WorkoutSession[], exerciseId: string): number | undefined {
  let best: number | undefined;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completed && (best === undefined || set.weight > best)) best = set.weight;
      }
    }
  }
  return best;
}
