import { BUILT_IN_EXERCISES } from '@/data/exercises';
import type { Exercise } from '@/types';

import {
  diffLibrary,
  exercisesEqual,
  libraryFileName,
  mergeLibrary,
  parseLibraryExport,
  serializeLibrary,
} from './library';

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise {
  return {
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    muscles: { biceps: 1 },
    difficulty: 2,
    cues: ['Stay tight'],
    ...partial,
  };
}

const A = ex({ id: 'a', name: 'Alpha' });
const B = ex({ id: 'b', name: 'Bravo' });
const C = ex({ id: 'c', name: 'Charlie' });

function file(exercises: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'gym-buddy-exercises', version: 2, exportedAt: 'x', exercises, ...extra });
}

/** A version 1 entry: formDifficulty + injuryRisk instead of difficulty. */
function legacy(e: Exercise, formDifficulty: unknown, injuryRisk: unknown): Record<string, unknown> {
  const { difficulty: _difficulty, ...rest } = e;
  return { ...rest, formDifficulty, injuryRisk };
}

/** Parses a file with a single entry built from a valid one plus overrides. */
function parseOne(overrides: Record<string, unknown>) {
  return parseLibraryExport(file([{ ...A, ...overrides }]));
}

describe('mergeLibrary', () => {
  it('returns the built-ins when there are no custom entries', () => {
    expect(mergeLibrary([A, B], [])).toEqual([A, B]);
  });

  it('replaces built-ins with custom entries of the same id, in place', () => {
    const editedB = { ...B, difficulty: 5 as const };
    expect(mergeLibrary([A, B, C], [editedB])).toEqual([A, editedB, C]);
  });

  it('appends new ids after the built-ins, sorted by name', () => {
    const zulu = ex({ id: 'z', name: 'Zulu' });
    const delta = ex({ id: 'd', name: 'Delta' });
    const editedA = { ...A, name: 'Alpha 2' };
    expect(mergeLibrary([A, B], [zulu, editedA, delta]).map((e) => e.id)).toEqual(['a', 'b', 'd', 'z']);
    expect(mergeLibrary([A, B], [zulu, editedA, delta])[0]).toBe(editedA);
  });
});

describe('serializeLibrary / libraryFileName', () => {
  const now = new Date(2026, 9, 7, 12, 0, 0);

  it('writes pretty JSON with the file header', () => {
    const json = serializeLibrary([A, B], now);
    const data = JSON.parse(json);
    expect(data).toEqual({
      format: 'gym-buddy-exercises',
      version: 2,
      exportedAt: now.toISOString(),
      exercises: [A, B],
    });
    expect(json).toContain('\n  "format"');
  });

  it('round-trips the whole built-in library without warnings', () => {
    const parsed = parseLibraryExport(serializeLibrary(BUILT_IN_EXERCISES, now));
    expect(parsed.warnings).toEqual([]);
    expect(parsed.exercises).toEqual(BUILT_IN_EXERCISES);
    const diff = diffLibrary(parsed.exercises, BUILT_IN_EXERCISES);
    expect(diff.unchanged).toHaveLength(BUILT_IN_EXERCISES.length);
    expect(diff.added).toHaveLength(0);
    expect(diff.updated).toHaveLength(0);
  });

  it('names the file after the local date', () => {
    expect(libraryFileName(now)).toBe('gym-buddy-exercises-2026-10-07.json');
  });
});

describe('parseLibraryExport: whole-file errors', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseLibraryExport('{nope')).toThrow('not valid JSON');
  });

  it.each([
    ['a plans file', JSON.stringify({ format: 'gym-buddy-plans', version: 1, plans: [] })],
    ['a missing format', JSON.stringify({ version: 1, exercises: [] })],
    ['an array', '[]'],
    ['null', 'null'],
  ])('rejects %s', (_label, json) => {
    expect(() => parseLibraryExport(json)).toThrow('not a Gym Buddy exercise library file');
  });

  it('rejects an unsupported version', () => {
    expect(() => parseLibraryExport(file([], { version: 3 }))).toThrow('Unsupported file version (3)');
    expect(() => parseLibraryExport(file([], { version: undefined }))).toThrow('Unsupported file version');
  });

  it('rejects a missing exercise list', () => {
    expect(() => parseLibraryExport(file([], { exercises: { a: 1 } }))).toThrow('list of exercises');
  });

  it('accepts an empty list', () => {
    expect(parseLibraryExport(file([]))).toEqual({ exercises: [], warnings: [] });
  });
});

describe('parseLibraryExport: entries', () => {
  it('accepts a valid entry unchanged', () => {
    expect(parseOne({})).toEqual({ exercises: [A], warnings: [] });
  });

  it('drops unknown keys and trims the name', () => {
    const { exercises, warnings } = parseOne({ name: '  Alpha  ', note: 'x' });
    expect(exercises).toEqual([A]);
    expect(warnings).toEqual([]);
  });

  it('skips entries that are not objects', () => {
    const { exercises, warnings } = parseLibraryExport(file([42, A]));
    expect(exercises).toEqual([A]);
    expect(warnings).toEqual(['Exercise 1: skipped, entry 1 is not an object']);
  });

  it.each([
    ['a missing id', { id: undefined }, 'id must be'],
    ['an id with capitals', { id: 'Bad_Id' }, 'id must be'],
    ['an id with dashes', { id: 'bad-id' }, 'id must be'],
    ['a missing name', { name: undefined }, 'name is missing'],
    ['a blank name', { name: '   ' }, 'name is missing'],
    ['missing equipment', { equipment: undefined }, 'equipment must be a non-empty list'],
    ['empty equipment', { equipment: [] }, 'equipment must be a non-empty list'],
    ['unknown equipment', { equipment: ['rope'] }, "unknown equipment 'rope'"],
    ['an unknown pattern', { pattern: 'jump' }, "unknown movement pattern 'jump'"],
    ['a non-boolean compound', { compound: 'yes' }, 'compound must be true or false'],
    ['missing muscles', { muscles: undefined }, 'muscles must be an object'],
    ['muscles as an array', { muscles: ['biceps'] }, 'muscles must be an object'],
    ['empty muscles', { muscles: {} }, 'muscles is empty'],
    ['an unknown muscle', { muscles: { biceps: 1, neck: 0.5 } }, "unknown muscle group 'neck'"],
    ['a zero activation', { muscles: { biceps: 1, forearms: 0 } }, 'activation for forearms'],
    ['an activation above 1', { muscles: { biceps: 1.2 } }, 'activation for biceps'],
    ['a string activation', { muscles: { biceps: '1' } }, 'activation for biceps'],
    ['a non-numeric difficulty', { difficulty: 'hard' }, 'difficulty must be a number from 1 to 5'],
    ['a missing difficulty', { difficulty: undefined }, 'difficulty must be a number from 1 to 5'],
    ['a NaN-like difficulty', { difficulty: null }, 'difficulty must be a number from 1 to 5'],
    ['cues that are not a list', { cues: 'Stay tight' }, 'cues must be a list of strings'],
    ['a non-string cue', { cues: ['ok', 3] }, 'cues must be a list of strings'],
  ])('skips an entry with %s', (_label, overrides, problem) => {
    const { exercises, warnings } = parseOne(overrides);
    expect(exercises).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('skipped');
    expect(warnings[0]).toContain(problem);
  });

  it('names a skipped entry by name and id', () => {
    expect(parseOne({ pattern: 'jump' }).warnings[0]).toMatch(/^Alpha \(a\): skipped/);
    expect(parseOne({ name: '' }).warnings[0]).toMatch(/^a: skipped/);
  });

  it('keeps the valid entries next to skipped ones', () => {
    const { exercises } = parseLibraryExport(file([A, { ...B, pattern: 'jump' }, C]));
    expect(exercises).toEqual([A, C]);
  });

  it('dedupes equipment', () => {
    const { exercises, warnings } = parseOne({ equipment: ['dumbbell', 'bench', 'dumbbell'] });
    expect(exercises[0].equipment).toEqual(['dumbbell', 'bench']);
    expect(warnings).toEqual([]);
  });

  it('scales activations so the max becomes 1, with a warning', () => {
    const { exercises, warnings } = parseOne({ muscles: { biceps: 0.8, forearms: 0.4, lats: 0.2 } });
    expect(exercises[0].muscles).toEqual({ biceps: 1, forearms: 0.5, lats: 0.25 });
    expect(warnings).toEqual(['Alpha (a): muscle activations scaled so the primary target is 1']);
  });

  it('clamps an out-of-range difficulty with a warning', () => {
    const high = parseOne({ difficulty: 7 });
    expect(high.exercises[0].difficulty).toBe(5);
    expect(high.warnings).toEqual(['Alpha (a): difficulty 7 adjusted to 5']);
    const low = parseOne({ difficulty: 0 });
    expect(low.exercises[0].difficulty).toBe(1);
    expect(low.warnings).toEqual(['Alpha (a): difficulty 0 adjusted to 1']);
  });

  it('rounds a fractional difficulty with a warning', () => {
    const { exercises, warnings } = parseOne({ difficulty: 2.6 });
    expect(exercises[0].difficulty).toBe(3);
    expect(warnings).toEqual(['Alpha (a): difficulty 2.6 adjusted to 3']);
  });

  it('treats missing cues as none', () => {
    const { exercises, warnings } = parseOne({ cues: undefined });
    expect(exercises[0].cues).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('trims cues and drops empty ones with a warning', () => {
    const { exercises, warnings } = parseOne({ cues: ['  Brace  ', '', '   '] });
    expect(exercises[0].cues).toEqual(['Brace']);
    expect(warnings).toEqual(['Alpha (a): empty cues removed']);
  });

  it('truncates more than 4 cues with a warning', () => {
    const { exercises, warnings } = parseOne({ cues: ['1', '2', '3', '4', '5'] });
    expect(exercises[0].cues).toEqual(['1', '2', '3', '4']);
    expect(warnings).toEqual(['Alpha (a): only the first 4 cues kept']);
  });

  it('uses the last of duplicate ids, with a warning', () => {
    const second = { ...A, name: 'Alpha again' };
    const { exercises, warnings } = parseLibraryExport(file([A, B, second]));
    expect(exercises).toEqual([B, second]);
    expect(warnings).toEqual(['a: appears more than once, the last entry is used']);
  });
});

describe('parseLibraryExport: version 1 files', () => {
  function v1(exercises: unknown[]): string {
    return file(exercises, { version: 1 });
  }

  it('derives difficulty as the mean of the old ratings, rounded half up', () => {
    const { exercises, warnings } = parseLibraryExport(
      v1([legacy(A, 2, 2), legacy(B, 3, 4), legacy(C, 1, 2)]),
    );
    expect(exercises.map((e) => e.difficulty)).toEqual([2, 4, 2]);
    expect(exercises[0]).toEqual(A);
    expect(exercises[1]).not.toHaveProperty('formDifficulty');
    expect(exercises[1]).not.toHaveProperty('injuryRisk');
    expect(warnings).toEqual(['Converted form/injury ratings to the single difficulty score']);
  });

  it('clamps converted ratings to 1..5', () => {
    const { exercises, warnings } = parseLibraryExport(v1([legacy(A, 7, 9), legacy(B, 0, -1)]));
    expect(exercises.map((e) => e.difficulty)).toEqual([5, 1]);
    expect(warnings).toEqual(['Converted form/injury ratings to the single difficulty score']);
  });

  it('round-trips the built-in library through the old format', () => {
    const old = BUILT_IN_EXERCISES.map((e) => legacy(e, e.difficulty, e.difficulty));
    const { exercises, warnings } = parseLibraryExport(v1(old));
    expect(exercises).toEqual(BUILT_IN_EXERCISES);
    expect(warnings).toEqual(['Converted form/injury ratings to the single difficulty score']);
  });

  it('skips entries whose old ratings are missing or not numbers', () => {
    const { exercises, warnings } = parseLibraryExport(v1([legacy(A, 'hard', 2), legacy(B, 2, undefined), legacy(C, 2, 3)]));
    expect(exercises.map((e) => e.id)).toEqual(['c']);
    expect(warnings).toEqual([
      'Converted form/injury ratings to the single difficulty score',
      'Alpha (a): skipped, difficulty must be a number from 1 to 5',
      'Bravo (b): skipped, difficulty must be a number from 1 to 5',
    ]);
  });

  it('prefers difficulty when an entry has both, without the conversion warning', () => {
    const { exercises, warnings } = parseLibraryExport(v1([{ ...legacy(A, 5, 5), difficulty: 1 }]));
    expect(exercises[0].difficulty).toBe(1);
    expect(warnings).toEqual([]);
  });

  it('also converts old ratings found in a version 2 file', () => {
    const { exercises, warnings } = parseLibraryExport(file([legacy(A, 3, 4)]));
    expect(exercises[0].difficulty).toBe(4);
    expect(warnings).toEqual(['Converted form/injury ratings to the single difficulty score']);
  });
});

describe('diffLibrary', () => {
  it('classifies incoming entries by id against the current library', () => {
    const editedB = { ...B, cues: ['Different'] };
    const newD = ex({ id: 'd', name: 'Delta' });
    const diff = diffLibrary([A, editedB, newD], [A, B, C]);
    expect(diff.added).toEqual([newD]);
    expect(diff.updated).toEqual([editedB]);
    expect(diff.unchanged).toEqual([A]);
  });

  it('ignores key order when comparing', () => {
    const reordered = JSON.parse(
      JSON.stringify({
        cues: A.cues,
        difficulty: A.difficulty,
        muscles: A.muscles,
        compound: A.compound,
        pattern: A.pattern,
        equipment: A.equipment,
        name: A.name,
        id: A.id,
      }),
    ) as Exercise;
    expect(exercisesEqual(reordered, A)).toBe(true);
    expect(diffLibrary([reordered], [A]).unchanged).toEqual([reordered]);
  });

  it('treats a changed array order as a change', () => {
    const swapped = { ...A, cues: ['b', 'a'] };
    expect(exercisesEqual(swapped, { ...A, cues: ['a', 'b'] })).toBe(false);
  });
});
