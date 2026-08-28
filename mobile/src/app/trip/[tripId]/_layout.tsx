import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useTrip } from '@/context/TripContext';

// Wraps the (tabs) group so region/[regionId] (and future detail screens)
// can push over the tab bar instead of living inside it.
export default function TripLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { activeTripId, setActiveTripId, trips, loading } = useTrip();

  useEffect(() => {
    if (tripId && tripId !== activeTripId) setActiveTripId(tripId);
  }, [tripId, activeTripId, setActiveTripId]);

  if (!loading && tripId && !trips.some((t) => t.id === tripId)) {
    return <Redirect href="/(trips)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="region/[regionId]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="explore" options={{ headerShown: true, title: 'Explore Georgia' }} />
      <Stack.Screen name="place/[placeId]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin' }} />
    </Stack>
  );
}
