import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { dedupePlans, type ParsedImport, parsePlanExport } from '@/logic/planExport';
import { exportPlansToFile, pickAndReadPlanFile } from '@/logic/planFiles';
import { useGymStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { EQUIPMENT, EQUIPMENT_LABELS, type Equipment, type WeightUnit } from '@/types';

const UNITS: WeightUnit[] = ['kg', 'lb'];
const MAX_LISTED_PLANS = 5;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const settings = useGymStore((s) => s.settings);
  const updateSettings = useGymStore((s) => s.updateSettings);
  const plans = useGymStore((s) => s.plans);
  const importPlans = useGymStore((s) => s.importPlans);
  const available = new Set<Equipment>(settings.availableEquipment);
  /** Plan ids ticked in the export chooser; undefined while the chooser is closed. */
  const [exportSelection, setExportSelection] = useState<Set<string> | undefined>(undefined);

  const toggle = (item: Equipment, on: boolean) => {
    const next = EQUIPMENT.filter((e) => e === 'bodyweight' || (e === item ? on : available.has(e)));
    updateSettings({ availableEquipment: next });
  };

  const toggleExportChooser = () =>
    setExportSelection((current) => (current ? undefined : new Set(plans.map((p) => p.id))));

  const toggleExportPlan = (id: string) =>
    setExportSelection((current) => {
      if (!current) return current;
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Ignore ids of plans deleted while the chooser was open.
  const selectedPlans = exportSelection ? plans.filter((p) => exportSelection.has(p.id)) : [];

  const exportSelected = async () => {
    try {
      await exportPlansToFile(selectedPlans);
      setExportSelection(undefined);
    } catch (e) {
      Alert.alert('Export failed', errorMessage(e));
    }
  };

  const startImport = async () => {
    let parsed: ParsedImport;
    try {
      const text = await pickAndReadPlanFile();
      if (text === undefined) return;
      parsed = parsePlanExport(text);
    } catch (e) {
      Alert.alert('Import failed', errorMessage(e));
      return;
    }
    const { warnings } = parsed;
    if (parsed.plans.length === 0) {
      Alert.alert('Import failed', 'The file does not contain any plans.');
      return;
    }
    const { plans: incoming, skipped } = dedupePlans(parsed.plans, plans);
    if (incoming.length === 0) {
      Alert.alert('Nothing to import', skipped.join('\n'));
      return;
    }
    const names = incoming.slice(0, MAX_LISTED_PLANS).map((p) => p.name).join(', ');
    const more = incoming.length > MAX_LISTED_PLANS ? '…' : '';
    const summary = `${incoming.length} plan${incoming.length === 1 ? '' : 's'}: ${names}${more}`;
    const details =
      (warnings.length ? `\n\n${warnings.join('\n')}` : '') +
      (skipped.length ? `\n\nSkipped as duplicates:\n${skipped.join('\n')}` : '');
    Alert.alert('Import plans?', summary + details, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: () => {
          importPlans(incoming);
          router.navigate('/(tabs)/plans');
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My equipment</Text>
          <Text style={styles.muted}>Used to filter exercises and suggest substitutes.</Text>
          {EQUIPMENT.map((item) => {
            const isBodyweight = item === 'bodyweight';
            return (
              <View key={item} style={styles.switchRow}>
                <Text style={styles.body}>{EQUIPMENT_LABELS[item]}</Text>
                <Switch
                  value={isBodyweight || available.has(item)}
                  disabled={isBodyweight}
                  onValueChange={(on) => toggle(item, on)}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weight unit</Text>
          <View style={styles.segment}>
            {UNITS.map((unit) => {
              const active = settings.weightUnit === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => updateSettings({ weightUnit: unit })}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{unit}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.muted}>Weights are stored as entered; changing the unit does not convert past logs.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plans</Text>
          <Button
            title="Export plans…"
            variant="secondary"
            onPress={toggleExportChooser}
            disabled={plans.length === 0}
          />
          {exportSelection && (
            <View style={styles.chooser}>
              {plans.map((p) => {
                const checked = exportSelection.has(p.id);
                const count = p.exercises.length;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleExportPlan(p.id)}
                    style={styles.checkRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.primary : colors.muted}
                    />
                    <View style={styles.checkText}>
                      <Text style={styles.body}>{p.name}</Text>
                      <Text style={styles.muted}>
                        {count} exercise{count === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.chooserActions}>
                <Button
                  title="All"
                  variant="ghost"
                  small
                  onPress={() => setExportSelection(new Set(plans.map((p) => p.id)))}
                />
                <Button title="None" variant="ghost" small onPress={() => setExportSelection(new Set())} />
              </View>
              <Button
                title={`Export ${selectedPlans.length} plan${selectedPlans.length === 1 ? '' : 's'}`}
                onPress={exportSelected}
                disabled={selectedPlans.length === 0}
              />
              <Button title="Cancel" variant="ghost" onPress={() => setExportSelection(undefined)} />
            </View>
          )}
          <Button title="Import plans" variant="secondary" onPress={startImport} />
          <Text style={styles.muted}>Exports are JSON files you can share, back up, or send to a friend.</Text>
        </View>

        <Text style={styles.note}>
          Gym Buddy works fully offline. All your plans, workouts and settings stay on this device.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  body: { fontSize: 15, color: colors.text },
  chooser: { gap: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  checkText: { flex: 1 },
  chooserActions: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  segmentActive: { backgroundColor: colors.primary },
  segmentLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  segmentLabelActive: { color: '#FFFFFF' },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.lg },
});
