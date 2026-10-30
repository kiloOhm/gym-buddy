import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { DeloadPill } from '@/components/DeloadPill';
import { EmptyState } from '@/components/EmptyState';
import { formatSessionDate, formatWeight, sessionDurationMin, sessionVolume } from '@/logic/sessionFormat';
import { useGymStore } from '@/store';
import { colors, font, radius, spacing } from '@/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const sessions = useGymStore((s) => s.sessions);
  const unit = useGymStore((s) => s.settings.weightUnit);

  if (sessions.length === 0) {
    return <EmptyState title="No workouts yet" hint="Finished workouts show up here." />;
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => {
        const duration = sessionDurationMin(item);
        const volume = sessionVolume(item);
        const count = item.exercises.length;
        const meta = [
          duration !== undefined ? `${duration} min` : undefined,
          `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
          volume > 0 ? `${formatWeight(volume)} ${unit}` : undefined,
        ].filter(Boolean);
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={font.small}>
              {formatSessionDate(item.startedAt)}
            </Text>
            <View style={styles.titleRow}>
              <Text style={[font.heading, styles.flex]}>{item.planName}</Text>
              {item.deload ? <DeloadPill /> : null}
            </View>
            <View style={styles.meta}>
              <Text style={font.small}>{meta.join(' · ')}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 44,
  },
  pressed: { opacity: 0.7 },
  meta: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
