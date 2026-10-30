import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { alert } from '@/components/alert';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useGymStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { WorkoutPlan } from '@/types';

export default function PlansScreen() {
  const router = useRouter();
  const plans = useGymStore((s) => s.plans);
  const createPlan = useGymStore((s) => s.createPlan);
  const deletePlan = useGymStore((s) => s.deletePlan);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const openPlan = (id: string) => router.push({ pathname: '/plan/[id]', params: { id } });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const plan = createPlan(trimmed);
    setName('');
    setCreating(false);
    openPlan(plan.id);
  };

  const confirmDelete = (plan: WorkoutPlan) =>
    alert('Delete plan?', `"${plan.name}" will be removed. Past workouts stay in History.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlan(plan.id) },
    ]);

  const newPlanForm = creating ? (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>New plan</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Push day"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.formButtons}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => {
            setCreating(false);
            setName('');
          }}
          style={styles.flex}
        />
        <Button title="Create" onPress={submit} disabled={!name.trim()} style={styles.flex} />
      </View>
    </View>
  ) : (
    <Button title="New plan" onPress={() => setCreating(true)} />
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.content, plans.length === 0 && styles.flexGrow]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={styles.header}>{newPlanForm}</View>}
        ListEmptyComponent={
          creating ? undefined : (
            <EmptyState title="No plans yet" hint="Create a plan, add exercises, and start a workout from it." />
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => {
          const totalSets = item.exercises.reduce((n, e) => n + e.sets, 0);
          const count = item.exercises.length;
          // Two sibling pressables rather than nested ones (nesting is invalid on web).
          return (
            <View style={[styles.card, styles.planRow]}>
              <Pressable
                onPress={() => openPlan(item.id)}
                onLongPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.flex, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <Text style={styles.planName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {count} exercise{count === 1 ? '' : 's'} · {totalSets} set{totalSets === 1 ? '' : 's'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
              >
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  content: { padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 15,
    color: colors.text,
  },
  formButtons: { flexDirection: 'row', gap: spacing.sm },
  planRow: { flexDirection: 'row', alignItems: 'center' },
  planName: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
