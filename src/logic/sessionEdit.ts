// Pure edits of a finished workout, used by the history editor (session/[id].tsx). Every function
// returns a new session and leaves the input untouched.
import type { SessionExercise, SetLog, WorkoutSession } from '@/types';

import { lastPerformance } from './history';
import { newId } from './ids';

const MINUTE = 60_000;
/** Sets a newly added exercise gets when there is no earlier performance to copy. */
const NEW_EXERCISE_SETS = 3;
const NEW_EXERCISE_REPS = 10;
const NEW_EXERCISE_REST = 90;

function mapExercise(
  session: WorkoutSession,
  sessionExerciseId: string,
  fn: (ex: SessionExercise) => SessionExercise,
): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((ex) => (ex.id === sessionExerciseId ? fn(ex) : ex)),
  };
}

export function updateSet(
  session: WorkoutSession,
  sessionExerciseId: string,
  index: number,
  patch: Partial<SetLog>,
): WorkoutSession {
  return mapExercise(session, sessionExerciseId, (ex) => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  }));
}

/** Appends a done set copying the last one (or the target reps and no weight). */
export function appendSet(session: WorkoutSession, sessionExerciseId: string): WorkoutSession {
  return mapExercise(session, sessionExerciseId, (ex) => {
    const prev = ex.sets[ex.sets.length - 1];
    return {
      ...ex,
      sets: [...ex.sets, { reps: prev?.reps ?? ex.targetReps, weight: prev?.weight ?? 0, completed: true }],
    };
  });
}

export function removeSet(session: WorkoutSession, sessionExerciseId: string, index: number): WorkoutSession {
  return mapExercise(session, sessionExerciseId, (ex) => ({ ...ex, sets: ex.sets.filter((_, i) => i !== index) }));
}

export function removeExercise(session: WorkoutSession, sessionExerciseId: string): WorkoutSession {
  return { ...session, exercises: session.exercises.filter((ex) => ex.id !== sessionExerciseId) };
}

/**
 * Appends an exercise with done sets copied from its last performance before this workout
 * (`history` = all finished sessions), or three empty sets of ten.
 */
export function appendExercise(
  session: WorkoutSession,
  exerciseId: string,
  history: readonly WorkoutSession[],
): WorkoutSession {
  const earlier = history.filter((s) => s.id !== session.id && s.finishedAt && s.finishedAt <= session.startedAt);
  const last = lastPerformance(earlier, exerciseId);
  const sets: SetLog[] = last
    ? last.sets.map((s) => ({ reps: s.reps, weight: s.weight, completed: true }))
    : Array.from({ length: NEW_EXERCISE_SETS }, () => ({ reps: NEW_EXERCISE_REPS, weight: 0, completed: true }));
  const added: SessionExercise = {
    id: newId(),
    exerciseId,
    targetSets: sets.length,
    targetReps: sets[0]?.reps ?? NEW_EXERCISE_REPS,
    restSec: NEW_EXERCISE_REST,
    sets,
  };
  return { ...session, exercises: [...session.exercises, added] };
}

/** Moves the whole workout by `minutes`; the duration stays the same. */
export function shiftStart(session: WorkoutSession, minutes: number): WorkoutSession {
  const shift = (iso: string) => new Date(Date.parse(iso) + minutes * MINUTE).toISOString();
  return {
    ...session,
    startedAt: shift(session.startedAt),
    ...(session.finishedAt ? { finishedAt: shift(session.finishedAt) } : {}),
  };
}

/** Sets the finish time to `minutes` (at least 1) after the start. */
export function setDuration(session: WorkoutSession, minutes: number): WorkoutSession {
  const whole = Math.max(1, Math.round(minutes));
  return { ...session, finishedAt: new Date(Date.parse(session.startedAt) + whole * MINUTE).toISOString() };
}

/** Newest finish first; stable for equal (or missing) finish times. */
export function sortNewestFirst(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => {
    const fa = a.finishedAt ?? '';
    const fb = b.finishedAt ?? '';
    return fa < fb ? 1 : fa > fb ? -1 : 0;
  });
}
