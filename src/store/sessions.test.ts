import { useGymStore } from '@/store';
import type { WorkoutSession } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const session = (id: string, finishedAt: string): WorkoutSession => ({
  id,
  planName: id,
  startedAt: finishedAt,
  finishedAt,
  exercises: [],
});

describe('store: importSessions', () => {
  it('appends with ids preserved and re-sorts newest first, keeping order for equal times', () => {
    const active: WorkoutSession = { id: 'active', planName: 'Now', startedAt: '2026-10-30T10:00:00.000Z', exercises: [] };
    useGymStore.setState({
      sessions: [session('b', '2026-10-28T10:00:00.000Z'), session('d', '2026-10-20T10:00:00.000Z')],
      activeSession: active,
    });
    const incoming = [
      session('a', '2026-10-29T10:00:00.000Z'),
      session('b2', '2026-10-28T10:00:00.000Z'),
      session('e', '2026-10-01T10:00:00.000Z'),
    ];
    const imported = useGymStore.getState().importSessions(incoming);
    expect(imported).toEqual(incoming);
    expect(useGymStore.getState().sessions.map((s) => s.id)).toEqual(['a', 'b', 'b2', 'd', 'e']);
    expect(useGymStore.getState().activeSession).toBe(active);
  });
});
