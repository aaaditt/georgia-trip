import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Placeholder. Task 6 registers this route and links to it from the
// dashboard's "Explore all of Georgia" card; Task 7 replaces this file with
// the real browse-everything screen. It exists now because expo-router is
// file-based with typedRoutes on — without a file there is no route, and
// both the Stack.Screen registration and the dashboard's router.push fail
// to typecheck.
export default function ExploreScreen() {
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
