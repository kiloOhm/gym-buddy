import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';
import type { Rating } from '@/types';

interface Props {
  label: string;
  value: Rating;
}

/** Colour for a difficulty rating: 1-2 green, 3 amber, 4-5 red. */
export function difficultyColor(value: Rating): string {
  return value >= 4 ? colors.danger : value === 3 ? colors.warning : colors.success;
}

/** Five dots, filled up to `value` and coloured by it. Used for the difficulty rating. */
export function RatingDots({ label, value }: Props) {
  const fill = difficultyColor(value);
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontSize: 13, color: colors.muted },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
