import { Platform } from 'react-native';

import { alert, dismissButton, setWebAlertHost, webDialogFor, type WebAlert } from './alert';

describe('webDialogFor', () => {
  it('uses a plain alert for no buttons or a single button', () => {
    expect(webDialogFor()).toEqual({ kind: 'alert', button: undefined });
    expect(webDialogFor([])).toEqual({ kind: 'alert', button: undefined });
    const ok = { text: 'OK', onPress: jest.fn() };
    expect(webDialogFor([ok])).toEqual({ kind: 'alert', button: ok });
  });

  it('confirms with the last non-cancel button and cancels with the cancel button', () => {
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    const keep = { text: 'Keep' };
    const del = { text: 'Delete', style: 'destructive' as const };
    expect(webDialogFor([cancel, keep, del])).toEqual({ kind: 'confirm', confirm: del, cancel });
    expect(webDialogFor([del, cancel])).toEqual({ kind: 'confirm', confirm: del, cancel });
    expect(webDialogFor([keep, del])).toEqual({ kind: 'confirm', confirm: del, cancel: undefined });
  });
});

describe('dismissButton', () => {
  it('prefers the cancel button, else the only button, else nothing', () => {
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    const del = { text: 'Delete', style: 'destructive' as const };
    const ok = { text: 'OK' };
    expect(dismissButton([del, cancel])).toBe(cancel);
    expect(dismissButton([ok])).toBe(ok);
    expect(dismissButton([ok, del])).toBeUndefined();
  });
});

describe('alert on web', () => {
  const originalOS = Platform.OS;
  const originalWindow = globalThis.window;
  let browserAlert: jest.Mock;
  let browserConfirm: jest.Mock;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    browserAlert = jest.fn();
    browserConfirm = jest.fn();
    (globalThis as { window: unknown }).window = { alert: browserAlert, confirm: browserConfirm };
  });

  afterEach(() => {
    setWebAlertHost(null);
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    (globalThis as { window: unknown }).window = originalWindow;
  });

  it('shows title and message and then runs the single button', () => {
    const onPress = jest.fn();
    alert('Export failed', 'Disk full', [{ text: 'OK', onPress }]);
    expect(browserAlert).toHaveBeenCalledWith('Export failed\n\nDisk full');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('shows only the title when there is no message', () => {
    alert('Saved');
    expect(browserAlert).toHaveBeenCalledWith('Saved');
  });

  it('runs the confirm action when the user accepts', () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    browserConfirm.mockReturnValue(true);
    alert('Delete plan?', 'Gone for good.', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
    expect(browserConfirm).toHaveBeenCalledWith('Delete plan?\n\nGone for good.');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs the cancel button when the user declines', () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    browserConfirm.mockReturnValue(false);
    alert('Delete plan?', undefined, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('hands the dialog to the in-app host instead of the browser dialogs', () => {
    const shown: WebAlert[] = [];
    setWebAlertHost((d) => shown.push(d));
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
      { text: 'Discard', style: 'destructive' as const },
    ];
    alert('Discard workout?', 'Everything will be lost.', buttons);
    alert('Saved');
    expect(shown).toEqual([
      { title: 'Discard workout?', message: 'Everything will be lost.', buttons },
      { title: 'Saved', message: undefined, buttons: [{ text: 'OK' }] },
    ]);
    expect(browserConfirm).not.toHaveBeenCalled();
    expect(browserAlert).not.toHaveBeenCalled();
  });
});
