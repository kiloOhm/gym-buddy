import type { SessionExercise, WorkoutSession } from '@/types';

import { swapTargetSnapshot } from './swap';

function sx(id: string, exerciseId: string): SessionExercise {
  return { id, exerciseId, targetSets: 3, targetReps: 10, restSec: 90, sets: [] };
}

const session: WorkoutSession = {
  id: 's1',
  planName: 'Push',
  startedAt: '2026-01-01T10:00:00.000Z',
  exercises: [sx('a', 'barbell_bench'), sx('b', 'overhead_press')],
};

describe('swapTargetSnapshot', () => {
  it('finds the session exercise and lists the session exercise ids', () => {
    const snap = swapTargetSnapshot(session, 'b');
    expect(snap.sessionExercise).toBe(session.exercises[1]);
    expect(snap.sessionIds).toEqual(['barbell_bench', 'overhead_press']);
  });

  it('returns no session exercise for an unknown id or no session', () => {
    expect(swapTargetSnapshot(session, 'zzz').sessionExercise).toBeUndefined();
    expect(swapTargetSnapshot(null, 'a')).toEqual({ sessionExercise: undefined, sessionIds: [] });
    expect(swapTargetSnapshot(undefined, undefined).sessionIds).toEqual([]);
  });

  it('is not affected by later changes to the session', () => {
    const live: WorkoutSession = { ...session, exercises: [...session.exercises] };
    const snap = swapTargetSnapshot(live, 'a');
    live.exercises = live.exercises.map((e) => (e.id === 'a' ? { ...e, exerciseId: 'dumbbell_bench' } : e));
    expect(snap.sessionExercise?.exerciseId).toBe('barbell_bench');
    expect(snap.sessionIds).toEqual(['barbell_bench', 'overhead_press']);
  });
});
