import {
  completedSetCount,
  formatElapsed,
  formatSessionDate,
  formatSetList,
  formatWeight,
  parseNumberInput,
  sessionDurationMin,
  sessionVolume,
} from './sessionFormat';
import type { WorkoutSession } from '@/types';

const session: WorkoutSession = {
  id: 's1',
  planName: 'Push',
  startedAt: '2026-01-01T10:00:00.000Z',
  finishedAt: '2026-01-01T10:45:20.000Z',
  exercises: [
    {
      id: 'e1',
      exerciseId: 'x',
      targetSets: 2,
      targetReps: 8,
      restSec: 90,
      sets: [
        { weight: 80, reps: 8, completed: true },
        { weight: 80, reps: 6, completed: false },
      ],
    },
    {
      id: 'e2',
      exerciseId: 'y',
      targetSets: 1,
      targetReps: 10,
      restSec: 60,
      sets: [{ weight: 12.5, reps: 10, completed: true }],
    },
  ],
};

describe('sessionFormat', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('00:00');
  });

  it('formats weights and set lists', () => {
    expect(formatWeight(80)).toBe('80');
    expect(formatWeight(82.5)).toBe('82.5');
    expect(
      formatSetList(
        [
          { weight: 80, reps: 8, completed: true },
          { weight: 80, reps: 7, completed: true },
        ],
        'kg',
      ),
    ).toBe('80 kg × 8, 80 × 7');
  });

  it('parses numeric input safely', () => {
    expect(parseNumberInput('', true)).toBe(0);
    expect(parseNumberInput('7.', true)).toBe(7);
    expect(parseNumberInput('7,5', true)).toBe(7.5);
    expect(parseNumberInput('7.5', false)).toBe(7);
    expect(parseNumberInput('abc', true)).toBe(0);
    expect(parseNumberInput('-3', true)).toBe(0);
  });

  it('computes volume, duration and completed sets', () => {
    expect(sessionVolume(session)).toBe(80 * 8 + 12.5 * 10);
    expect(sessionDurationMin(session)).toBe(45);
    expect(sessionDurationMin({ ...session, finishedAt: undefined })).toBeUndefined();
    expect(completedSetCount(session)).toBe(2);
  });
});

describe('formatSessionDate', () => {
  it('includes the day of month and year', () => {
    const text = formatSessionDate('2026-10-27T12:00:00Z');
    expect(text).toContain('27');
    expect(text).toContain('2026');
  });
});
