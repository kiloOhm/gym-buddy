import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';

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

  // A second tap while the modal is closing must not add or swap twice, nor pop another screen.
  const picked = useRef(false);
  const onPress = (exercise: Exercise) => {
    if (picked.current) return;
    picked.current = true;
    if (params.planId) addExerciseToPlan(params.planId, exercise.id);
    else if (params.sessionSwap) swapExercise(params.sessionSwap, exercise.id);
    else if (params.sessionAdd === '1') addSessionExercise(exercise.id);
    // A swap came through the swap screen, which renders from a snapshot and would show the old
    // exercise if we only closed the picker, so drop both screens and land on the workout.
    if (params.sessionSwap && router.canDismiss()) router.dismiss(2);
    else if (router.canGoBack()) router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Pick exercise', presentation: 'modal' }} />
      <ExerciseList exercises={exercises} availableEquipment={availableEquipment} onPress={onPress} />
    </>
  );
}
