import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { DeloadAdviceCard } from '@/components/DeloadAdviceCard';
import { LOAD_THRESHOLDS, LOAD_WINDOW_DAYS, loadHints, recentMuscleLoad, type LoadHint } from '@/logic/load';
import { formatSessionDate, formatWeight, sessionDurationMin, sessionVolume } from '@/logic/sessionFormat';
import { useExerciseMap, useGymStore } from '@/store';
import { colors, font, radius, spacing } from '@/theme';
import { MUSCLE_LABELS, type WeightUnit, type WorkoutSession } from '@/types';


export default function HomeScreen() {
  const activeSession = useGymStore((s) => s.activeSession);
  const sessions = useGymStore((s) => s.sessions);
  const unit = useGymStore((s) => s.settings.weightUnit);

  const db = useExerciseMap();
  const load = recentMuscleLoad(sessions, undefined, db);
  const hints = loadHints(load, db);
  const last = sessions[0];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {activeSession ? (
        <View style={[styles.card, styles.activeCard]}>
          <Text style={font.heading}>Workout in progress — {activeSession.planName}</Text>
          <Button title="Continue" onPress={() => router.navigate('/(tabs)/workout')} />
        </View>
      ) : null}

      <DeloadAdviceCard />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[font.heading, styles.flex]}>Last workout</Text>
          {last ? (
            <Button title="History" variant="ghost" small onPress={() => router.navigate('/(tabs)/history')} />
          ) : null}
        </View>
        {!last ? (
          <View style={styles.empty}>
            <Text style={font.small}>No workouts yet. Start one from a plan.</Text>
            <Button title="Go to plans" variant="secondary" onPress={() => router.navigate('/(tabs)/plans')} />
          </View>
        ) : (
          <RecentRow session={last} unit={unit} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={font.heading}>Muscle load · last {LOAD_WINDOW_DAYS} days</Text>
        <BodyMap values={load} scale="load" />
        <LoadHints hints={hints} />
        <Text style={styles.caption}>
          Effective sets = sets × how hard the exercise hits the muscle. Guideline: {LOAD_THRESHOLDS.low}–
          {LOAD_THRESHOLDS.high} per muscle per week.
        </Text>
      </View>
    </ScrollView>
  );
}

function RecentRow({ session, unit }: { session: WorkoutSession; unit: WeightUnit }) {
  const duration = sessionDurationMin(session);
  const volume = sessionVolume(session);
  const meta = [
    duration !== undefined ? `${duration} min` : undefined,
    volume > 0 ? `${formatWeight(volume)} ${unit}` : undefined,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={font.small}>{formatSessionDate(session.startedAt)}</Text>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {session.planName}
      </Text>
      {meta.length > 0 ? <Text style={font.small}>{meta.join(' · ')}</Text> : null}
    </Pressable>
  );
}

function LoadHints({ hints }: { hints: LoadHint[] }) {
  const high = hints.filter((h) => h.level === 'high');
  const none = hints.filter((h) => h.level === 'none');
  const low = hints.filter((h) => h.level === 'low');

  if (hints.length === 0) {
    return <Text style={styles.balanced}>Balanced week — nothing to flag.</Text>;
  }

  return (
    <View style={styles.hints}>
      {high.length > 0 ? (
        <HintBox title="Overtraining risk" count={high.length} style={styles.dangerBox} defaultOpen>
          {high.map((h) => (
            <Text key={h.muscle} style={font.body}>
              {MUSCLE_LABELS[h.muscle]} · {formatSets(h.effectiveSets)} effective sets this week (over{' '}
              {LOAD_THRESHOLDS.high})
            </Text>
          ))}
          <Text style={font.small}>Give these a lighter session or an extra rest day.</Text>
        </HintBox>
      ) : null}
      {none.length > 0 ? (
        <HintBox title="Not trained this week" count={none.length} style={styles.warningBox}>
          {none.map((h) => (
            <View key={h.muscle} style={styles.hintItem}>
              <Text style={font.body}>{MUSCLE_LABELS[h.muscle]}</Text>
              <Suggestions hint={h} />
            </View>
          ))}
        </HintBox>
      ) : null}
      {low.length > 0 ? (
        <HintBox title="Under-trained" count={low.length} style={styles.primaryBox}>
          {low.map((h) => (
            <View key={h.muscle} style={styles.hintItem}>
              <Text style={font.body}>
                {MUSCLE_LABELS[h.muscle]} · {formatSets(h.effectiveSets)} effective sets
              </Text>
              <Suggestions hint={h} />
            </View>
          ))}
        </HintBox>
      ) : null}
    </View>
  );
}

interface HintBoxProps {
  title: string;
  /** Number of muscle groups inside, shown in the header while collapsed. */
  count: number;
  style: ViewStyle;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A tinted box whose header toggles its content. */
function HintBox({ title, count, style, defaultOpen = false, children }: HintBoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.hintBox, style]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.hintHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${count} muscle groups`}
      >
        <Text style={styles.hintTitle}>
          {title} ({count})
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
      </Pressable>
      {open ? <View style={styles.hintBody}>{children}</View> : null}
    </View>
  );
}

function Suggestions({ hint }: { hint: LoadHint }) {
  if (hint.suggestions.length === 0) return null;
  return (
    <Text style={font.small}>
      Try:{' '}
      {hint.suggestions.map((ex, i) => (
        <Fragment key={ex.id}>
          {i > 0 ? ', ' : ''}
          <Text
            style={styles.link}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
            accessibilityRole="link"
          >
            {ex.name}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
}

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  activeCard: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  empty: { gap: spacing.md },
  row: { gap: 2, minHeight: 44, justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.6 },
  hints: { gap: spacing.sm },
  hintBox: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  hintTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  hintHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  hintBody: { gap: spacing.sm },
  hintItem: { gap: 2 },
  dangerBox: { backgroundColor: colors.dangerSoft },
  warningBox: { backgroundColor: colors.warningSoft },
  primaryBox: { backgroundColor: colors.primarySoft },
  link: { color: colors.primary, fontWeight: '600' },
  balanced: { fontSize: 15, fontWeight: '600', color: colors.success },
  caption: { fontSize: 12, color: colors.muted },
});
