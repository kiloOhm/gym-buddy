import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  // The navigator may hand us a processed (numeric) or null colour; icons want a string.
  return function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />;
  };
}

export default function TabsLayout() {
  // The tab bar already grows by the bottom inset; add a little breathing room on top of it so the
  // labels don't sit flush against the Android navigation bar (3-button mode) or the gesture pill.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      safeAreaInsets={{ bottom: insets.bottom + spacing.md }}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: tabIcon('list') }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout', tabBarIcon: tabIcon('barbell') }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: tabIcon('body') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('calendar') }} />
    </Tabs>
  );
}
