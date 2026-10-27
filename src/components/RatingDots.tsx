import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';
import type { Rating } from '@/types';

interface Props {
  label: string;
  value: Rating;
  /** 'risk' colours high values red; 'skill' colours them amber. */
  kind?: 'risk' | 'skill';
}

/** Five dots, filled up to `value`. Used for form difficulty and injury risk. */
export function RatingDots({ label, value, kind = 'skill' }: Props) {
  const fill = kind === 'risk' ? riskColor(value) : skillColor(value);
  return (
    <View style={styles.row} accessibilityLabel={`${label} ${value} of 5`}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= value ? fill : colors.border }]} />
        ))}
      </View>
    </View>
  );
}

function riskColor(v: Rating): string {
  return v >= 4 ? colors.danger : v === 3 ? colors.warning : colors.success;
}
function skillColor(v: Rating): string {
  return v >= 4 ? colors.warning : colors.primary;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontSize: 13, color: colors.muted },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
