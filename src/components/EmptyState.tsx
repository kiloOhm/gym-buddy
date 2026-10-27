import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

interface Props {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, hint, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center' },
});
