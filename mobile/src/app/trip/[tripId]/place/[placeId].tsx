import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Placeholder. Task 6 registers this route in the trip stack; Task 8
// replaces this file with the real place detail page. See the note in
// explore.tsx for why the file has to exist before the screen does.
export default function PlaceScreen() {
  return (
    <Screen edges={['bottom']} style={styles.container}>
      <ThemedText type="default" themeColor="textSecondary">
        Coming next.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
});
