import { useEffect, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { formatElapsed } from '@/logic/sessionFormat';
import { colors } from '@/theme';

interface Props {
  /** ISO timestamp to count up from. */
  since: string;
  style?: TextStyle;
}

/** Self-contained ticking clock so the once-a-second rerender stays local. */
export function ElapsedTimer({ since, style }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  return <Text style={[styles.text, style]}>{formatElapsed(now - Date.parse(since))}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: colors.muted, fontVariant: ['tabular-nums'] },
});
