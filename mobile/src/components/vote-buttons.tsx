import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Vote = 'go' | 'maybe' | 'skip';

const OPTIONS: { value: Vote; label: string; color: string; bg: string; border: string }[] = [
  { value: 'go', label: '✅ Go', color: Palette.go, bg: Palette.goBg, border: Palette.goBorder },
  { value: 'maybe', label: '🤔 Maybe', color: Palette.maybe, bg: Palette.maybeBg, border: Palette.maybeBorder },
  { value: 'skip', label: '❌ Skip', color: Palette.skip, bg: Palette.skipBg, border: Palette.skipBorder },
];

export function VoteButtons({
  value,
  onChange,
  counts,
}: {
  value?: Vote;
  onChange: (vote: Vote) => void;
  counts: { go: number; maybe: number; skip: number };
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.button,
              { borderColor: active ? opt.border : theme.border, backgroundColor: active ? opt.bg : 'transparent' },
            ]}>
            <ThemedText type="small" style={{ color: active ? opt.color : theme.textSecondary }}>
              {opt.label} {counts[opt.value] > 0 ? counts[opt.value] : ''}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs + 2,
    alignItems: 'center',
  },
});
