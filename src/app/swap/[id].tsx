import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ExerciseFigure } from '@/components/ExerciseFigure';
import { RatingDots } from '@/components/RatingDots';
import { suggestAlternatives } from '@/logic/alternatives';
import { swapTargetSnapshot } from '@/logic/swap';
import { useExerciseMap, useGymStore } from '@/store';
import { colors, font, radius, spacing } from '@/theme';
import { EQUIPMENT_LABELS, type Exercise } from '@/types';

export default function SwapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const swapExercise = useGymStore((s) => s.swapExercise);
  const db = useExerciseMap();
  // Render from a snapshot taken on mount, not the live session: swapping changes the session
  // while this screen is being dismissed, and re-rendering a different, re-ordered suggestion
  // list then makes Fabric insert views into a screen that is being torn down (native crash,
  // cf. react-native-screens#2803). Nothing rendered here may change after the swap.
  const [{ sessionExercise, sessionIds }] = useState(() =>
    swapTargetSnapshot(useGymStore.getState().activeSession, id),
  );
  // Ignore further taps once a suggestion was chosen (no double swap, no double back).
  const chosen = useRef(false);
  // The React Compiler memoizes this; no manual useMemo needed.
  const alternatives = sessionExercise
    ? suggestAlternatives(sessionExercise.exerciseId, { excludeIds: sessionIds, limit: 8 }, db)
    : [];

  if (!sessionExercise) {
    return (
      <>
        <Stack.Screen options={{ title: 'Swap exercise' }} />
        <EmptyState title="Exercise not found" hint="It is no longer part of the active workout.">
          <Button variant="secondary" title="Go back" onPress={() => router.back()} />
        </EmptyState>
      </>
    );
  }

  const original = db[sessionExercise.exerciseId] as Exercise | undefined;
  const browse = () =>
    router.push({
      pathname: '/pick-exercise',
      params: { sessionSwap: sessionExercise.id, exclude: sessionIds.join(',') },
    });

  return (
    <>
      <Stack.Screen options={{ title: 'Swap exercise' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={font.title}>Not available? Swap it</Text>
        <View style={styles.card}>
          <Text style={font.small}>Replacing</Text>
          <Text style={font.heading}>{original?.name ?? 'Unknown exercise'}</Text>
          {original ? (
            <Text style={font.small}>{original.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</Text>
          ) : null}
        </View>

        <Text style={font.heading}>Suggestions</Text>
        {alternatives.length === 0 ? (
          <View style={styles.card}>
            <Text style={font.body}>No close substitutes found.</Text>
            <Text style={font.small}>Try browsing the full exercise list instead.</Text>
          </View>
        ) : (
          alternatives.map(({ exercise, score, reasons }) => (
            <Pressable
              key={exercise.id}
              onPress={() => {
                if (chosen.current) return;
                chosen.current = true;
                swapExercise(sessionExercise.id, exercise.id);
                router.back();
              }}
              style={({ pressed }) => [styles.card, styles.altRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Swap to ${exercise.name}`}
            >
              <View style={styles.altHeader}>
                <ExerciseFigure exercise={exercise} variant="thumb" size={44} />
                <Text style={[font.heading, styles.flex]}>{exercise.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{Math.round(score * 100)}%</Text>
                </View>
              </View>
              {reasons.length > 0 ? <Text style={font.small}>{reasons.join(' · ')}</Text> : null}
              <View style={styles.ratings}>
                <RatingDots label="Difficulty" value={exercise.difficulty} />
              </View>
            </Pressable>
          ))
        )}

        <Button variant="secondary" title="Not what you need? Browse all exercises" onPress={browse} />
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
    gap: spacing.xs,
  },
  pressed: { opacity: 0.7 },
  altRow: { gap: spacing.sm },
  altHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  ratings: { alignSelf: 'flex-start', minWidth: '50%' },
});
