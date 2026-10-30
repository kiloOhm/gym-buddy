import { useRouter } from 'expo-router';

import { ExerciseList } from '@/components/ExerciseList';
import { useExerciseLibrary } from '@/store';

export default function ExercisesScreen() {
  const router = useRouter();
  const exercises = useExerciseLibrary();
  return (
    <ExerciseList
      exercises={exercises}
      onPress={(ex) => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
    />
  );
}
