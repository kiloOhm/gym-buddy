import { router } from 'expo-router';

import { ExerciseList } from '@/components/ExerciseList';
import { EXERCISES } from '@/data/exercises';
import { useGymStore } from '@/store';

export default function ExercisesScreen() {
  const availableEquipment = useGymStore((s) => s.settings.availableEquipment);
  return (
    <ExerciseList
      exercises={EXERCISES}
      availableEquipment={availableEquipment}
      onPress={(ex) => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
    />
  );
}
