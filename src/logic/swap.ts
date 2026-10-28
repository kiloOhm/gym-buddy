import type { SessionExercise, WorkoutSession } from '@/types';

export interface SwapTarget {
  /** The session exercise being replaced, as it was when the swap screen opened. */
  sessionExercise: SessionExercise | undefined;
  /** Exercise ids in the session at that moment; excluded from the suggestions. */
  sessionIds: string[];
}

/**
 * Snapshot of what the swap screen needs, taken once on mount. The screen renders from this
 * instead of the live session: after the swap the store changes while the screen is being
 * dismissed, and re-rendering a re-ordered suggestion list then crashes Fabric on Android.
 */
export function swapTargetSnapshot(
  session: WorkoutSession | null | undefined,
  sessionExerciseId: string | undefined,
): SwapTarget {
  const exercises = session?.exercises ?? [];
  return {
    sessionExercise: exercises.find((e) => e.id === sessionExerciseId),
    sessionIds: exercises.map((e) => e.exerciseId),
  };
}
