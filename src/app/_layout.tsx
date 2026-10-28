import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGymStore } from '@/store';
import { colors } from '@/theme';

export default function RootLayout() {
  const hydrated = useGymStore((s) => s.hydrated);
  // Android draws edge-to-edge, so stack screens would otherwise scroll under the system
  // navigation bar. The tab bar handles its own inset, hence the override for "(tabs)".
  const insets = useSafeAreaInsets();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.card },
          contentStyle: { backgroundColor: colors.background, paddingBottom: insets.bottom },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, contentStyle: { backgroundColor: colors.background, paddingBottom: 0 } }}
        />
      </Stack>
    </>
  );
}
