import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

/**
 * Gear icon that opens Settings; shown in every tab header (see `(tabs)/_layout.tsx`).
 * Pass it to navigator options as `() => <SettingsButton />`, never as `SettingsButton` (see CLAUDE.md).
 */
export function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={8}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Ionicons name="settings-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
});
