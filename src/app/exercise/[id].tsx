import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ExerciseFigure, hasExercisePhotos } from '@/components/ExerciseFigure';
import { equipmentSummary, formatPattern } from '@/components/ExerciseList';
import { MuscleCoverageBars } from '@/components/MuscleCoverageBars';
import { RatingDots } from '@/components/RatingDots';
import { suggestAlternatives } from '@/logic/alternatives';
import { computeCoverage } from '@/logic/coverage';
import { lastPerformance } from '@/logic/history';
import { useExerciseMap, useGymStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { Exercise } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useExerciseMap();
  const exercise = db[id] as Exercise | undefined;
  const sessions = useGymStore((s) => s.sessions);
  const settings = useGymStore((s) => s.settings);

  const coverage = useMemo(() => computeCoverage([{ exerciseId: id, sets: 1 }], db), [id, db]);
  const alternatives = useMemo(
    () => suggestAlternatives(id, { limit: 5 }, db),
    [id, db],
  );
  const last = useMemo(() => lastPerformance(sessions, id), [sessions, id]);

  if (!exercise) {
    return (
      <>
        <Stack.Screen options={{ title: 'Exercise' }} />
        <EmptyState title="Exercise not found">
          <Button title="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </EmptyState>
      </>
    );
  }

  let lastLine: string | null = null;
  if (last && last.sets.length > 0) {
    const top = last.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
    const weight = top.weight > 0 ? ` @ ${top.weight} ${settings.weightUnit}` : '';
    lastLine = `Last: ${last.sets.length} × ${top.reps}${weight} on ${shortDate(last.date)}`;
  }

  return (
    <>
      <Stack.Screen options={{ title: exercise.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.meta}>
            {formatPattern(exercise.pattern)} · {exercise.compound ? 'Compound' : 'Isolation'}
          </Text>
          <Text style={styles.meta}>Equipment: {equipmentSummary(exercise)}</Text>
          {lastLine ? <Text style={styles.last}>{lastLine}</Text> : null}
          <View style={styles.ratings}>
            <RatingDots label="Difficulty" value={exercise.difficulty} />
            <Text style={styles.caption}>
              Difficulty is an editorial 1–5 rating of technique demand and how unforgiving the lift is,
              not a measured injury risk. Muscle weights are editorial involvement estimates (1 = primary
              target).
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <ExerciseFigure exercise={exercise} variant="hero" />
          {hasExercisePhotos(exercise.id) ? (
            <Text style={styles.credit} numberOfLines={1}>
              Photos: free-exercise-db (public domain)
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Muscles worked</Text>
          <BodyMap values={exercise.muscles} scale="relative" />
          <MuscleCoverageBars coverage={coverage} />
        </View>

        {exercise.cues.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cues</Text>
            {exercise.cues.map((cue, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>{'•'}</Text>
                <Text style={styles.body}>{cue}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Substitutes</Text>
          {alternatives.length === 0 ? (
            <Text style={styles.meta}>No close substitutes found.</Text>
          ) : (
            alternatives.map((alt) => (
              <Pressable
                key={alt.exercise.id}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: alt.exercise.id } })}
                style={({ pressed }) => [styles.altRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <View style={styles.flex}>
                  <Text style={styles.altName}>{alt.exercise.name}</Text>
                  {alt.reasons.length > 0 ? <Text style={styles.meta}>{alt.reasons.join(' · ')}</Text> : null}
                </View>
                <Text style={styles.score}>{Math.round(alt.score * 100)}%</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </>
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
    gap: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  meta: { fontSize: 13, color: colors.muted },
  credit: { fontSize: 11, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 16, color: colors.muted },
  last: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  ratings: { gap: spacing.sm, marginTop: spacing.sm },
  body: { flex: 1, fontSize: 15, color: colors.text },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bullet: { fontSize: 15, color: colors.muted },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  altName: { fontSize: 15, fontWeight: '600', color: colors.text },
  score: { fontSize: 15, fontWeight: '600', color: colors.primary, fontVariant: ['tabular-nums'] },
});
