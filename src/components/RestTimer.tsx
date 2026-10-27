import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';

import { Button } from '@/components/Button';
import { formatRest, remainingSec, restProgress } from '@/logic/rest';
import { useRestStore } from '@/store/rest';
import { colors, radius, spacing } from '@/theme';

/** How long "Rest over" stays on screen after the countdown hits zero. */
const OVER_MS = 3000;

/** Rest countdown bar for the active workout. Renders nothing when no rest is running. */
export function RestTimer() {
  const endsAt = useRestStore((s) => s.endsAt);
  const totalSec = useRestStore((s) => s.totalSec);
  const extend = useRestStore((s) => s.extend);
  const clear = useRestStore((s) => s.clear);
  const [now, setNow] = useState(() => Date.now());
  // The endsAt we already vibrated for, so each rest buzzes exactly once.
  const vibratedFor = useRef<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt && vibratedFor.current !== endsAt) {
        vibratedFor.current = endsAt;
        // Only buzz when the end was just now, not when coming back long after it.
        if (t < endsAt + OVER_MS) {
          try {
            Vibration.vibrate(400);
          } catch {
            // Not available (e.g. web): ignore.
          }
        }
      }
      if (t >= endsAt + OVER_MS) clear();
    };
    const handle = setInterval(tick, 250);
    return () => clearInterval(handle);
  }, [endsAt, clear]);

  if (endsAt === null) return null;

  // `now` can be stale for up to one tick after a rest (re)starts; clamp so the display never overshoots.
  const left = Math.min(remainingSec(endsAt, now), totalSec);
  const over = now >= endsAt;
  if (over && now >= endsAt + OVER_MS) return null;
  const progress = restProgress(endsAt, totalSec, now);

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Text style={styles.label}>{over ? 'Rest over' : `Rest · ${formatRest(left)}`}</Text>
        {over ? null : (
          <>
            <Button small variant="secondary" title="+30 s" onPress={() => extend(30)} />
            <Button small variant="ghost" title="Skip" onPress={clear} />
          </>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.primary, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
});
