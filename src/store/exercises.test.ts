import { BUILT_IN_EXERCISES, getExercise, getExercises } from '@/data/exercises';
import { migratePersistedState, PERSIST_VERSION, useGymStore } from '@/store';
import type { Exercise } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const builtIn = (id: string): Exercise => {
  const e = BUILT_IN_EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};

const custom: Exercise = {
  id: 'zercher_carry',
  name: 'Zercher carry',
  equipment: ['barbell'],
  pattern: 'carry',
  compound: true,
  muscles: { upper_back: 1, abs: 0.6 },
  difficulty: 3,
  cues: [],
};

describe('store: exercise library', () => {
  beforeEach(() => useGymStore.getState().resetExerciseLibrary());

  it('adds new and edited entries and syncs the registry', () => {
    const editedSquat = { ...builtIn('barbell_back_squat'), difficulty: 5 as const };
    const result = useGymStore.getState().importExercises([custom, editedSquat, builtIn('leg_press')]);
    expect(result).toEqual({ added: 1, updated: 1, unchanged: 1 });
    expect(useGymStore.getState().customExercises).toEqual([custom, editedSquat]);
    expect(getExercise('zercher_carry')).toEqual(custom);
    expect(getExercise('barbell_back_squat')?.difficulty).toBe(5);
    expect(getExercises()).toHaveLength(BUILT_IN_EXERCISES.length + 1);
  });

  it('re-importing an unmodified built-in removes the override', () => {
    const squat = builtIn('barbell_back_squat');
    useGymStore.getState().importExercises([{ ...squat, difficulty: 5 }]);
    expect(useGymStore.getState().customExercises).toHaveLength(1);
    const result = useGymStore.getState().importExercises(BUILT_IN_EXERCISES);
    expect(result.updated).toBe(1);
    expect(useGymStore.getState().customExercises).toEqual([]);
    expect(getExercise('barbell_back_squat')).toBe(squat);
  });

  it('importing the unmodified library stores nothing', () => {
    const result = useGymStore.getState().importExercises(BUILT_IN_EXERCISES);
    expect(result).toEqual({ added: 0, updated: 0, unchanged: BUILT_IN_EXERCISES.length });
    expect(useGymStore.getState().customExercises).toEqual([]);
  });

  it('reset restores the built-in library', () => {
    useGymStore.getState().importExercises([custom]);
    useGymStore.getState().resetExerciseLibrary();
    expect(getExercise('zercher_carry')).toBeUndefined();
    expect(getExercises()).toEqual(BUILT_IN_EXERCISES);
  });
});

describe('store: persisted state migration', () => {
  it('drops the removed equipment list from version 0 and 1 settings', () => {
    for (const version of [0, 1]) {
      const migrated = migratePersistedState(
        { settings: { availableEquipment: ['barbell', 'bench'], weightUnit: 'lb' }, plans: [] },
        version,
      ) as { settings: Record<string, unknown>; plans: unknown[] };
      expect(migrated.settings).toEqual({ weightUnit: 'lb' });
      expect(migrated.plans).toEqual([]);
    }
  });

  it('leaves current state and state without settings alone', () => {
    const current = { settings: { weightUnit: 'kg' }, plans: [] };
    expect(migratePersistedState(current, PERSIST_VERSION)).toEqual(current);
    expect(migratePersistedState({ settings: { weightUnit: 'kg' } }, 1)).toEqual({ settings: { weightUnit: 'kg' } });
    expect(migratePersistedState({ plans: [] }, 1)).toEqual({ plans: [] });
  });

  it('derives difficulty for imported exercises saved with the old ratings', () => {
    const { difficulty: _difficulty, ...rest } = custom;
    const old = { ...rest, formDifficulty: 3, injuryRisk: 4 };
    const migrated = migratePersistedState({ customExercises: [old, custom] }, 0) as { customExercises: Exercise[] };
    expect(migrated.customExercises).toEqual([{ ...custom, difficulty: 4 }, custom]);
  });
});
