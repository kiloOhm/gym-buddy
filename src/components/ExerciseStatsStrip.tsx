import { StyleSheet, Text, View } from 'react-native';

import { formatWeight } from '@/logic/sessionFormat';
import type { ExerciseStats } from '@/logic/stats';
import { colors, radius, spacing } from '@/theme';
import type { WeightUnit } from '@/types';

/** Best / last / 30-day average for the target rep range; "~" marks values estimated from other rep counts. */
export function ExerciseStatsStrip({ stats, unit }: { stats: ExerciseStats; unit: WeightUnit }) {
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

const styles = StyleSheet.create({
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
});
