import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { DeloadPill } from '@/components/DeloadPill';
import { EmptyState } from '@/components/EmptyState';
import { MuscleCoverageBars } from '@/components/MuscleCoverageBars';
import { computeCoverage } from '@/logic/coverage';
import { formatWeight, sessionDurationMin } from '@/logic/sessionFormat';
import { useExerciseMap, useGymStore } from '@/store';
import { colors, font, radius, spacing } from '@/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useGymStore((s) => s.sessions.find((x) => x.id === id));
  const unit = useGymStore((s) => s.settings.weightUnit);
  const deleteSession = useGymStore((s) => s.deleteSession);
  const db = useExerciseMap();

  const coverage = useMemo(
    () =>
      computeCoverage(
        (session?.exercises ?? []).map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.filter((s) => s.completed).length,
        })),
        db,
      ),
    [session, db],
  );

  if (!session) {
    return (
      <>
        <Stack.Screen options={{ title: 'Workout' }} />
        <EmptyState title="Workout not found" hint="It may have been deleted." />
      </>
    );
  }

  const started = new Date(session.startedAt);
  const duration = sessionDurationMin(session);

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

  return (
    <>
      <Stack.Screen options={{ title: session.planName }} />
      <ScrollView contentContainerStyle={styles.content}>
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
          const original = ex.substitutedFor
            ? (db[ex.substitutedFor]?.name ?? 'Unknown exercise')
            : undefined;
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

        <View style={styles.card}>
          <Text style={[font.heading, styles.cardTitle]}>Muscles worked</Text>
          <BodyMap values={coverage} />
          <MuscleCoverageBars coverage={coverage} />
        </View>

        <Button variant="danger" title="Delete session" onPress={confirmDelete} />
      </ScrollView>
    </>
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
});
