import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
  /** Defaults to the title. */
  accessibilityLabel?: string;
}

export function Button({ title, onPress, variant = 'primary', disabled, small, style, accessibilityLabel }: Props) {
  const palette = PALETTE[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[styles.label, small && styles.smallLabel, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

const PALETTE: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  label: { fontSize: 15, fontWeight: '600' },
  smallLabel: { fontSize: 13 },
});
