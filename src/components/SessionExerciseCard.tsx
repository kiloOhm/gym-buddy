import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { alert } from '@/components/alert';
import { Button } from '@/components/Button';
import { ExerciseFigure } from '@/components/ExerciseFigure';
import { lastPerformance } from '@/logic/history';
import { formatSetList, formatWeight, parseNumberInput } from '@/logic/sessionFormat';
import { exerciseStats, type ExerciseStats } from '@/logic/stats';
import { useExerciseMap, useGymStore } from '@/store';
import { useRestStore } from '@/store/rest';
import { colors, radius, spacing } from '@/theme';
import type { Exercise, SessionExercise, SetLog, WeightUnit } from '@/types';

interface Props {
  sessionExercise: SessionExercise;
  unit: WeightUnit;
  /** Deload workout: adds a target weight of about 90 % of the last performance. */
  deload?: boolean;
}

/** Share of the last heaviest weight suggested in a deload workout, rounded to DELOAD_STEP. */
const DELOAD_FACTOR = 0.9;
const DELOAD_STEP = 0.5;

/** One exercise of the active workout: targets, last-time hint, editable set rows and actions. */
export const SessionExerciseCard = memo(function SessionExerciseCard({ sessionExercise, unit, deload }: Props) {
  const router = useRouter();
  const ex = sessionExercise;
  const sessions = useGymStore((s) => s.sessions);
  const addSet = useGymStore((s) => s.addSet);
  const removeSet = useGymStore((s) => s.removeSet);
  const removeSessionExercise = useGymStore((s) => s.removeSessionExercise);

  const db = useExerciseMap();
  const exercise = db[ex.exerciseId] as Exercise | undefined;
  const name = exercise?.name ?? 'Unknown exercise';
  const original = ex.substitutedFor ? (db[ex.substitutedFor]?.name ?? 'Unknown exercise') : undefined;
  const last = useMemo(() => lastPerformance(sessions, ex.exerciseId), [sessions, ex.exerciseId]);
  const deloadTarget = useMemo(() => {
    if (!deload || !last) return undefined;
    const heaviest = Math.max(0, ...last.sets.map((s) => s.weight));
    return heaviest > 0 ? Math.round((heaviest * DELOAD_FACTOR) / DELOAD_STEP) * DELOAD_STEP : undefined;
  }, [deload, last]);
  const stats = useMemo(
    () => exerciseStats(sessions, ex.exerciseId, ex.targetReps),
    [sessions, ex.exerciseId, ex.targetReps],
  );

  const confirmRemove = () =>
    alert('Remove exercise?', `${name} and its logged sets will be removed from this workout.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSessionExercise(ex.id) },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        {exercise ? <ExerciseFigure exercise={exercise} variant="thumb" size={44} /> : null}
        <Text style={[styles.name, styles.flex]}>{name}</Text>
        <Pressable
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.exerciseId } })}
          style={({ pressed }) => [styles.infoButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Exercise details"
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.muted}>
        {ex.targetSets} × {ex.targetReps} · rest {ex.restSec} s
      </Text>
      {original ? <Text style={styles.muted}>Swapped in for {original}</Text> : null}
      {stats ? <StatsStrip stats={stats} unit={unit} /> : null}
      {last ? <Text style={styles.hint}>Last: {formatSetList(last.sets, unit)}</Text> : null}
      {deloadTarget !== undefined ? (
        <Text style={styles.hint}>
          Deload target: ≈ {formatWeight(deloadTarget)} {unit}
        </Text>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={[styles.colIndex, styles.colHeader]}>Set</Text>
        <Text style={[styles.colInput, styles.colHeader]}>{unit}</Text>
        <Text style={[styles.colInput, styles.colHeader]}>Reps</Text>
        <Text style={[styles.colDone, styles.colHeader]}>Done</Text>
      </View>
      {ex.sets.map((set, i) => (
        // Keyed on the exercise too, so a swap (which rebuilds the sets) resets the inputs.
        <SetRow key={`${ex.exerciseId}-${i}`} sessionExerciseId={ex.id} index={i} set={set} restSec={ex.restSec} />
      ))}

      <View style={styles.actions}>
        <Button small variant="secondary" title="+ Set" onPress={() => addSet(ex.id)} />
        {ex.sets.length > 1 ? (
          <Button small variant="secondary" title="− Set" onPress={() => removeSet(ex.id, ex.sets.length - 1)} />
        ) : null}
        <View style={styles.spacer} />
        <Button
          small
          variant="ghost"
          title="Swap"
          onPress={() => router.push({ pathname: '/swap/[id]', params: { id: ex.id } })}
        />
        <Button small variant="danger" title="Remove" onPress={confirmRemove} />
      </View>
    </View>
  );
});

/** Best / last / 30-day average for the target rep range; "~" marks values estimated from other rep counts. */
function StatsStrip({ stats, unit }: { stats: ExerciseStats; unit: WeightUnit }) {
  const prefix = stats.approximate ? '~' : '';
  const value = (w: number | undefined) => (w === undefined ? '–' : `${prefix}${formatWeight(w)} ${unit}`);
  const reps = `${stats.range.min}–${stats.range.max}`;
  const columns: [string, number | undefined][] = [
    ['Best', stats.best],
    ['Last', stats.last],
    ['30d avg', stats.avg30d],
  ];
  return (
    <View style={styles.stats}>
      <View style={styles.statsRow}>
        {columns.map(([label, w]) => (
          <View key={label} style={styles.statsCol}>
            <Text style={styles.statsLabel}>{label}</Text>
            <Text style={styles.statsValue}>{value(w)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.statsLabel}>
        {stats.approximate
          ? `~ estimated from other rep counts (no sets logged at ${reps} reps)`
          : `for ${reps} reps`}
      </Text>
    </View>
  );
}

interface SetRowProps {
  sessionExerciseId: string;
  index: number;
  set: SetLog;
  /** Planned rest for this exercise; ticking the set done starts the rest timer. */
  restSec: number;
}

function SetRow({ sessionExerciseId, index, set, restSec }: SetRowProps) {
  const logSet = useGymStore((s) => s.logSet);
  // Local text so partial input like "7." survives; the store gets the parsed number.
  const [weightText, setWeightText] = useState(() => (set.weight ? formatWeight(set.weight) : ''));
  const [repsText, setRepsText] = useState(() => (set.reps ? String(set.reps) : ''));

  const onWeight = (text: string) => {
    const cleaned = text.replace(/[^0-9.,]/g, '');
    setWeightText(cleaned);
    logSet(sessionExerciseId, index, { weight: parseNumberInput(cleaned, true) });
  };
  const onReps = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setRepsText(cleaned);
    logSet(sessionExerciseId, index, { reps: parseNumberInput(cleaned, false) });
  };
  const onToggleDone = () => {
    const completed = !set.completed;
    logSet(sessionExerciseId, index, { completed });
    if (completed) useRestStore.getState().start(restSec);
  };

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <Text style={[styles.colIndex, styles.index]}>{index + 1}</Text>
      <TextInput
        style={[styles.colInput, styles.input]}
        value={weightText}
        onChangeText={onWeight}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} weight`}
      />
      <TextInput
        style={[styles.colInput, styles.input]}
        value={repsText}
        onChangeText={onReps}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} reps`}
      />
      <View style={styles.colDone}>
        <Pressable
          onPress={onToggleDone}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={`Set ${index + 1} done`}
          style={[styles.check, set.completed && styles.checkOn]}
        >
          <Text style={[styles.checkMark, set.completed && styles.checkMarkOn]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  flex: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 13, color: colors.primary, marginTop: spacing.xs },
  stats: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statsCol: { flex: 1 },
  statsLabel: { fontSize: 12, color: colors.muted },
  statsValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  colHeader: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  colIndex: { width: 32 },
  colInput: { flex: 1 },
  colDone: { width: 52, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  setRowDone: { backgroundColor: colors.successSoft },
  index: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  input: {
    minWidth: 0, // let the inputs shrink on narrow screens so the Done column stays visible
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 20, fontWeight: '700', color: colors.border },
  checkMarkOn: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  spacer: { flex: 1 },
});
