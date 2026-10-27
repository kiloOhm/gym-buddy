import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { equipmentSummary } from '@/components/ExerciseList';
import { MuscleCoverageBars } from '@/components/MuscleCoverageBars';
import { ValueStepper } from '@/components/ValueStepper';
import { getExercise } from '@/data/exercises';
import { computeCoverage, summarizePlan } from '@/logic/coverage';
import { exportPlansToFile } from '@/logic/planFiles';
import { useGymStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { MUSCLE_LABELS, type MuscleGroup, type PlannedExercise } from '@/types';

export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useGymStore((s) => s.plans.find((p) => p.id === id));
  const activeSession = useGymStore((s) => s.activeSession);
  const updatePlan = useGymStore((s) => s.updatePlan);
  const updatePlannedExercise = useGymStore((s) => s.updatePlannedExercise);
  const removePlannedExercise = useGymStore((s) => s.removePlannedExercise);
  const movePlannedExercise = useGymStore((s) => s.movePlannedExercise);
  const startSession = useGymStore((s) => s.startSession);

  const [name, setName] = useState(plan?.name ?? '');

  const exercises = plan?.exercises;
  const items = useMemo(
    () => (exercises ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })),
    [exercises],
  );
  const coverage = useMemo(() => computeCoverage(items), [items]);
  const [tapped, setTapped] = useState<MuscleGroup | undefined>();
  const summary = useMemo(() => summarizePlan(items), [items]);

  if (!plan) {
    return (
      <>
        <Stack.Screen options={{ title: 'Plan' }} />
        <EmptyState title="Plan not found" hint="It may have been deleted.">
          <Button title="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/plans'))} />
        </EmptyState>
      </>
    );
  }

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(plan.name);
      return;
    }
    if (trimmed !== plan.name) updatePlan(plan.id, { name: trimmed });
  };

  const confirmRemove = (pe: PlannedExercise) => {
    const exName = getExercise(pe.exerciseId)?.name ?? 'this exercise';
    Alert.alert('Remove exercise?', `Remove ${exName} from the plan?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePlannedExercise(plan.id, pe.id) },
    ]);
  };

  const exportPlan = async () => {
    try {
      await exportPlansToFile([plan]);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    }
  };

  const start = () => {
    startSession(plan.id);
    router.navigate('/(tabs)/workout');
  };

  const summaryLine =
    summary.totalSets === 0
      ? 'No sets planned yet.'
      : [
          `${summary.totalSets} set${summary.totalSets === 1 ? '' : 's'}`,
          `form difficulty ${summary.avgFormDifficulty.toFixed(1)}/5`,
          `highest injury risk ${summary.maxInjuryRisk}/5${summary.riskiest ? ` (${summary.riskiest.name})` : ''}`,
        ].join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: plan.name || 'Plan' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Plan name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            returnKeyType="done"
            style={styles.nameInput}
            placeholder="Plan name"
            placeholderTextColor={colors.muted}
          />
          <Button title="Export" variant="secondary" small onPress={exportPlan} style={styles.exportButton} />
        </View>

        {plan.exercises.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No exercises yet. Add some to build your plan.</Text>
          </View>
        ) : (
          plan.exercises.map((pe, index) => {
            const ex = getExercise(pe.exerciseId);
            return (
              <View key={pe.id} style={styles.card}>
                <View style={styles.exHeader}>
                  <Pressable
                    style={styles.flex}
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: pe.exerciseId } })}
                    accessibilityRole="link"
                  >
                    <Text style={styles.exName} numberOfLines={2}>
                      {index + 1}. {ex?.name ?? `Unknown exercise (${pe.exerciseId})`}
                    </Text>
                    {ex ? <Text style={styles.muted}>{equipmentSummary(ex)}</Text> : null}
                  </Pressable>
                  <IconButton
                    name="chevron-up"
                    label="Move up"
                    disabled={index === 0}
                    onPress={() => movePlannedExercise(plan.id, pe.id, -1)}
                  />
                  <IconButton
                    name="chevron-down"
                    label="Move down"
                    disabled={index === plan.exercises.length - 1}
                    onPress={() => movePlannedExercise(plan.id, pe.id, 1)}
                  />
                  <IconButton name="trash-outline" label="Remove" onPress={() => confirmRemove(pe)} />
                </View>
                <View style={styles.steppers}>
                  <ValueStepper
                    label="Sets"
                    value={pe.sets}
                    min={1}
                    max={10}
                    onChange={(sets) => updatePlannedExercise(plan.id, pe.id, { sets })}
                  />
                  <ValueStepper
                    label="Reps"
                    value={pe.reps}
                    min={1}
                    max={30}
                    onChange={(reps) => updatePlannedExercise(plan.id, pe.id, { reps })}
                  />
                  <ValueStepper
                    label="Rest"
                    value={pe.restSec}
                    min={0}
                    max={600}
                    step={15}
                    format={(v) => `${v}s`}
                    onChange={(restSec) => updatePlannedExercise(plan.id, pe.id, { restSec })}
                  />
                </View>
              </View>
            );
          })
        )}

        <Button
          title="Add exercise"
          variant="secondary"
          onPress={() => router.push({ pathname: '/pick-exercise', params: { planId: plan.id } })}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Muscle coverage</Text>
          <Text style={styles.muted}>{summaryLine}</Text>
          <BodyMap values={coverage} onPressMuscle={setTapped} selected={tapped} />
          {tapped ? (
            <Text style={styles.muted}>
              {MUSCLE_LABELS[tapped]}: {coverage[tapped].toFixed(1)} effective sets
            </Text>
          ) : null}
          <MuscleCoverageBars coverage={coverage} />
        </View>

        {activeSession ? (
          <View style={styles.card}>
            <Text style={styles.muted}>A workout is in progress ({activeSession.planName}).</Text>
            <Button title="Go to workout" onPress={() => router.navigate('/(tabs)/workout')} />
          </View>
        ) : (
          <Button title="Start workout" onPress={start} disabled={plan.exercises.length === 0} />
        )}
      </ScrollView>
    </>
  );
}

function IconButton({
  name,
  label,
  onPress,
  disabled,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.iconButton, (pressed || disabled) && { opacity: 0.35 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={20} color={colors.text} />
    </Pressable>
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
    gap: spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, color: colors.muted },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  muted: { fontSize: 13, color: colors.muted },
  exportButton: { alignSelf: 'flex-start' },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  exName: { fontSize: 15, fontWeight: '600', color: colors.text },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  steppers: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
});
