import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

/**
 * The one place in the app that knows about device insets. Every route group
 * sets `headerShown: false`, so without this a screen's first element sits
 * under the status bar / notch.
 *
 * edges guidance:
 *   ['top','bottom'] — auth + trips screens (no header, no tab bar)
 *   ['top']          — the five tab screens; the tab bar owns the bottom inset
 *   ['bottom']       — region/[regionId] and admin, which have native headers
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  style,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
