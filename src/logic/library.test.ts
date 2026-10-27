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
    formDifficulty: 2,
    injuryRisk: 2,
    cues: ['Stay tight'],
    ...partial,
  };
}

const A = ex({ id: 'a', name: 'Alpha' });
const B = ex({ id: 'b', name: 'Bravo' });
const C = ex({ id: 'c', name: 'Charlie' });

function file(exercises: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'gym-buddy-exercises', version: 1, exportedAt: 'x', exercises, ...extra });
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
    const editedB = { ...B, formDifficulty: 5 as const };
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
      version: 1,
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
    expect(() => parseLibraryExport(file([], { version: 2 }))).toThrow('Unsupported file version (2)');
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
    ['a non-numeric formDifficulty', { formDifficulty: 'hard' }, 'formDifficulty must be a number'],
    ['a missing injuryRisk', { injuryRisk: undefined }, 'injuryRisk must be a number'],
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

  it('clamps out-of-range ratings with a warning', () => {
    const { exercises, warnings } = parseOne({ formDifficulty: 7, injuryRisk: 0 });
    expect(exercises[0].formDifficulty).toBe(5);
    expect(exercises[0].injuryRisk).toBe(1);
    expect(warnings).toEqual([
      'Alpha (a): formDifficulty 7 adjusted to 5',
      'Alpha (a): injuryRisk 0 adjusted to 1',
    ]);
  });

  it('rounds fractional ratings with a warning', () => {
    const { exercises, warnings } = parseOne({ formDifficulty: 2.6 });
    expect(exercises[0].formDifficulty).toBe(3);
    expect(warnings).toEqual(['Alpha (a): formDifficulty 2.6 adjusted to 3']);
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
        injuryRisk: A.injuryRisk,
        formDifficulty: A.formDifficulty,
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
