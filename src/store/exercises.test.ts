import { BUILT_IN_EXERCISES, getExercise, getExercises } from '@/data/exercises';
import { useGymStore } from '@/store';
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
  formDifficulty: 3,
  injuryRisk: 3,
  cues: [],
};

describe('store: exercise library', () => {
  beforeEach(() => useGymStore.getState().resetExerciseLibrary());

  it('adds new and edited entries and syncs the registry', () => {
    const editedSquat = { ...builtIn('barbell_back_squat'), formDifficulty: 5 as const };
    const result = useGymStore.getState().importExercises([custom, editedSquat, builtIn('leg_press')]);
    expect(result).toEqual({ added: 1, updated: 1, unchanged: 1 });
    expect(useGymStore.getState().customExercises).toEqual([custom, editedSquat]);
    expect(getExercise('zercher_carry')).toEqual(custom);
    expect(getExercise('barbell_back_squat')?.formDifficulty).toBe(5);
    expect(getExercises()).toHaveLength(BUILT_IN_EXERCISES.length + 1);
  });

  it('re-importing an unmodified built-in removes the override', () => {
    const squat = builtIn('barbell_back_squat');
    useGymStore.getState().importExercises([{ ...squat, injuryRisk: 5 }]);
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
