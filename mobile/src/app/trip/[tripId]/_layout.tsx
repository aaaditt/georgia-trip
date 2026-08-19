import { Redirect, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';

// Every screen under this tab group reads the active trip from
// TripContext (set on entry here) rather than re-parsing the tripId param
// itself — keeps trip-scoped data hooks (Phase 2+) simple to write.
export default function TripTabsLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const theme = useTheme();
  const { activeTripId, setActiveTripId, trips, loading } = useTrip();

  useEffect(() => {
    if (tripId && tripId !== activeTripId) setActiveTripId(tripId);
  }, [tripId, activeTripId, setActiveTripId]);

  if (!loading && tripId && !trips.some((t) => t.id === tripId)) {
    // Not a member of this trip (bad link, removed, etc.) — bounce to the picker.
    return <Redirect href="/(trips)" />;
  }

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
