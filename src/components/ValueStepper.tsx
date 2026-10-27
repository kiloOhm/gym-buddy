import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}

/** Small "− value +" control with a label above. */
export function ValueStepper({ label, value, onChange, min = 0, max = Infinity, step = 1, format }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <StepButton symbol="−" onPress={dec} disabled={value <= min} label={`Decrease ${label}`} />
        <Text style={styles.value}>{format ? format(value) : value}</Text>
        <StepButton symbol="+" onPress={inc} disabled={value >= max} label={`Increase ${label}`} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  onPress,
  disabled,
  label,
}: {
  symbol: string;
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.35 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.symbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: spacing.xs },
  label: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  button: {
    width: 32,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontSize: 18, fontWeight: '600', color: colors.primary },
  value: { minWidth: 36, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
