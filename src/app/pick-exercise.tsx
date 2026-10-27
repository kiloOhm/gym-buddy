import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { ExerciseList } from '@/components/ExerciseList';
import { useExerciseLibrary, useGymStore } from '@/store';
import type { Exercise } from '@/types';

/**
 * Exercise picker (modal). Query params, all optional:
 * - planId: add the picked exercise to that plan
 * - sessionAdd: '1' adds it to the active session
 * - sessionSwap: a session-exercise id to swap for the picked exercise
 * - exclude: comma-separated exercise ids to hide
 */
export default function PickExerciseScreen() {
  const params = useLocalSearchParams<{
    planId?: string;
    sessionAdd?: string;
    sessionSwap?: string;
    exclude?: string;
  }>();
  const library = useExerciseLibrary();
  const availableEquipment = useGymStore((s) => s.settings.availableEquipment);
  const addExerciseToPlan = useGymStore((s) => s.addExerciseToPlan);
  const addSessionExercise = useGymStore((s) => s.addSessionExercise);
  const swapExercise = useGymStore((s) => s.swapExercise);

  const exclude = typeof params.exclude === 'string' ? params.exclude : '';
  const exercises = useMemo(() => {
    const hidden = new Set(exclude.split(',').map((s) => s.trim()).filter(Boolean));
    return hidden.size ? library.filter((e) => !hidden.has(e.id)) : library;
  }, [exclude, library]);

  const onPress = (exercise: Exercise) => {
    if (params.planId) addExerciseToPlan(params.planId, exercise.id);
    else if (params.sessionSwap) swapExercise(params.sessionSwap, exercise.id);
    else if (params.sessionAdd === '1') addSessionExercise(exercise.id);
    if (router.canGoBack()) router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Pick exercise', presentation: 'modal' }} />
      <ExerciseList exercises={exercises} availableEquipment={availableEquipment} onPress={onPress} />
    </>
  );
}
