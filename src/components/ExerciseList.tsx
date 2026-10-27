import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type Equipment,
  type Exercise,
  type MuscleGroup,
  type Rating,
} from '@/types';

interface Props {
  exercises: Exercise[];
  onPress: (exercise: Exercise) => void;
  /** When given and not the full list, an "Only my equipment" toggle defaults ON. */
  availableEquipment?: Equipment[];
}

export function formatPattern(pattern: string): string {
  const s = pattern.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function equipmentSummary(exercise: Exercise): string {
  return exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ');
}

/** Searchable, filterable list of exercises. */
export function ExerciseList({ exercises, onPress, availableEquipment }: Props) {
  const restricted = !!availableEquipment && availableEquipment.length < EQUIPMENT.length;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [onlyMine, setOnlyMine] = useState(restricted);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mine = availableEquipment ? new Set<Equipment>(availableEquipment) : null;
    return exercises.filter((ex) => {
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      if (muscle && (ex.muscles[muscle] ?? 0) < 0.5) return false;
      if (equipment && !ex.equipment.includes(equipment)) return false;
      if (onlyMine && mine && !ex.equipment.every((e) => e === 'bodyweight' || mine.has(e))) return false;
      return true;
    });
  }, [exercises, query, muscle, equipment, onlyMine, availableEquipment]);

  const header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor={colors.muted}
        style={styles.search}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All muscles" active={muscle === null} onPress={() => setMuscle(null)} />
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} label={MUSCLE_LABELS[m]} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All equipment" active={equipment === null} onPress={() => setEquipment(null)} />
        {EQUIPMENT.map((e) => (
          <Chip
            key={e}
            label={EQUIPMENT_LABELS[e]}
            active={equipment === e}
            onPress={() => setEquipment(equipment === e ? null : e)}
          />
        ))}
      </ScrollView>
      {availableEquipment ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Only my equipment</Text>
          <Switch value={onlyMine} onValueChange={setOnlyMine} />
        </View>
      ) : null}
      <Text style={styles.count}>
        {filtered.length} exercise{filtered.length === 1 ? '' : 's'}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={<Text style={styles.empty}>No exercises match these filters.</Text>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPress(item)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatPattern(item.pattern)} · {equipmentSummary(item)}
            </Text>
          </View>
          <View style={styles.ratings}>
            <MiniRating label="Form" value={item.formDifficulty} kind="skill" />
            <MiniRating label="Risk" value={item.injuryRisk} kind="risk" />
          </View>
        </Pressable>
      )}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/** Compact inline rating: label plus five tiny dots. */
export function MiniRating({ label, value, kind }: { label: string; value: Rating; kind: 'skill' | 'risk' }) {
  const fill =
    kind === 'risk'
      ? value >= 4
        ? colors.danger
        : value === 3
          ? colors.warning
          : colors.success
      : value >= 4
        ? colors.warning
        : colors.primary;
  return (
    <View style={styles.mini} accessibilityLabel={`${label} ${value} of 5`}>
      <Text style={styles.miniLabel}>{label}</Text>
      <View style={styles.miniDots}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.miniDot, { backgroundColor: i <= value ? fill : colors.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 15,
    color: colors.text,
  },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 13, color: colors.text },
  chipLabelActive: { color: '#FFFFFF', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  toggleLabel: { fontSize: 15, color: colors.text },
  count: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  ratings: { gap: 4, alignItems: 'flex-end' },
  separator: { height: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniLabel: { fontSize: 11, color: colors.muted },
  miniDots: { flexDirection: 'row', gap: 2 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
});
