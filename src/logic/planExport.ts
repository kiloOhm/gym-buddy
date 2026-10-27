// Plan export/import file format. Pure functions, no Expo imports
// (the file/share/picker side lives in planFiles.ts).
import { getExerciseMap } from '@/data/exercises';
import type { Exercise, WorkoutPlan } from '@/types';

export const PLAN_EXPORT_FORMAT = 'gym-buddy-plans';
export const PLAN_EXPORT_VERSION = 1;

export interface ExportedExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface ExportedPlan {
  name: string;
  exercises: ExportedExercise[];
}

export interface PlanExportFile {
  format: 'gym-buddy-plans';
  version: 1;
  exportedAt: string;
  plans: ExportedPlan[];
}

export interface ParsedImport {
  plans: ExportedPlan[];
  warnings: string[];
}

const FALLBACK_PLAN_NAME = 'Imported plan';

/** Allowed range and default per field; matches the steppers in the plan editor. */
const LIMITS = {
  sets: { min: 1, max: 10, fallback: 3 },
  reps: { min: 1, max: 30, fallback: 10 },
  restSec: { min: 0, max: 600, fallback: 90 },
} as const;
type NumericField = keyof typeof LIMITS;

/** Plans as pretty-printed JSON. IDs and timestamps are dropped. */
export function serializePlans(plans: readonly WorkoutPlan[], now: Date = new Date()): string {
  const file: PlanExportFile = {
    format: PLAN_EXPORT_FORMAT,
    version: PLAN_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    plans: plans.map((p) => ({
      name: p.name,
      exercises: p.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        reps: e.reps,
        restSec: e.restSec,
      })),
    })),
  };
  return JSON.stringify(file, null, 2);
}

/** Local calendar date as YYYY-MM-DD. */
function dateStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "gym-buddy-plans-2026-10-27.json", or "gym-buddy-plan-push-2026-10-27.json" for a single plan. */
export function suggestedFileName(plans: readonly WorkoutPlan[], now: Date = new Date()): string {
  const date = dateStamp(now);
  if (plans.length === 1) {
    const slug = slugify(plans[0].name) || 'plan';
    return `gym-buddy-plan-${slug}-${date}.json`;
  }
  return `gym-buddy-plans-${date}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(
  raw: unknown,
  field: NumericField,
  context: string,
  warnings: string[],
): number {
  const { min, max, fallback } = LIMITS[field];
  if (raw === undefined || raw === null) {
    warnings.push(`${context}: missing ${field}, using ${fallback}`);
    return fallback;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    warnings.push(`${context}: invalid ${field}, using ${fallback}`);
    return fallback;
  }
  const value = Math.min(max, Math.max(min, Math.round(raw)));
  if (value !== raw) warnings.push(`${context}: ${field} ${raw} adjusted to ${value}`);
  return value;
}

/**
 * Parses an exported plans file. Throws an Error with a human-readable message when the file
 * as a whole is unusable; per-exercise problems are fixed up and reported as warnings.
 */
export function parsePlanExport(
  json: string,
  db: Record<string, Exercise> = getExerciseMap(),
): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!isRecord(data) || data.format !== PLAN_EXPORT_FORMAT) {
    throw new Error('This is not a Gym Buddy plans file.');
  }
  if (data.version !== PLAN_EXPORT_VERSION) {
    throw new Error(
      `Unsupported file version (${String(data.version)}). Update Gym Buddy and try again.`,
    );
  }
  if (!Array.isArray(data.plans)) {
    throw new Error('The file does not contain a list of plans.');
  }

  const warnings: string[] = [];
  const plans = data.plans.map((rawPlan: unknown, index): ExportedPlan => {
    const position = `Plan ${index + 1}`;
    if (!isRecord(rawPlan) || typeof rawPlan.name !== 'string') {
      throw new Error(`${position} has no name.`);
    }
    if (!Array.isArray(rawPlan.exercises)) {
      throw new Error(`${position} has no exercise list.`);
    }
    const name = rawPlan.name.trim() || FALLBACK_PLAN_NAME;

    const exercises: ExportedExercise[] = [];
    rawPlan.exercises.forEach((rawEx: unknown, exIndex) => {
      if (!isRecord(rawEx) || typeof rawEx.exerciseId !== 'string') {
        warnings.push(`${name}: skipped exercise ${exIndex + 1} without an exercise id`);
        return;
      }
      const exerciseId = rawEx.exerciseId;
      const exercise = db[exerciseId];
      if (!exercise) {
        warnings.push(`${name}: skipped unknown exercise '${exerciseId}'`);
        return;
      }
      const context = `${name} / ${exercise.name}`;
      exercises.push({
        exerciseId,
        sets: readNumber(rawEx.sets, 'sets', context, warnings),
        reps: readNumber(rawEx.reps, 'reps', context, warnings),
        restSec: readNumber(rawEx.restSec, 'restSec', context, warnings),
      });
    });

    if (exercises.length === 0) warnings.push(`${name}: no exercises`);
    return { name, exercises };
  });

  return { plans, warnings };
}

type FingerprintInput = readonly Pick<ExportedExercise, 'exerciseId' | 'sets' | 'reps' | 'restSec'>[];

/**
 * Stable content hash of a plan's exercise list (ids, sets, reps, rest, in order). The plan name
 * and plan/exercise ids are not included. FNV-1a 32-bit over a canonical string such as
 * "barbell_bench_press:4x6@150|overhead_press:3x8@120", hashed per UTF-16 code unit;
 * returns 8 lowercase hex chars.
 */
export function planFingerprint(exercises: FingerprintInput): string {
  const canonical = exercises
    .map((e) => `${e.exerciseId}:${e.sets}x${e.reps}@${e.restSec}`)
    .join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface DedupeResult {
  /** Plans to import, in file order, with in-file duplicates removed (first occurrence wins). */
  plans: ExportedPlan[];
  /** One line per skipped plan: "Push: identical to existing plan 'Push'" or "Push: duplicate within the file". */
  skipped: string[];
}

/** Drops incoming plans whose fingerprint matches an existing plan's exercises or an earlier incoming plan's. */
export function dedupePlans(
  incoming: readonly ExportedPlan[],
  existing: readonly WorkoutPlan[],
): DedupeResult {
  const existingNames = new Map<string, string>();
  for (const p of existing) {
    const fp = planFingerprint(p.exercises);
    if (!existingNames.has(fp)) existingNames.set(fp, p.name);
  }
  const seen = new Set<string>();
  const plans: ExportedPlan[] = [];
  const skipped: string[] = [];
  for (const p of incoming) {
    const fp = planFingerprint(p.exercises);
    const match = existingNames.get(fp);
    if (match !== undefined) {
      skipped.push(`${p.name}: identical to existing plan '${match}'`);
    } else if (seen.has(fp)) {
      skipped.push(`${p.name}: duplicate within the file`);
    } else {
      seen.add(fp);
      plans.push(p);
    }
  }
  return { plans, skipped };
}
