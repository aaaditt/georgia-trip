import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

// Trip scoping + membership guard live in the parent Stack layout
// (trip/[tripId]/_layout.tsx) — this only renders the tab bar.
export default function TripTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Trip' }} />
      <Tabs.Screen name="consensus" options={{ title: 'Consensus' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
    </Tabs>
  );
}
