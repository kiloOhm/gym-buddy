import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { dismissButton, setWebAlertHost, type WebAlert } from './alert';

/**
 * Renders `alert()` dialogs on web as an in-app modal (see alert.ts). Mounted once by the root layout,
 * web only. Dialogs raised while one is open queue up behind it.
 */
export function WebAlertHost() {
  const [queue, setQueue] = useState<WebAlert[]>([]);

  useEffect(() => {
    setWebAlertHost((dialog) => setQueue((q) => [...q, dialog]));
    return () => setWebAlertHost(null);
  }, []);

  const current = queue[0];
  const close = (button: AlertButton | undefined) => {
    setQueue((q) => q.slice(1));
    button?.onPress?.();
  };

  return (
    <Modal visible={current !== undefined} transparent animationType="fade" onRequestClose={() => current && close(dismissButton(current.buttons))}>
      <View style={styles.backdrop}>
        {current ? (
          <View style={styles.dialog} accessibilityRole="alert">
            <Text style={styles.title}>{current.title}</Text>
            {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
            <View style={styles.buttons}>
              {current.buttons.map((b, i) => (
                <Pressable
                  key={`${i}-${b.text}`}
                  onPress={() => close(b)}
                  style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      b.style === 'cancel' && styles.cancelLabel,
                      b.style === 'destructive' && styles.destructiveLabel,
                    ]}
                  >
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 15, lineHeight: 21, color: colors.text },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  button: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md },
  buttonLabel: { fontSize: 15, fontWeight: '600', color: colors.primary },
  cancelLabel: { color: colors.muted },
  destructiveLabel: { color: colors.danger },
});
