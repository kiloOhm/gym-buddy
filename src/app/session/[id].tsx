import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { alert } from '@/components/alert';
import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { DeloadPill } from '@/components/DeloadPill';
import { EmptyState } from '@/components/EmptyState';
import { MuscleCoverageBars } from '@/components/MuscleCoverageBars';
import { ValueStepper } from '@/components/ValueStepper';
import { computeCoverage } from '@/logic/coverage';
import { appendSet, removeExercise, removeSet, setDuration, shiftStart, updateSet } from '@/logic/sessionEdit';
import { formatWeight, parseNumberInput, sessionDurationMin } from '@/logic/sessionFormat';
import { useExerciseMap, useGymStore } from '@/store';
import { useSessionDraft } from '@/store/sessionDraft';
import { colors, font, radius, spacing } from '@/theme';
import type { SessionExercise, SetLog, WeightUnit, WorkoutSession } from '@/types';

const MINUTE = 60_000;
const DAY_MIN = 24 * 60;

export default function SessionDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useGymStore((s) => s.sessions.find((x) => x.id === id));
  const unit = useGymStore((s) => s.settings.weightUnit);
  const deleteSession = useGymStore((s) => s.deleteSession);
  const updateSession = useGymStore((s) => s.updateSession);
  const draftState = useSessionDraft((s) => s.draft);
  const db = useExerciseMap();

  const draft = draftState && draftState.id === id ? draftState : null;
  const dirty = draft !== null && session !== undefined && JSON.stringify(draft) !== JSON.stringify(session);

  // The draft belongs to this screen; leaving it (after the prompt below) drops unsaved edits.
  useEffect(() => () => useSessionDraft.getState().clear(), []);

  usePreventRemove(dirty, ({ data }) =>
    alert('Discard changes?', 'Your edits to this workout have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          useSessionDraft.getState().clear();
          navigation.dispatch(data.action);
        },
      },
    ]),
  );

  const shown = draft ?? session;
  const coverage = useMemo(
    () =>
      computeCoverage(
        (shown?.exercises ?? []).map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.filter((s) => s.completed).length,
        })),
        db,
      ),
    [shown, db],
  );

  if (!session) {
    return (
      <>
        <Stack.Screen options={{ title: 'Workout' }} />
        <EmptyState title="Workout not found" hint="It may have been deleted." />
      </>
    );
  }

  const confirmDelete = () =>
    alert('Delete workout?', 'This removes it from your history. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSession(session.id);
          router.back();
        },
      },
    ]);

  const save = () => {
    if (!draft) return;
    updateSession(draft);
    useSessionDraft.getState().clear();
  };
  const cancel = () => {
    if (!dirty) {
      useSessionDraft.getState().clear();
      return;
    }
    alert('Discard changes?', 'Your edits to this workout have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => useSessionDraft.getState().clear() },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: draft ? 'Edit workout' : session.planName }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {draft ? (
          <SessionEditor draft={draft} unit={unit} />
        ) : (
          <SessionView session={session} unit={unit} />
        )}

        <View style={styles.card}>
          <Text style={[font.heading, styles.cardTitle]}>Muscles worked</Text>
          <BodyMap values={coverage} />
          <MuscleCoverageBars coverage={coverage} />
        </View>

        {draft ? (
          <View style={styles.footer}>
            <Button title="Save changes" onPress={save} disabled={!dirty} />
            <Button variant="secondary" title="Cancel" onPress={cancel} />
          </View>
        ) : (
          <View style={styles.footer}>
            <Button variant="secondary" title="Edit workout" onPress={() => useSessionDraft.getState().begin(session)} />
            <Button variant="danger" title="Delete session" onPress={confirmDelete} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

function SessionView({ session, unit }: { session: WorkoutSession; unit: WeightUnit }) {
  const db = useExerciseMap();
  const started = new Date(session.startedAt);
  const duration = sessionDurationMin(session);
  return (
    <>
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <Text style={[font.title, styles.flex]}>{session.planName}</Text>
          {session.deload ? <DeloadPill /> : null}
        </View>
        <Text style={font.small}>
          {started.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · {started.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          {duration !== undefined ? ` · ${duration} min` : ''}
        </Text>
      </View>

      {session.exercises.map((ex) => {
        const name = db[ex.exerciseId]?.name ?? 'Unknown exercise';
        const original = ex.substitutedFor ? (db[ex.substitutedFor]?.name ?? 'Unknown exercise') : undefined;
        return (
          <View key={ex.id} style={styles.card}>
            <Text style={font.heading}>{name}</Text>
            {original ? <Text style={font.small}>Swapped in for {original}</Text> : null}
            <View style={styles.sets}>
              {ex.sets.map((s, i) => (
                <Text key={i} style={s.completed ? font.body : styles.skipped}>
                  {i + 1}. {formatWeight(s.weight)} {unit} × {s.reps}
                  {s.completed ? '' : ' (skipped)'}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

/** Edit mode: every change goes to the draft (useSessionDraft) until Save. */
function SessionEditor({ draft, unit }: { draft: WorkoutSession; unit: WeightUnit }) {
  const router = useRouter();
  const edit = useSessionDraft((s) => s.edit);
  const startMin = Math.round(Date.parse(draft.startedAt) / MINUTE);
  const duration = sessionDurationMin(draft) ?? 1;
  // A workout cannot end in the future ("now" = when editing began).
  const [nowMin] = useState(() => Math.floor(Date.now() / MINUTE));
  const latestStart = nowMin - duration;
  const moveStart = (value: number) => edit((d) => shiftStart(d, value - startMin));

  return (
    <>
      <View style={styles.card}>
        <Text style={font.heading}>{draft.planName}</Text>
        <View style={styles.steppers}>
          <ValueStepper
            label="Date"
            value={startMin}
            step={DAY_MIN}
            max={latestStart}
            min={0}
            format={(v) =>
              new Date(v * MINUTE).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
            }
            onChange={moveStart}
          />
          <ValueStepper
            label="Start"
            value={startMin}
            step={15}
            max={latestStart}
            min={0}
            format={(v) => new Date(v * MINUTE).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            onChange={moveStart}
          />
        </View>
        <DurationInput minutes={duration} onChange={(m) => edit((d) => setDuration(d, m))} />
      </View>

      {draft.exercises.length === 0 ? (
        <View style={styles.card}>
          <Text style={font.small}>No exercises. Add one below.</Text>
        </View>
      ) : (
        draft.exercises.map((ex) => <ExerciseEditor key={ex.id} exercise={ex} unit={unit} />)
      )}

      <Button
        variant="secondary"
        title="Add exercise"
        onPress={() =>
          router.push({
            pathname: '/pick-exercise',
            params: { draftAdd: '1', exclude: draft.exercises.map((e) => e.exerciseId).join(',') },
          })
        }
      />
    </>
  );
}

function DurationInput({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const [text, setText] = useState(String(minutes));
  return (
    <View style={styles.durationRow}>
      <Text style={[font.body, styles.flex]}>Duration (min)</Text>
      <TextInput
        style={[styles.input, styles.durationInput]}
        value={text}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9]/g, '');
          setText(cleaned);
          const n = parseNumberInput(cleaned, false);
          if (n >= 1) onChange(n);
        }}
        onBlur={() => setText(String(minutes))}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel="Duration in minutes"
      />
    </View>
  );
}

function ExerciseEditor({ exercise: ex, unit }: { exercise: SessionExercise; unit: WeightUnit }) {
  const db = useExerciseMap();
  const edit = useSessionDraft((s) => s.edit);
  const name = db[ex.exerciseId]?.name ?? 'Unknown exercise';

  const confirmRemove = () =>
    alert('Remove exercise?', `${name} and its sets will be removed from this workout.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => edit((d) => removeExercise(d, ex.id)) },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[font.heading, styles.flex]}>{name}</Text>
        <IconButton name="trash-outline" label={`Remove ${name}`} color={colors.danger} onPress={confirmRemove} />
      </View>
      <View style={styles.setHeader}>
        <Text style={[styles.colIndex, styles.colHeader]}>Set</Text>
        <Text style={[styles.colInput, styles.colHeader]}>{unit}</Text>
        <Text style={[styles.colInput, styles.colHeader]}>Reps</Text>
        <Text style={[styles.colDone, styles.colHeader]}>Done</Text>
        <View style={styles.colRemove} />
      </View>
      {ex.sets.map((set, i) => (
        // The set count is in the key so removing a set remounts the rows below it with their new values.
        <SetEditor
          key={`${i}-${ex.sets.length}`}
          index={i}
          set={set}
          canRemove={ex.sets.length > 1}
          onChange={(patch) => edit((d) => updateSet(d, ex.id, i, patch))}
          onRemove={() => edit((d) => removeSet(d, ex.id, i))}
        />
      ))}
      <View style={styles.actions}>
        <Button small variant="secondary" title="+ Set" onPress={() => edit((d) => appendSet(d, ex.id))} />
      </View>
    </View>
  );
}

function SetEditor({
  index,
  set,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  set: SetLog;
  canRemove: boolean;
  onChange: (patch: Partial<SetLog>) => void;
  onRemove: () => void;
}) {
  // Local text so partial input like "7." survives; the draft gets the parsed number.
  const [weightText, setWeightText] = useState(() => (set.weight ? formatWeight(set.weight) : ''));
  const [repsText, setRepsText] = useState(() => (set.reps ? String(set.reps) : ''));

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <Text style={[styles.colIndex, styles.index]}>{index + 1}</Text>
      <TextInput
        style={[styles.colInput, styles.input]}
        value={weightText}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9.,]/g, '');
          setWeightText(cleaned);
          onChange({ weight: parseNumberInput(cleaned, true) });
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} weight`}
      />
      <TextInput
        style={[styles.colInput, styles.input]}
        value={repsText}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9]/g, '');
          setRepsText(cleaned);
          onChange({ reps: parseNumberInput(cleaned, false) });
        }}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} reps`}
      />
      <View style={styles.colDone}>
        <Pressable
          onPress={() => onChange({ completed: !set.completed })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={`Set ${index + 1} done`}
          style={[styles.check, set.completed && styles.checkOn]}
        >
          <Text style={[styles.checkMark, set.completed && styles.checkMarkOn]}>✓</Text>
        </Pressable>
      </View>
      <View style={styles.colRemove}>
        {canRemove ? (
          <IconButton name="close" label={`Remove set ${index + 1}`} color={colors.muted} onPress={onRemove} />
        ) : null}
      </View>
    </View>
  );
}

function IconButton({
  name,
  label,
  color,
  onPress,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  headerBlock: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: { marginBottom: spacing.sm },
  sets: { gap: 2, marginTop: spacing.xs },
  skipped: { fontSize: 15, color: colors.muted },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
  steppers: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  durationInput: { width: 88 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  colHeader: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  colIndex: { width: 28 },
  colInput: { flex: 1 },
  colDone: { width: 48, alignItems: 'center' },
  colRemove: { width: 36, alignItems: 'center' },
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
    minWidth: 0,
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
  iconButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
