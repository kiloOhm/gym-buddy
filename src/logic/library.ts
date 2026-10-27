// Exercise library export/import: merging custom entries over the built-ins, the file format,
// validation and diffing. Pure functions, no Expo imports (file/share/picker live in planFiles.ts).
import {
  EQUIPMENT,
  type Equipment,
  type Exercise,
  MOVEMENT_PATTERNS,
  type MovementPattern,
  MUSCLE_GROUPS,
  type MuscleGroup,
  type Rating,
} from '@/types';

export const LIBRARY_EXPORT_FORMAT = 'gym-buddy-exercises';
export const LIBRARY_EXPORT_VERSION = 2;
/** Version 1 files carried formDifficulty + injuryRisk instead of difficulty; they still import. */
const LEGACY_LIBRARY_VERSION = 1;
export const LEGACY_RATINGS_WARNING = 'Converted form/injury ratings to the single difficulty score';

export interface LibraryExportFile {
  format: 'gym-buddy-exercises';
  version: 2;
  exportedAt: string;
  exercises: Exercise[];
}

export interface ParsedLibrary {
  exercises: Exercise[];
  warnings: string[];
}

export interface LibraryDiff {
  added: Exercise[];
  updated: Exercise[];
  unchanged: Exercise[];
}

const ID_PATTERN = /^[a-z0-9_]+$/;
const MAX_CUES = 4;

/**
 * Built-ins with custom entries layered on top: same id → the custom entry replaces the built-in;
 * new ids are appended (sorted by name). Output order: built-in order, then custom additions.
 */
export function mergeLibrary(builtIn: readonly Exercise[], custom: readonly Exercise[]): Exercise[] {
  const customById = new Map(custom.map((e) => [e.id, e]));
  const builtInIds = new Set(builtIn.map((e) => e.id));
  const merged = builtIn.map((e) => customById.get(e.id) ?? e);
  const additions = [...customById.values()]
    .filter((e) => !builtInIds.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...merged, ...additions];
}

/** The library as pretty-printed JSON (2 spaces). */
export function serializeLibrary(exercises: readonly Exercise[], now: Date = new Date()): string {
  const file: LibraryExportFile = {
    format: LIBRARY_EXPORT_FORMAT,
    version: LIBRARY_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    exercises: [...exercises],
  };
  return JSON.stringify(file, null, 2);
}

/** "gym-buddy-exercises-2026-10-27.json" (local calendar date). */
export function libraryFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gym-buddy-exercises-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Thrown inside validateEntry to skip the entry; the message becomes the warning. */
class SkipEntry extends Error {}

const EQUIPMENT_SET = new Set<string>(EQUIPMENT);
const PATTERN_SET = new Set<string>(MOVEMENT_PATTERNS);
const MUSCLE_SET = new Set<string>(MUSCLE_GROUPS);

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampRating(value: number): Rating {
  return Math.min(5, Math.max(1, Math.round(value))) as Rating;
}

/**
 * The single difficulty score for the old pair of ratings (library version 1 and persisted data
 * from before the change): the mean rounded half up, clamped to 1..5.
 */
export function difficultyFromLegacy(formDifficulty: number, injuryRisk: number): Rating {
  return clampRating(Math.ceil((formDifficulty + injuryRisk) / 2));
}

/** Context for one parse: whether any entry had its difficulty derived from the old ratings. */
interface ParseContext {
  warnings: string[];
  convertedLegacy: boolean;
}

function readDifficulty(raw: Record<string, unknown>, label: string, ctx: ParseContext): Rating {
  if (raw.difficulty === undefined && isNumber(raw.formDifficulty) && isNumber(raw.injuryRisk)) {
    ctx.convertedLegacy = true;
    return difficultyFromLegacy(raw.formDifficulty, raw.injuryRisk);
  }
  if (!isNumber(raw.difficulty)) throw new SkipEntry('difficulty must be a number from 1 to 5');
  const value = clampRating(raw.difficulty);
  if (value !== raw.difficulty) ctx.warnings.push(`${label}: difficulty ${raw.difficulty} adjusted to ${value}`);
  return value;
}

function validateEntry(raw: unknown, position: number, ctx: ParseContext): Exercise {
  const { warnings } = ctx;
  if (!isRecord(raw)) throw new SkipEntry(`entry ${position} is not an object`);

  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    throw new SkipEntry('id must be lowercase letters, digits and underscores');
  }
  const id = raw.id;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) throw new SkipEntry('name is missing');
  const label = `${name} (${id})`;

  if (!Array.isArray(raw.equipment) || raw.equipment.length === 0) {
    throw new SkipEntry('equipment must be a non-empty list');
  }
  for (const item of raw.equipment) {
    if (typeof item !== 'string' || !EQUIPMENT_SET.has(item)) {
      throw new SkipEntry(`unknown equipment '${String(item)}'`);
    }
  }
  const equipment = [...new Set(raw.equipment as Equipment[])];

  if (typeof raw.pattern !== 'string' || !PATTERN_SET.has(raw.pattern)) {
    throw new SkipEntry(`unknown movement pattern '${String(raw.pattern)}'`);
  }
  const pattern = raw.pattern as MovementPattern;

  if (typeof raw.compound !== 'boolean') throw new SkipEntry('compound must be true or false');
  const compound = raw.compound;

  if (!isRecord(raw.muscles)) throw new SkipEntry('muscles must be an object');
  const entries = Object.entries(raw.muscles);
  if (entries.length === 0) throw new SkipEntry('muscles is empty');
  for (const [muscle, value] of entries) {
    if (!MUSCLE_SET.has(muscle)) throw new SkipEntry(`unknown muscle group '${muscle}'`);
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
      throw new SkipEntry(`activation for ${muscle} must be a number above 0 and at most 1`);
    }
  }
  const values = entries as [MuscleGroup, number][];
  const max = Math.max(...values.map(([, v]) => v));
  const muscles: Partial<Record<MuscleGroup, number>> = {};
  if (max < 1) {
    for (const [muscle, value] of values) {
      muscles[muscle] = value === max ? 1 : Math.max(0.01, Math.round((value / max) * 100) / 100);
    }
    warnings.push(`${label}: muscle activations scaled so the primary target is 1`);
  } else {
    for (const [muscle, value] of values) muscles[muscle] = value;
  }

  const difficulty = readDifficulty(raw, label, ctx);

  let cues: string[] = [];
  if (raw.cues !== undefined) {
    if (!Array.isArray(raw.cues)) throw new SkipEntry('cues must be a list of strings');
    for (const cue of raw.cues) {
      if (typeof cue !== 'string') throw new SkipEntry('cues must be a list of strings');
    }
    cues = (raw.cues as string[]).map((c) => c.trim());
    if (cues.some((c) => !c)) {
      cues = cues.filter(Boolean);
      warnings.push(`${label}: empty cues removed`);
    }
    if (cues.length > MAX_CUES) {
      cues = cues.slice(0, MAX_CUES);
      warnings.push(`${label}: only the first ${MAX_CUES} cues kept`);
    }
  }

  return { id, name, equipment, pattern, compound, muscles, difficulty, cues };
}

/** How an invalid entry is named in a warning: id, else name, else its position. */
function entryLabel(raw: unknown, position: number): string {
  if (isRecord(raw)) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (name && id) return `${name} (${id})`;
    if (id || name) return id || name;
  }
  return `Exercise ${position}`;
}

/**
 * Parses an exported library file. Throws an Error with a human-readable message when the file
 * as a whole is unusable; invalid entries are skipped and fixable ones adjusted, both with warnings.
 */
export function parseLibraryExport(json: string): ParsedLibrary {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!isRecord(data) || data.format !== LIBRARY_EXPORT_FORMAT) {
    throw new Error('This is not a Gym Buddy exercise library file.');
  }
  if (data.version !== LIBRARY_EXPORT_VERSION && data.version !== LEGACY_LIBRARY_VERSION) {
    throw new Error(
      `Unsupported file version (${String(data.version)}). Update Gym Buddy and try again.`,
    );
  }
  if (!Array.isArray(data.exercises)) {
    throw new Error('The file does not contain a list of exercises.');
  }

  const ctx: ParseContext = { warnings: [], convertedLegacy: false };
  const { warnings } = ctx;
  const byId = new Map<string, Exercise>();
  data.exercises.forEach((raw: unknown, index) => {
    const position = index + 1;
    let exercise: Exercise;
    try {
      exercise = validateEntry(raw, position, ctx);
    } catch (e) {
      if (!(e instanceof SkipEntry)) throw e;
      warnings.push(`${entryLabel(raw, position)}: skipped, ${e.message}`);
      return;
    }
    if (byId.has(exercise.id)) {
      warnings.push(`${exercise.id}: appears more than once, the last entry is used`);
      byId.delete(exercise.id);
    }
    byId.set(exercise.id, exercise);
  });

  if (ctx.convertedLegacy) warnings.unshift(LEGACY_RATINGS_WARNING);
  return { exercises: [...byId.values()], warnings };
}

/** JSON with object keys sorted, so key order does not matter. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Deep equality of two exercises, independent of key order. */
export function exercisesEqual(a: Exercise, b: Exercise): boolean {
  return canonical(a) === canonical(b);
}

/** Compares incoming entries with the current library by id, using a canonical deep comparison (key order independent). */
export function diffLibrary(incoming: readonly Exercise[], current: readonly Exercise[]): LibraryDiff {
  const currentById = new Map(current.map((e) => [e.id, e]));
  const diff: LibraryDiff = { added: [], updated: [], unchanged: [] };
  for (const e of incoming) {
    const existing = currentById.get(e.id);
    if (!existing) diff.added.push(e);
    else if (exercisesEqual(e, existing)) diff.unchanged.push(e);
    else diff.updated.push(e);
  }
  return diff;
}
