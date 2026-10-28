// Drop-in replacement for `Alert.alert`, which is a no-op on react-native-web.
// Native: delegates to Alert.alert unchanged. Web: falls back to the browser dialogs, which only
// offer OK (window.alert) or OK/Cancel (window.confirm), so button labels are not shown there:
// OK runs the last non-cancel button (the destructive/confirm action by convention), Cancel runs
// the cancel button.
import { Alert, Platform, type AlertButton } from 'react-native';

export type WebDialog = { kind: 'alert'; button?: AlertButton } | { kind: 'confirm'; confirm?: AlertButton; cancel?: AlertButton };

/** How a set of Alert buttons maps onto the browser's alert/confirm dialogs. Pure, for tests. */
export function webDialogFor(buttons?: readonly AlertButton[]): WebDialog {
  if (!buttons || buttons.length <= 1) return { kind: 'alert', button: buttons?.[0] };
  const confirm = [...buttons].reverse().find((b) => b.style !== 'cancel');
  const cancel = buttons.find((b) => b.style === 'cancel');
  return { kind: 'confirm', confirm, cancel };
}

export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const dialog = webDialogFor(buttons);
  if (dialog.kind === 'alert') {
    window.alert(text);
    dialog.button?.onPress?.();
    return;
  }
  if (window.confirm(text)) dialog.confirm?.onPress?.();
  else dialog.cancel?.onPress?.();
}
