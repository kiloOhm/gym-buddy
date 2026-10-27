import { StyleSheet, Text, View } from 'react-native';

import { coverageLevel, type Coverage } from '@/logic/coverage';
import { colors, radius, spacing } from '@/theme';
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '@/types';

interface Props {
  coverage: Coverage;
  /** Show muscles with zero effective sets too (greyed). Default false. */
  showEmpty?: boolean;
}

/** One horizontal bar per muscle group, strongest first. */
export function MuscleCoverageBars({ coverage, showEmpty = false }: Props) {
  const rows = MUSCLE_GROUPS.map((m) => ({ muscle: m, value: coverage[m] ?? 0 }))
    .filter((r) => showEmpty || r.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return <Text style={styles.empty}>No muscles targeted yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {rows.map(({ muscle, value }) => {
        const level = coverageLevel(value);
        return (
          <View key={muscle} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {MUSCLE_LABELS[muscle]}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round((value / max) * 100)}%`, backgroundColor: colors.coverage[level] },
                ]}
              />
            </View>
            <Text style={styles.value}>{value.toFixed(1)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 92, fontSize: 13, color: colors.text },
  track: { flex: 1, height: 10, borderRadius: radius.sm, backgroundColor: colors.coverage.none, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
  value: { width: 32, textAlign: 'right', fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  empty: { color: colors.muted, fontSize: 14 },
});
