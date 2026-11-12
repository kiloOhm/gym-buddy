// Drop-in replacement for `Alert.alert`, which is a no-op on react-native-web.
// Native: delegates to Alert.alert unchanged. Web: hands the dialog to the in-app <WebAlertHost>
// (mounted by the root layout), which shows the real title, message and button labels. The browser's
// own window.alert/confirm are only a fallback for when no host is mounted (before hydration): some
// browsers and embedded webviews suppress them (confirm returns false at once, nothing is shown),
// which made every confirmation silently act as Cancel. In the fallback OK runs the last non-cancel
// button (the destructive/confirm action by convention), Cancel runs the cancel button.
import { Alert, Platform, type AlertButton } from 'react-native';

export type WebDialog = { kind: 'alert'; button?: AlertButton } | { kind: 'confirm'; confirm?: AlertButton; cancel?: AlertButton };

/** A dialog for the in-app web host. `buttons` is never empty (a bare alert gets a single OK). */
export interface WebAlert {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let webHost: ((dialog: WebAlert) => void) | null = null;

/** Registers the component that renders web dialogs; pass null to unregister. */
export function setWebAlertHost(host: ((dialog: WebAlert) => void) | null): void {
  webHost = host;
}

/** How a set of Alert buttons maps onto the browser's alert/confirm dialogs. Pure, for tests. */
export function webDialogFor(buttons?: readonly AlertButton[]): WebDialog {
  if (!buttons || buttons.length <= 1) return { kind: 'alert', button: buttons?.[0] };
  const confirm = [...buttons].reverse().find((b) => b.style !== 'cancel');
  const cancel = buttons.find((b) => b.style === 'cancel');
  return { kind: 'confirm', confirm, cancel };
}

/** What dismissing a web dialog (Escape, backdrop) runs: the cancel button, or the only button. */
export function dismissButton(buttons: readonly AlertButton[]): AlertButton | undefined {
  return buttons.find((b) => b.style === 'cancel') ?? (buttons.length === 1 ? buttons[0] : undefined);
}

export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  if (webHost) {
    webHost({ title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
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
