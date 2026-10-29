import { getExerciseMap } from '@/data/exercises';
import type { Exercise, WorkoutSession } from '@/types';

import {
  dedupeSessions,
  type ExportedSession,
  formatHistoryDate,
  historyFileName,
  parseHistoryExport,
  serializeHistory,
} from './historyExport';
import { formatSessionDate } from './sessionFormat';

const NOW = new Date(2026, 9, 29, 21, 0, 0); // local time, 29 Oct 2026

const PUSH: ExportedSession = {
  id: 'mh3k2x9abc123',
  planId: 'mh3k2x8plan01',
  planName: 'Push',
  startedAt: '2026-10-29T14:12:00.000Z',
  finishedAt: '2026-10-29T14:26:30.000Z',
  exercises: [
    {
      id: 'mh3k2x9ex0001',
      exerciseId: 'dumbbell_bench_press',
      substitutedFor: 'barbell_bench_press',
      targetSets: 5,
      targetReps: 6,
      restSec: 150,
      sets: [
        { reps: 6, weight: 80, completed: true },
        { reps: 6, weight: 82.5, completed: false },
      ],
    },
  ],
};

const FREE: ExportedSession = {
  id: 'free-1',
  planName: 'Free workout',
  startedAt: '2026-10-27T10:00:00.000Z',
  finishedAt: '2026-10-27T11:00:00.000Z',
  deload: true,
  exercises: [
    {
      id: 'free-ex-1',
      exerciseId: 'overhead_press',
      targetSets: 3,
      targetReps: 8,
      restSec: 120,
      sets: [{ reps: 8, weight: 40, completed: true }],
    },
  ],
};

const PUSH_LABEL = `Push on ${formatSessionDate(PUSH.finishedAt)}`;

function fileWith(sessions: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: 'gym-buddy-history',
    version: 1,
    exportedAt: NOW.toISOString(),
    weightUnit: 'kg',
    sessions,
    ...extra,
  });
}

/** A valid raw session with one exercise, patched. */
function rawSession(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(PUSH)), ...patch };
}

function rawExercise(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(PUSH.exercises[0])), ...patch };
}

function fixtureExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    equipment: ['bodyweight'],
    pattern: 'isolation',
    compound: false,
    muscles: { chest: 1 },
    difficulty: 1,
    cues: [],
  };
}

describe('serializeHistory', () => {
  it('writes the exact file text in field order with 2-space indentation', () => {
    const exportedAt = new Date('2026-10-29T15:04:05.123Z');
    expect(serializeHistory([PUSH, FREE], 'kg', exportedAt)).toBe(`{
  "format": "gym-buddy-history",
  "version": 1,
  "exportedAt": "2026-10-29T15:04:05.123Z",
  "weightUnit": "kg",
  "sessions": [
    {
      "id": "mh3k2x9abc123",
      "planId": "mh3k2x8plan01",
      "planName": "Push",
      "startedAt": "2026-10-29T14:12:00.000Z",
      "finishedAt": "2026-10-29T14:26:30.000Z",
      "exercises": [
        {
          "id": "mh3k2x9ex0001",
          "exerciseId": "dumbbell_bench_press",
          "substitutedFor": "barbell_bench_press",
          "targetSets": 5,
          "targetReps": 6,
          "restSec": 150,
          "sets": [
            {
              "reps": 6,
              "weight": 80,
              "completed": true
            },
            {
              "reps": 6,
              "weight": 82.5,
              "completed": false
            }
          ]
        }
      ]
    },
    {
      "id": "free-1",
      "planName": "Free workout",
      "startedAt": "2026-10-27T10:00:00.000Z",
      "finishedAt": "2026-10-27T11:00:00.000Z",
      "deload": true,
      "exercises": [
        {
          "id": "free-ex-1",
          "exerciseId": "overhead_press",
          "targetSets": 3,
          "targetReps": 8,
          "restSec": 120,
          "sets": [
            {
              "reps": 8,
              "weight": 40,
              "completed": true
            }
          ]
        }
      ]
    }
  ]
}`);
  });

  it('writes fields in file order even when the stored key order differs', () => {
    const scrambled = {
      exercises: [
        {
          sets: [{ completed: true, weight: 80, reps: 6 }],
          restSec: 150,
          targetReps: 6,
          targetSets: 5,
          exerciseId: 'dumbbell_bench_press',
          id: 'e1',
        },
      ],
      finishedAt: PUSH.finishedAt,
      startedAt: PUSH.startedAt,
      planName: 'Push',
      id: 's1',
    } as WorkoutSession;
    const json = serializeHistory([scrambled], 'kg', NOW);
    const session = JSON.parse(json).sessions[0];
    expect(Object.keys(session)).toEqual(['id', 'planName', 'startedAt', 'finishedAt', 'exercises']);
    expect(Object.keys(session.exercises[0])).toEqual([
      'id',
      'exerciseId',
      'targetSets',
      'targetReps',
      'restSec',
      'sets',
    ]);
    expect(Object.keys(session.exercises[0].sets[0])).toEqual(['reps', 'weight', 'completed']);
  });

  it('records the weight unit and does not convert weights', () => {
    const parsed = JSON.parse(serializeHistory([PUSH], 'lb', NOW));
    expect(parsed.weightUnit).toBe('lb');
    expect(parsed.sessions[0].exercises[0].sets[1].weight).toBe(82.5);
  });

  it('skips unfinished sessions', () => {
    const active: WorkoutSession = { ...PUSH, id: 'active', finishedAt: undefined };
    const parsed = JSON.parse(serializeHistory([active, FREE], 'kg', NOW));
    expect(parsed.sessions.map((s: WorkoutSession) => s.id)).toEqual(['free-1']);
  });

  it('round-trips through parseHistoryExport', () => {
    const result = parseHistoryExport(serializeHistory([PUSH, FREE], 'kg', NOW), 'kg');
    expect(result.warnings).toEqual([]);
    expect(result.sessions).toEqual([PUSH, FREE]);
  });
});

describe('historyFileName', () => {
  it('uses the local date', () => {
    expect(historyFileName(NOW)).toBe('gym-buddy-history-2026-10-29.json');
    expect(historyFileName(new Date(2026, 0, 5, 0, 30))).toBe('gym-buddy-history-2026-01-05.json');
  });
});

describe('formatHistoryDate', () => {
  it('formats like the History list', () => {
    expect(formatHistoryDate(PUSH.finishedAt)).toBe(formatSessionDate(PUSH.finishedAt));
  });
});

describe('parseHistoryExport errors', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseHistoryExport('{not json', 'kg')).toThrow('The file is not valid JSON.');
  });

  it('rejects a missing or wrong format', () => {
    const message = 'This is not a Gym Buddy history file.';
    expect(() => parseHistoryExport(JSON.stringify({ version: 1, sessions: [] }), 'kg')).toThrow(message);
    expect(() => parseHistoryExport(fileWith([], { format: 'gym-buddy-plans' }), 'kg')).toThrow(message);
    expect(() => parseHistoryExport('[]', 'kg')).toThrow(message);
    expect(() => parseHistoryExport('null', 'kg')).toThrow(message);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseHistoryExport(fileWith([], { version: 2 }), 'kg')).toThrow(
      'Unsupported file version (2). Update Gym Buddy and try again.',
    );
    expect(() => parseHistoryExport(fileWith([], { version: undefined }), 'kg')).toThrow(
      'Unsupported file version (undefined).',
    );
  });

  it('rejects sessions that are not an array', () => {
    const message = 'The file does not contain a list of workouts.';
    expect(() => parseHistoryExport(fileWith({ id: 'x' }), 'kg')).toThrow(message);
    expect(() => parseHistoryExport(fileWith(undefined), 'kg')).toThrow(message);
  });
});

describe('parseHistoryExport sessions', () => {
  it('skips sessions without an id, numbered by position', () => {
    const result = parseHistoryExport(fileWith(['x', rawSession({ id: '' }), rawSession({ id: 3 }), rawSession()]), 'kg');
    expect(result.sessions.map((s) => s.id)).toEqual([PUSH.id]);
    expect(result.warnings).toEqual([
      'Workout 1: skipped, no id',
      'Workout 2: skipped, no id',
      'Workout 3: skipped, no id',
    ]);
  });

  it('skips unfinished sessions', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ finishedAt: undefined }), rawSession({ id: 'b', finishedAt: 'yesterday' })]),
      'kg',
    );
    expect(result.sessions).toEqual([]);
    expect(result.warnings).toEqual(['Workout 1: skipped, not finished', 'Workout 2: skipped, not finished']);
  });

  it('skips sessions with an invalid start time', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ startedAt: 'soon' }), rawSession({ id: 'b', startedAt: 12 })]),
      'kg',
    );
    expect(result.sessions).toEqual([]);
    expect(result.warnings).toEqual([
      `${PUSH_LABEL}: skipped, invalid start time`,
      `${PUSH_LABEL}: skipped, invalid start time`,
    ]);
  });

  it('skips sessions without an exercise list', () => {
    const result = parseHistoryExport(fileWith([rawSession({ exercises: {} })]), 'kg');
    expect(result.sessions).toEqual([]);
    expect(result.warnings).toEqual([`${PUSH_LABEL}: skipped, no exercise list`]);
  });

  it('trims the plan name and falls back to "Workout" without a warning', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ planName: '  Legs  ' }), rawSession({ id: 'b', planName: '  ' }), rawSession({ id: 'c', planName: undefined })]),
      'kg',
    );
    expect(result.sessions.map((s) => s.planName)).toEqual(['Legs', 'Workout', 'Workout']);
    expect(result.warnings).toEqual([]);
  });

  it('keeps a boolean deload and drops anything else', () => {
    const result = parseHistoryExport(
      fileWith([
        rawSession({ deload: false }),
        rawSession({ id: 'b', deload: 'yes' }),
        rawSession({ id: 'c', deload: 1 }),
        rawSession({ id: 'd', deload: null }),
      ]),
      'kg',
    );
    expect(result.sessions.map((s) => s.deload)).toEqual([false, undefined, undefined, undefined]);
    expect(result.sessions.map((s) => 'deload' in s)).toEqual([true, false, false, false]);
    expect(result.warnings).toEqual([]);
  });

  it('writes deload false but omits a non-boolean one', () => {
    const json = serializeHistory([{ ...PUSH, deload: false }, { ...PUSH, id: 'x', deload: 'yes' as unknown as boolean }], 'kg', NOW);
    const [a, b] = JSON.parse(json).sessions;
    expect(Object.keys(a)).toEqual(['id', 'planId', 'planName', 'startedAt', 'finishedAt', 'deload', 'exercises']);
    expect(a.deload).toBe(false);
    expect('deload' in b).toBe(false);
  });

  it('keeps a string planId and drops anything else', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ planId: 42 }), rawSession({ id: 'b', planId: null })]),
      'kg',
    );
    expect(result.sessions.map((s) => 'planId' in s)).toEqual([false, false]);
    expect(result.warnings).toEqual([]);
  });

  it('imports a session with no exercises without a warning', () => {
    const result = parseHistoryExport(fileWith([rawSession({ exercises: [] })]), 'kg');
    expect(result.sessions).toEqual([{ ...PUSH, exercises: [] }]);
    expect(result.warnings).toEqual([]);
  });
});

describe('parseHistoryExport exercises and sets', () => {
  const dumbbell = getExerciseMap().dumbbell_bench_press.name;

  it('skips exercises without an exercise id', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ exercises: [{ targetSets: 3 }, 'x', rawExercise({ exerciseId: '' }), rawExercise()] })]),
      'kg',
    );
    expect(result.sessions[0].exercises).toEqual(PUSH.exercises);
    expect(result.warnings).toEqual([
      `${PUSH_LABEL}: skipped exercise 1 without an exercise id`,
      `${PUSH_LABEL}: skipped exercise 2 without an exercise id`,
      `${PUSH_LABEL}: skipped exercise 3 without an exercise id`,
    ]);
  });

  it('gives an exercise without an id a fresh one', () => {
    const result = parseHistoryExport(fileWith([rawSession({ exercises: [rawExercise({ id: undefined })] })]), 'kg');
    const id = result.sessions[0].exercises[0].id;
    expect(typeof id).toBe('string');
    expect(id).not.toBe('');
    expect(result.warnings).toEqual([]);
  });

  it('keeps a string substitutedFor and drops anything else', () => {
    const result = parseHistoryExport(
      fileWith([rawSession({ exercises: [rawExercise({ substitutedFor: 7 })] })]),
      'kg',
    );
    expect('substitutedFor' in result.sessions[0].exercises[0]).toBe(false);
  });

  it('rounds counts, clamps negatives to 0 and defaults invalid ones to 0 with a warning', () => {
    const result = parseHistoryExport(
      fileWith([
        rawSession({
          exercises: [rawExercise({ targetSets: 3.6, targetReps: -2, restSec: 'long' })],
        }),
        rawSession({
          id: 'b',
          exercises: [rawExercise({ targetSets: undefined, targetReps: null, restSec: Infinity })],
        }),
      ]),
      'kg',
    );
    expect(result.sessions.map(({ exercises: [e] }) => [e.targetSets, e.targetReps, e.restSec])).toEqual([
      [4, 0, 0],
      [0, 0, 0],
    ]);
    expect(result.warnings).toEqual([
      `${PUSH_LABEL}: invalid restSec for ${dumbbell}, using 0`,
      `${PUSH_LABEL}: invalid targetSets for ${dumbbell}, using 0`,
      `${PUSH_LABEL}: invalid targetReps for ${dumbbell}, using 0`,
      `${PUSH_LABEL}: invalid restSec for ${dumbbell}, using 0`,
    ]);
  });

  it('uses an empty set list when sets is not an array', () => {
    const result = parseHistoryExport(fileWith([rawSession({ exercises: [rawExercise({ sets: 'none' })] })]), 'kg');
    expect(result.sessions[0].exercises[0].sets).toEqual([]);
    expect(result.warnings).toEqual([`${PUSH_LABEL}: ${dumbbell} has no set list`]);
  });

  it('fixes up sets and skips invalid ones', () => {
    const result = parseHistoryExport(
      fileWith([
        rawSession({
          exercises: [
            rawExercise({
              sets: [
                { reps: 5.4, weight: 82.5 },
                { reps: -3, weight: -10, completed: true },
                { reps: 5, weight: '80', completed: true },
                { weight: 80, completed: true },
                { reps: 5, weight: 80, completed: 'yes' },
                'set',
              ],
            }),
          ],
        }),
      ]),
      'kg',
    );
    expect(result.sessions[0].exercises[0].sets).toEqual([
      { reps: 5, weight: 82.5, completed: false },
      { reps: 0, weight: 0, completed: true },
    ]);
    const skippedSet = `${PUSH_LABEL}: skipped an invalid set of ${dumbbell}`;
    expect(result.warnings).toEqual([skippedSet, skippedSet, skippedSet, skippedSet]);
  });

  it('keeps unknown exercises with one warning per session listing the ids', () => {
    const result = parseHistoryExport(
      fileWith([
        rawSession({
          exercises: [
            rawExercise({ exerciseId: 'foo_bar', id: 'a' }),
            rawExercise({ exerciseId: 'baz', id: 'b' }),
            rawExercise({ exerciseId: 'foo_bar', id: 'c', sets: {} }),
          ],
        }),
      ]),
      'kg',
    );
    expect(result.sessions[0].exercises.map((e) => e.exerciseId)).toEqual(['foo_bar', 'baz', 'foo_bar']);
    expect(result.warnings).toEqual([
      `${PUSH_LABEL}: foo_bar has no set list`,
      `${PUSH_LABEL}: unknown exercises kept as 'Unknown exercise': foo_bar, baz`,
    ]);
  });

  it('honours a custom exercise db for names and unknown ids', () => {
    const db = { my_move: fixtureExercise('my_move', 'My move') };
    const result = parseHistoryExport(
      fileWith([
        rawSession({
          exercises: [rawExercise({ exerciseId: 'my_move', restSec: undefined }), rawExercise({ id: 'b' })],
        }),
      ]),
      'kg',
      db,
    );
    expect(result.warnings).toEqual([
      `${PUSH_LABEL}: invalid restSec for My move, using 0`,
      `${PUSH_LABEL}: unknown exercises kept as 'Unknown exercise': dumbbell_bench_press`,
    ]);
  });
});

describe('parseHistoryExport weight unit', () => {
  it('warns first when the file unit differs from the app unit', () => {
    const result = parseHistoryExport(fileWith(['x'], { weightUnit: 'lb' }), 'kg');
    expect(result.warnings).toEqual([
      "The file's weights are in lb, your unit is kg. They are imported as entered, without conversion.",
      'Workout 1: skipped, no id',
    ]);
  });

  it('does not warn for a matching, missing or invalid unit', () => {
    expect(parseHistoryExport(fileWith([], { weightUnit: 'lb' }), 'lb').warnings).toEqual([]);
    expect(parseHistoryExport(fileWith([], { weightUnit: undefined }), 'kg').warnings).toEqual([]);
    expect(parseHistoryExport(fileWith([], { weightUnit: 'stone' }), 'kg').warnings).toEqual([]);
  });
});

describe('dedupeSessions', () => {
  it('skips sessions already in the history', () => {
    const result = dedupeSessions([PUSH, FREE], [PUSH]);
    expect(result.sessions).toEqual([FREE]);
    expect(result.skipped).toEqual([`${PUSH_LABEL}: already in your history`]);
  });

  it('skips duplicates within the file, keeping the first occurrence', () => {
    const later = { ...PUSH, planName: 'Push again' };
    const result = dedupeSessions([PUSH, FREE, later], []);
    expect(result.sessions).toEqual([PUSH, FREE]);
    expect(result.skipped).toEqual([`Push again on ${formatSessionDate(PUSH.finishedAt)}: duplicate within the file`]);
  });

  it('keeps everything when nothing matches', () => {
    const result = dedupeSessions([PUSH, FREE], [{ ...PUSH, id: 'other' }]);
    expect(result.sessions).toEqual([PUSH, FREE]);
    expect(result.skipped).toEqual([]);
  });
});
