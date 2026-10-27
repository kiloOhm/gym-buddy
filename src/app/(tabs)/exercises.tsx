import { router } from 'expo-router';

import { ExerciseList } from '@/components/ExerciseList';
import { useExerciseLibrary, useGymStore } from '@/store';

export default function ExercisesScreen() {
  const exercises = useExerciseLibrary();
  const availableEquipment = useGymStore((s) => s.settings.availableEquipment);
  return (
    <ExerciseList
      exercises={exercises}
      availableEquipment={availableEquipment}
      onPress={(ex) => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
    />
  );
}
