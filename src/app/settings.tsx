import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import { Button } from '@/components/Button';
import { BUILT_IN_EXERCISES } from '@/data/exercises';
import { dedupeSessions, formatHistoryDate, type ParsedHistory, parseHistoryExport } from '@/logic/historyExport';
import { diffLibrary, type ParsedLibrary, parseLibraryExport } from '@/logic/library';
import { dedupePlans, type ParsedImport, parsePlanExport } from '@/logic/planExport';
import {
  exportHistoryToFile,
  exportLibraryToFile,
  exportPlansToFile,
  pickAndReadJsonFile,
  pickAndReadPlanFile,
} from '@/logic/planFiles';
import { useExerciseLibrary, useGymStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { WeightUnit } from '@/types';

const UNITS: WeightUnit[] = ['kg', 'lb'];
const MAX_LISTED_PLANS = 5;
const MAX_LISTED_WARNINGS = 8;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useGymStore((s) => s.settings);
  const updateSettings = useGymStore((s) => s.updateSettings);
  const plans = useGymStore((s) => s.plans);
  const importPlans = useGymStore((s) => s.importPlans);
  const library = useExerciseLibrary();
  const customCount = useGymStore((s) => s.customExercises.length);
  const importExercises = useGymStore((s) => s.importExercises);
  const resetExerciseLibrary = useGymStore((s) => s.resetExerciseLibrary);
  const sessions = useGymStore((s) => s.sessions);
  const importSessions = useGymStore((s) => s.importSessions);
  const hasFinishedSessions = sessions.some((s) => s.finishedAt !== undefined);
  /** Plan ids ticked in the export chooser; undefined while the chooser is closed. */
  const [exportSelection, setExportSelection] = useState<Set<string> | undefined>(undefined);

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
      alert('Export failed', errorMessage(e));
    }
  };

  const startImport = async () => {
    let parsed: ParsedImport;
    try {
      const text = await pickAndReadPlanFile();
      if (text === undefined) return;
      parsed = parsePlanExport(text);
    } catch (e) {
      alert('Import failed', errorMessage(e));
      return;
    }
    const { warnings } = parsed;
    if (parsed.plans.length === 0) {
      alert('Import failed', 'The file does not contain any plans.');
      return;
    }
    const { plans: incoming, skipped } = dedupePlans(parsed.plans, plans);
    if (incoming.length === 0) {
      alert('Nothing to import', skipped.join('\n'));
      return;
    }
    const names = incoming.slice(0, MAX_LISTED_PLANS).map((p) => p.name).join(', ');
    const more = incoming.length > MAX_LISTED_PLANS ? '…' : '';
    const summary = `${incoming.length} plan${incoming.length === 1 ? '' : 's'}: ${names}${more}`;
    const details =
      (warnings.length ? `\n\n${warnings.join('\n')}` : '') +
      (skipped.length ? `\n\nSkipped as duplicates:\n${skipped.join('\n')}` : '');
    alert('Import plans?', summary + details, [
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

  const exportLibrary = async () => {
    try {
      await exportLibraryToFile(library);
    } catch (e) {
      alert('Export failed', errorMessage(e));
    }
  };

  const startLibraryImport = async () => {
    let parsed: ParsedLibrary;
    try {
      const text = await pickAndReadJsonFile();
      if (text === undefined) return;
      parsed = parseLibraryExport(text);
    } catch (e) {
      alert('Import failed', errorMessage(e));
      return;
    }
    const { warnings } = parsed;
    const { added, updated, unchanged } = diffLibrary(parsed.exercises, library);
    const listed = warnings.slice(0, MAX_LISTED_WARNINGS).join('\n');
    const moreWarnings =
      warnings.length > MAX_LISTED_WARNINGS ? `\n…and ${warnings.length - MAX_LISTED_WARNINGS} more` : '';
    const details = warnings.length ? `\n\n${listed}${moreWarnings}` : '';
    if (added.length + updated.length === 0) {
      alert('Nothing to import', `${unchanged.length} unchanged${details}`);
      return;
    }
    const summary = `${added.length} new, ${updated.length} changed, ${unchanged.length} unchanged`;
    alert('Import exercise library?', summary + details, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Import', onPress: () => importExercises(parsed.exercises) },
    ]);
  };

  const exportHistory = async () => {
    try {
      await exportHistoryToFile(sessions, settings.weightUnit);
    } catch (e) {
      alert('Export failed', errorMessage(e));
    }
  };

  const startHistoryImport = async () => {
    let parsed: ParsedHistory;
    try {
      const text = await pickAndReadJsonFile();
      if (text === undefined) return;
      parsed = parseHistoryExport(text, settings.weightUnit);
    } catch (e) {
      alert('Import failed', errorMessage(e));
      return;
    }
    const { warnings } = parsed;
    if (parsed.sessions.length === 0) {
      alert('Import failed', 'The file does not contain any workouts.');
      return;
    }
    const { sessions: incoming, skipped } = dedupeSessions(parsed.sessions, sessions);
    if (incoming.length === 0) {
      alert('Nothing to import', skipped.join('\n'));
      return;
    }
    const byFinish = [...incoming].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    const oldest = formatHistoryDate(byFinish[0].finishedAt);
    const newest = formatHistoryDate(byFinish[byFinish.length - 1].finishedAt);
    const count = `${incoming.length} workout${incoming.length === 1 ? '' : 's'}`;
    const summary = incoming.length === 1 ? `${count}, ${oldest}` : `${count}, ${oldest} – ${newest}`;
    const listed = warnings.slice(0, MAX_LISTED_WARNINGS).join('\n');
    const moreWarnings =
      warnings.length > MAX_LISTED_WARNINGS ? `\n…and ${warnings.length - MAX_LISTED_WARNINGS} more` : '';
    const details =
      (warnings.length ? `\n\n${listed}${moreWarnings}` : '') +
      (skipped.length ? `\n\nSkipped:\n${skipped.join('\n')}` : '');
    alert('Import history?', summary + details, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: () => {
          importSessions(incoming);
          router.navigate('/(tabs)/history');
        },
      },
    ]);
  };

  const confirmResetLibrary = () =>
    alert(
      'Reset exercise library?',
      `Removes ${customCount} custom or edited exercise${customCount === 1 ? '' : 's'} and restores the built-in versions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetExerciseLibrary },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={styles.cardTitle}>Exercise library</Text>
          <Text style={styles.muted}>
            {BUILT_IN_EXERCISES.length} built-in · {customCount} custom or edited
          </Text>
          <Button title="Export library" variant="secondary" onPress={exportLibrary} />
          <Button title="Import library" variant="secondary" onPress={startLibraryImport} />
          {customCount > 0 && (
            <Button title="Reset to built-in library" variant="danger" onPress={confirmResetLibrary} />
          )}
          <Text style={styles.muted}>
            Edit the exported JSON to add exercises or change ratings, then import it back. Existing plans
            and history keep working because exercises are matched by id.
          </Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>History</Text>
          <Button
            title="Export history"
            variant="secondary"
            onPress={exportHistory}
            disabled={!hasFinishedSessions}
          />
          <Button title="Import history" variant="secondary" onPress={startHistoryImport} />
          <Text style={styles.muted}>
            Workout history moves between phones and the browser with this file. Weights are copied as entered.
          </Text>
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
