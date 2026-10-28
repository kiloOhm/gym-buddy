import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGymStore } from '@/store';
import { colors } from '@/theme';

/** On web the app is a phone-width column centred on wide screens. */
const WEB_MAX_WIDTH = 640;

export default function RootLayout() {
  const hydrated = useGymStore((s) => s.hydrated);
  // Android draws edge-to-edge, so stack screens would otherwise scroll under the system
  // navigation bar. The tab bar handles its own inset, hence the override for "(tabs)".
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  const navigator = (
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
  );

  if (Platform.OS !== 'web') {
    return (
      <>
        <StatusBar style="dark" />
        {navigator}
      </>
    );
  }

  // The nested SafeAreaProvider makes the navigators measure the column instead of the window, so
  // the tab bar keeps its phone layout. A hairline frames the column once there is room around it.
  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <SafeAreaProvider style={[styles.column, width > WEB_MAX_WIDTH && styles.framed]}>{navigator}</SafeAreaProvider>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: colors.background },
  column: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH },
  framed: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
});
