import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AddPlaceForm({
  onAdd,
}: {
  onAdd: (place: { name: string; description: string; time: string; priceLari: string }) => Promise<void>;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [priceLari, setPriceLari] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setTime('');
    setPriceLari('');
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await onAdd({ name, description, time, priceLari });
    setSubmitting(false);
    reset();
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <Pressable onPress={() => setExpanded(true)} style={[styles.addButton, { borderColor: theme.accent }]}>
        <ThemedText type="default" themeColor="accent">
          + Add a place
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.form, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Place name"
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description (optional)"
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
      <View style={styles.row}>
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="Time needed"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, styles.half, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
        <TextInput
          value={priceLari}
          onChangeText={setPriceLari}
          placeholder="Price"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, styles.half, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => setExpanded(false)}>
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={submitting || !name.trim()}
          style={[styles.saveButton, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
          <ThemedText type="small" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
            Save
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  form: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md },
  saveButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
});
