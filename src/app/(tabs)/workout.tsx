import { router, Stack } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import { Button } from '@/components/Button';
import { ElapsedTimer } from '@/components/ElapsedTimer';
import { EmptyState } from '@/components/EmptyState';
import { RestTimer } from '@/components/RestTimer';
import { SessionExerciseCard } from '@/components/SessionExerciseCard';
import { completedSetCount } from '@/logic/sessionFormat';
import { useGymStore } from '@/store';
import { useRestStore } from '@/store/rest';
import { colors, font, radius, spacing } from '@/theme';
import type { WorkoutSession } from '@/types';

export default function WorkoutScreen() {
  const activeSession = useGymStore((s) => s.activeSession);
  return (
    <>
      <Stack.Screen options={{ title: 'Workout' }} />
      {activeSession ? <ActiveWorkout session={activeSession} /> : <StartWorkout />}
    </>
  );
}

function StartWorkout() {
  const plans = useGymStore((s) => s.plans);
  const startSession = useGymStore((s) => s.startSession);
  const start = (planId?: string) => {
    useRestStore.getState().clear();
    startSession(planId);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={font.title}>Start a workout</Text>
      {plans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No plans yet"
            hint="Create a plan in the Plans tab, or start an empty workout and add exercises as you go."
          />
        </View>
      ) : (
        plans.map((plan) => (
          <View key={plan.id} style={[styles.card, styles.planRow]}>
            <View style={styles.flex}>
              <Text style={font.heading}>{plan.name}</Text>
              <Text style={font.small}>
                {plan.exercises.length} {plan.exercises.length === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
            <Button title="Start" onPress={() => start(plan.id)} />
          </View>
        ))
      )}
      <Button variant="secondary" title="Start empty workout" onPress={() => start()} />
    </ScrollView>
  );
}

function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const unit = useGymStore((s) => s.settings.weightUnit);
  const finishSession = useGymStore((s) => s.finishSession);
  const discardSession = useGymStore((s) => s.discardSession);

  const exerciseIds = session.exercises.map((e) => e.exerciseId);

  const finish = () => {
    finishSession();
    useRestStore.getState().clear();
  };
  const discard = () => {
    discardSession();
    useRestStore.getState().clear();
  };

  const confirmFinish = () => {
    const done = completedSetCount(session);
    const message =
      done === 0
        ? 'No sets are marked as done yet. Finish anyway? The workout will be saved without any completed sets.'
        : `Save this workout with ${done} completed ${done === 1 ? 'set' : 'sets'} to your history?`;
    alert('Finish workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  };

  const confirmDiscard = () =>
    alert('Discard workout?', 'Everything logged in this workout will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discard },
    ]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header and rest timer sit outside the ScrollView so they stay pinned while the list scrolls. */}
      <View style={styles.pinned}>
        <View style={styles.headerRow}>
          <Text style={[font.title, styles.flex]} numberOfLines={2}>
            {session.planName}
          </Text>
          <ElapsedTimer since={session.startedAt} style={styles.timer} />
        </View>
        <RestTimer />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {session.exercises.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={font.body}>No exercises yet.</Text>
            <Text style={font.small}>Add one below to start logging sets.</Text>
          </View>
        ) : (
          session.exercises.map((ex) => <SessionExerciseCard key={ex.id} sessionExercise={ex} unit={unit} />)
        )}

        <Button
          variant="secondary"
          title="Add exercise"
          onPress={() =>
            router.push({
              pathname: '/pick-exercise',
              params: { sessionAdd: '1', exclude: exerciseIds.join(',') },
            })
          }
        />
        <View style={styles.footer}>
          <Button title="Finish workout" onPress={confirmFinish} />
          <Button variant="danger" title="Discard" onPress={confirmDiscard} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyWrap: { paddingVertical: spacing.xl },
  emptyCard: { gap: spacing.xs, alignItems: 'center' },
  pinned: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timer: { fontSize: 20, fontWeight: '600', color: colors.primary },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
