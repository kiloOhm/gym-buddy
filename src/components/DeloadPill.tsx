import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

/** Small tinted tag marking a deload session in History and the session detail. */
export function DeloadPill() {
  return (
    <View style={styles.pill} accessibilityLabel="Deload workout">
      <Text style={styles.label}>Deload</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.warning },
});
