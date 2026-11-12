import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ExerciseFigure } from '@/components/ExerciseFigure';
import { equipmentSummary, formatPattern, MiniRating } from '@/components/ExerciseList';
import { ExerciseStatsStrip } from '@/components/ExerciseStatsStrip';
import { MuscleCoverageBars } from '@/components/MuscleCoverageBars';
import { computeCoverage, summarizePlan } from '@/logic/coverage';
import { lastPerformance } from '@/logic/history';
import { formatSessionDate, formatSetList } from '@/logic/sessionFormat';
import { exerciseStats } from '@/logic/stats';
import { useExerciseMap, useGymStore } from '@/store';
import { useRestStore } from '@/store/rest';
import { colors, font, radius, spacing } from '@/theme';
import {
  MUSCLE_LABELS,
  type Exercise,
  type MuscleGroup,
  type PlannedExercise,
  type WeightUnit,
  type WorkoutSession,
} from '@/types';

/** Muscle names at or above `min` activation, strongest first. */
function musclesAtLeast(exercise: Exercise, min: number, below = Infinity): string {
  return (Object.entries(exercise.muscles) as [MuscleGroup, number][])
    .filter(([, v]) => v >= min && v < below)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => MUSCLE_LABELS[m])
    .join(', ');
}

/** Read-only overview of a plan, opened from the Workout tab before starting it. */
export default function PlanOverviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useGymStore((s) => s.plans.find((p) => p.id === id));
  const sessions = useGymStore((s) => s.sessions);
  const unit = useGymStore((s) => s.settings.weightUnit);
  const startSession = useGymStore((s) => s.startSession);
  // Snapshot: starting a workout updates activeSession while this screen is being dismissed.
  const [hadActiveSession] = useState(() => useGymStore.getState().activeSession !== null);
  const starting = useRef(false);

  const db = useExerciseMap();
  const exercises = plan?.exercises;
  const items = useMemo(
    () => (exercises ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })),
    [exercises],
  );
  const coverage = useMemo(() => computeCoverage(items, db), [items, db]);
  const summary = useMemo(() => summarizePlan(items, db), [items, db]);
  const [tapped, setTapped] = useState<MuscleGroup | undefined>();
  const lastDone = useMemo(() => {
    let latest: string | undefined;
    for (const s of sessions) {
      if (s.planId === id && s.finishedAt && (!latest || s.finishedAt > latest)) latest = s.finishedAt;
    }
    return latest;
  }, [sessions, id]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/workout'));

  if (!plan) {
    return (
      <>
        <Stack.Screen options={{ title: 'Plan' }} />
        <EmptyState title="Plan not found" hint="It may have been deleted.">
          <Button title="Go back" variant="secondary" onPress={leave} />
        </EmptyState>
      </>
    );
  }

  const start = () => {
    if (starting.current) return;
    starting.current = true;
    useRestStore.getState().clear();
    startSession(plan.id);
    leave();
  };

  const totalLine = [
    `${plan.exercises.length} ${plan.exercises.length === 1 ? 'exercise' : 'exercises'}`,
    `${summary.totalSets} set${summary.totalSets === 1 ? '' : 's'}`,
  ].join(' · ');
  const difficultyLine =
    summary.totalSets === 0
      ? undefined
      : [
          `Avg difficulty ${summary.avgDifficulty.toFixed(1)}/5`,
          ...(summary.hardest ? [`hardest: ${summary.hardest.name} (${summary.maxDifficulty}/5)`] : []),
        ].join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: plan.name || 'Plan' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={font.title}>{plan.name}</Text>
          <Text style={styles.muted}>{totalLine}</Text>
          {difficultyLine ? <Text style={styles.muted}>{difficultyLine}</Text> : null}
          <Text style={styles.muted}>{lastDone ? `Last done: ${formatSessionDate(lastDone)}` : 'Not done yet'}</Text>
        </View>

        {plan.exercises.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>This plan has no exercises yet.</Text>
          </View>
        ) : (
          plan.exercises.map((pe, index) => (
            <PlannedExerciseCard
              key={pe.id}
              planned={pe}
              index={index}
              exercise={db[pe.exerciseId]}
              sessions={sessions}
              unit={unit}
              onInfo={() => router.push({ pathname: '/exercise/[id]', params: { id: pe.exerciseId } })}
            />
          ))
        )}

        {plan.exercises.length > 0 ? (
          <View style={styles.card}>
            <Text style={font.heading}>Muscle coverage</Text>
            <BodyMap values={coverage} onPressMuscle={setTapped} selected={tapped} />
            {tapped ? (
              <Text style={styles.muted}>
                {MUSCLE_LABELS[tapped]}: {coverage[tapped].toFixed(1)} effective sets
              </Text>
            ) : null}
            <MuscleCoverageBars coverage={coverage} />
          </View>
        ) : null}

        <View style={styles.footer}>
          {hadActiveSession ? (
            <Text style={styles.muted}>A workout is already in progress.</Text>
          ) : (
            <Button title="Start workout" onPress={start} disabled={plan.exercises.length === 0} />
          )}
          <Button
            variant="secondary"
            title="Edit plan"
            onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
          />
        </View>
      </ScrollView>
    </>
  );
}

function PlannedExerciseCard({
  planned,
  index,
  exercise,
  sessions,
  unit,
  onInfo,
}: {
  planned: PlannedExercise;
  index: number;
  exercise: Exercise | undefined;
  sessions: readonly WorkoutSession[];
  unit: WeightUnit;
  onInfo: () => void;
}) {
  const stats = useMemo(
    () => exerciseStats(sessions, planned.exerciseId, planned.reps),
    [sessions, planned.exerciseId, planned.reps],
  );
  const last = useMemo(() => lastPerformance(sessions, planned.exerciseId), [sessions, planned.exerciseId]);
  const primary = exercise ? musclesAtLeast(exercise, 1) : '';
  const secondary = exercise ? musclesAtLeast(exercise, 0.5, 1) : '';

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        {exercise ? <ExerciseFigure exercise={exercise} variant="thumb" size={44} /> : null}
        <Text style={[styles.exName, styles.flex]} numberOfLines={2}>
          {index + 1}. {exercise?.name ?? `Unknown exercise (${planned.exerciseId})`}
        </Text>
        <Pressable
          onPress={onInfo}
          style={({ pressed }) => [styles.infoButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Exercise details"
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.target}>
        {planned.sets} × {planned.reps} · rest {planned.restSec} s
      </Text>
      {exercise ? (
        <>
          <Text style={styles.muted}>
            {formatPattern(exercise.pattern)} · {exercise.compound ? 'Compound' : 'Isolation'}
          </Text>
          <Text style={styles.muted}>Equipment: {equipmentSummary(exercise)}</Text>
          {primary ? <Text style={styles.muted}>Targets: {primary}</Text> : null}
          {secondary ? <Text style={styles.muted}>Also works: {secondary}</Text> : null}
          <MiniRating label="Difficulty" value={exercise.difficulty} />
        </>
      ) : null}
      {stats ? <ExerciseStatsStrip stats={stats} unit={unit} /> : null}
      {last ? <Text style={styles.hint}>Last: {formatSetList(last.sets, unit)}</Text> : null}
    </View>
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
    gap: spacing.xs,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 17, fontWeight: '600', color: colors.text },
  target: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 13, color: colors.primary, marginTop: spacing.xs },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
});
