import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { describeReason } from '@/logic/deload';
import { formatSessionDate } from '@/logic/sessionFormat';
import { useExerciseMap, useGymStore } from '@/store';
import { useRestStore } from '@/store/rest';
import { colors, font, radius, spacing } from '@/theme';

/** Home card shown while the history shows signs that a deload week is due and the advice isn't snoozed. */
export function DeloadAdviceCard() {
  const router = useRouter();
  const advice = useGymStore((s) => s.deloadAdvice);
  const plans = useGymStore((s) => s.plans);
  const hasActive = useGymStore((s) => s.activeSession !== null);
  const unit = useGymStore((s) => s.settings.weightUnit);
  const startDeloadSession = useGymStore((s) => s.startDeloadSession);
  const snoozeDeloadAdvice = useGymStore((s) => s.snoozeDeloadAdvice);
  const db = useExerciseMap();
  // Mount time is enough: a snooze always ends after it, and refreshDeloadAdvice (also run on app foreground)
  // drops an expired snoozedUntil, which re-renders the card.
  const [now] = useState(() => Date.now());

  if (!advice) return null;
  if (advice.snoozedUntil && Date.parse(advice.snoozedUntil) > now) return null;

  const start = (planId: string) => {
    useRestStore.getState().clear();
    startDeloadSession(planId);
    router.navigate('/(tabs)/workout');
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Deload advice">
      <View style={styles.header}>
        <Text style={font.heading}>Time for a deload?</Text>
        <Text style={font.small}>Signs of fatigue since {formatSessionDate(advice.since)}</Text>
      </View>
      <View style={styles.reasons}>
        {advice.reasons.map((reason, i) => (
          <View key={i} style={styles.reasonRow}>
            <Text style={font.body}>•</Text>
            <Text style={[font.body, styles.flex]}>{describeReason(reason, db, unit)}</Text>
          </View>
        ))}
      </View>
      <Text style={font.small}>
        A deload keeps your workouts but halves the sets. Aim for about 90 % of your usual weights.
      </Text>
      {hasActive ? (
        <Text style={font.small}>Finish the current workout first.</Text>
      ) : plans.length > 0 ? (
        <View style={styles.startBlock}>
          <Text style={styles.label}>Start a deload workout:</Text>
          <View style={styles.plans}>
            {plans.map((plan) => (
              <Button key={plan.id} small variant="secondary" title={plan.name} onPress={() => start(plan.id)} />
            ))}
          </View>
        </View>
      ) : null}
      <Button
        small
        variant="ghost"
        title="Not now"
        onPress={() => snoozeDeloadAdvice()}
        accessibilityLabel="Not now, remind me in a week"
        style={styles.notNow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { gap: 2 },
  reasons: { gap: spacing.xs },
  reasonRow: { flexDirection: 'row', gap: spacing.sm },
  startBlock: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notNow: { alignSelf: 'flex-start' },
});
