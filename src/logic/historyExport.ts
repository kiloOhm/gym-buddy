// Workout-history export/import file format ("gym-buddy-history", version 1). Pure functions, no Expo
// imports (the file/share/picker side lives in planFiles.ts). The MAUI port reads and writes the same
// file byte-for-byte, so field order, rounding and messages must stay in step with it.
import { getExerciseMap } from '@/data/exercises';
import type { Exercise, SessionExercise, SetLog, WeightUnit, WorkoutSession } from '@/types';

import { newId } from './ids';
import { formatSessionDate } from './sessionFormat';

export const HISTORY_EXPORT_FORMAT = 'gym-buddy-history';
export const HISTORY_EXPORT_VERSION = 1;

/** A finished workout as stored in the file: the WorkoutSession shape with finishedAt required. */
export type ExportedSession = WorkoutSession & { finishedAt: string };

export interface HistoryExportFile {
  format: 'gym-buddy-history';
  version: 1;
  exportedAt: string;
  weightUnit: WeightUnit;
  sessions: ExportedSession[];
}

export interface ParsedHistory {
  sessions: ExportedSession[];
  warnings: string[];
}

const FALLBACK_PLAN_NAME = 'Workout';
const INTEGER_FIELDS = ['targetSets', 'targetReps', 'restSec'] as const;

function isFinished(s: WorkoutSession): s is ExportedSession {
  return typeof s.finishedAt === 'string';
}

/** Writes each object explicitly in file order; planId/substitutedFor only when present, deload when boolean. */
function exportSession(s: ExportedSession): ExportedSession {
  return {
    id: s.id,
    ...(s.planId !== undefined ? { planId: s.planId } : {}),
    planName: s.planName,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    ...(typeof s.deload === 'boolean' ? { deload: s.deload } : {}),
    exercises: s.exercises.map(
      (e): SessionExercise => ({
        id: e.id,
        exerciseId: e.exerciseId,
        ...(e.substitutedFor !== undefined ? { substitutedFor: e.substitutedFor } : {}),
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSec: e.restSec,
        sets: e.sets.map((set): SetLog => ({ reps: set.reps, weight: set.weight, completed: set.completed })),
      }),
    ),
  };
}

/** Finished sessions (in the given order) as pretty-printed JSON. Weights are copied as stored. */
export function serializeHistory(
  sessions: readonly WorkoutSession[],
  unit: WeightUnit,
  now: Date = new Date(),
): string {
  const file: HistoryExportFile = {
    format: HISTORY_EXPORT_FORMAT,
    version: HISTORY_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    weightUnit: unit,
    sessions: sessions.filter(isFinished).map(exportSession),
  };
  return JSON.stringify(file, null, 2);
}

/** "gym-buddy-history-2026-10-29.json" (local date). */
export function historyFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gym-buddy-history-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** A finished date formatted like the History list, e.g. "Thu, 29 Oct 2026". */
export function formatHistoryDate(iso: string): string {
  return formatSessionDate(iso);
}

/** "Push on Thu, 29 Oct 2026": how warnings and skipped lines name a workout. */
export function sessionLabel(session: Pick<WorkoutSession, 'planName' | 'finishedAt'>): string {
  return session.finishedAt
    ? `${session.planName} on ${formatHistoryDate(session.finishedAt)}`
    : session.planName;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'kg' || value === 'lb';
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readSet(raw: unknown): SetLog | undefined {
  if (!isRecord(raw) || !isFiniteNumber(raw.reps) || !isFiniteNumber(raw.weight)) return undefined;
  if (raw.completed !== undefined && typeof raw.completed !== 'boolean') return undefined;
  return {
    reps: Math.max(0, Math.round(raw.reps)),
    weight: Math.max(0, raw.weight),
    completed: raw.completed === true,
  };
}

function readExercise(
  raw: Record<string, unknown> & { exerciseId: string },
  label: string,
  db: Record<string, Exercise>,
  warnings: string[],
): SessionExercise {
  const exerciseId = raw.exerciseId;
  const exerciseName = db[exerciseId]?.name ?? exerciseId;
  const counts = {} as Record<(typeof INTEGER_FIELDS)[number], number>;
  for (const field of INTEGER_FIELDS) {
    const value = raw[field];
    if (isFiniteNumber(value)) {
      counts[field] = Math.max(0, Math.round(value));
    } else {
      warnings.push(`${label}: invalid ${field} for ${exerciseName}, using 0`);
      counts[field] = 0;
    }
  }
  const sets: SetLog[] = [];
  if (Array.isArray(raw.sets)) {
    for (const rawSet of raw.sets) {
      const set = readSet(rawSet);
      if (set) sets.push(set);
      else warnings.push(`${label}: skipped an invalid set of ${exerciseName}`);
    }
  } else {
    warnings.push(`${label}: ${exerciseName} has no set list`);
  }
  return {
    id: typeof raw.id === 'string' ? raw.id : newId(),
    exerciseId,
    ...(typeof raw.substitutedFor === 'string' ? { substitutedFor: raw.substitutedFor } : {}),
    targetSets: counts.targetSets,
    targetReps: counts.targetReps,
    restSec: counts.restSec,
    sets,
  };
}

function readSession(
  raw: unknown,
  position: number,
  db: Record<string, Exercise>,
  warnings: string[],
): ExportedSession | undefined {
  const fallbackLabel = `Workout ${position}`;
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') {
    warnings.push(`${fallbackLabel}: skipped, no id`);
    return undefined;
  }
  const planName = (typeof raw.planName === 'string' ? raw.planName.trim() : '') || FALLBACK_PLAN_NAME;
  if (!isDateString(raw.finishedAt)) {
    warnings.push(`${fallbackLabel}: skipped, not finished`);
    return undefined;
  }
  const finishedAt = raw.finishedAt;
  const label = sessionLabel({ planName, finishedAt });
  if (!isDateString(raw.startedAt)) {
    warnings.push(`${label}: skipped, invalid start time`);
    return undefined;
  }
  if (!Array.isArray(raw.exercises)) {
    warnings.push(`${label}: skipped, no exercise list`);
    return undefined;
  }

  const exercises: SessionExercise[] = [];
  const unknownIds: string[] = [];
  raw.exercises.forEach((rawEx: unknown, index) => {
    if (!isRecord(rawEx) || typeof rawEx.exerciseId !== 'string' || rawEx.exerciseId === '') {
      warnings.push(`${label}: skipped exercise ${index + 1} without an exercise id`);
      return;
    }
    const exerciseId = rawEx.exerciseId;
    if (!db[exerciseId] && !unknownIds.includes(exerciseId)) unknownIds.push(exerciseId);
    exercises.push(readExercise({ ...rawEx, exerciseId }, label, db, warnings));
  });
  if (unknownIds.length > 0) {
    warnings.push(`${label}: unknown exercises kept as 'Unknown exercise': ${unknownIds.join(', ')}`);
  }

  return {
    id: raw.id,
    ...(typeof raw.planId === 'string' ? { planId: raw.planId } : {}),
    planName,
    startedAt: raw.startedAt,
    finishedAt,
    ...(typeof raw.deload === 'boolean' ? { deload: raw.deload } : {}),
    exercises,
  };
}

/**
 * Parses an exported history file. Throws an Error with a human-readable message when the file as a
 * whole is unusable; broken sessions, exercises and sets are skipped or fixed up and reported as warnings.
 * `unit` is the app's weight unit: a file in the other unit gets a first warning (weights are not converted).
 */
export function parseHistoryExport(
  json: string,
  unit: WeightUnit,
  db: Record<string, Exercise> = getExerciseMap(),
): ParsedHistory {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!isRecord(data) || data.format !== HISTORY_EXPORT_FORMAT) {
    throw new Error('This is not a Gym Buddy history file.');
  }
  if (data.version !== HISTORY_EXPORT_VERSION) {
    throw new Error(
      `Unsupported file version (${String(data.version)}). Update Gym Buddy and try again.`,
    );
  }
  if (!Array.isArray(data.sessions)) {
    throw new Error('The file does not contain a list of workouts.');
  }

  const warnings: string[] = [];
  if (isWeightUnit(data.weightUnit) && data.weightUnit !== unit) {
    warnings.push(
      `The file's weights are in ${data.weightUnit}, your unit is ${unit}. They are imported as entered, without conversion.`,
    );
  }
  const sessions: ExportedSession[] = [];
  data.sessions.forEach((raw: unknown, index) => {
    const session = readSession(raw, index + 1, db, warnings);
    if (session) sessions.push(session);
  });
  return { sessions, warnings };
}

export interface HistoryDedupeResult {
  /** Sessions to import, in file order, with in-file duplicates removed (first occurrence wins). */
  sessions: ExportedSession[];
  /** One line per skipped session: "Push on Thu, 29 Oct 2026: already in your history". */
  skipped: string[];
}

/** Drops incoming sessions whose id is already in the app or appeared earlier in the file. */
export function dedupeSessions(
  incoming: readonly ExportedSession[],
  existing: readonly WorkoutSession[],
): HistoryDedupeResult {
  const existingIds = new Set(existing.map((s) => s.id));
  const seen = new Set<string>();
  const sessions: ExportedSession[] = [];
  const skipped: string[] = [];
  for (const s of incoming) {
    if (existingIds.has(s.id)) {
      skipped.push(`${sessionLabel(s)}: already in your history`);
    } else if (seen.has(s.id)) {
      skipped.push(`${sessionLabel(s)}: duplicate within the file`);
    } else {
      seen.add(s.id);
      sessions.push(s);
    }
  }
  return { sessions, skipped };
}
