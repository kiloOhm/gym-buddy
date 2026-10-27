import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { formatSessionDate, formatWeight, sessionDurationMin, sessionVolume } from '@/logic/sessionFormat';
import { useGymStore } from '@/store';
import { colors, font, radius, spacing } from '@/theme';

export default function HistoryScreen() {
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
            <Text style={font.heading}>{item.planName}</Text>
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
});
