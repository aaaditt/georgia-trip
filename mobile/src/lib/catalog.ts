import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type CatalogRegion = {
  id: string;
  name: string;
  icon: string;
  subtitle: string | null;
  sortOrder: number;
};

/**
 * The global Georgia catalog's region list. Readable by any signed-in user
 * with no trip — which is what lets the create wizard show the region grid
 * before the trip it belongs to exists. Static content, so this fetches once
 * with no realtime subscription.
 */
export function useCatalogRegions() {
  const [catalogRegions, setCatalogRegions] = useState<CatalogRegion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('catalog_regions')
      .select('id, name, icon, subtitle, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setCatalogRegions(
            data.map((r: any) => ({
              id: r.id,
              name: r.name,
              icon: r.icon || '📍',
              subtitle: r.subtitle ?? null,
              sortOrder: r.sort_order ?? 0,
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogRegions, loading };
}

// create_georgia_trip (migration-09) — SECURITY DEFINER RPC, not a direct
// insert; see migration-08's header for why. Creating and seeding in one
// call keeps it atomic and avoids ~113 client round-trips.
export async function createGeorgiaTrip({
  name,
  startDate,
  endDate,
  regionIds,
}: {
  name: string;
  startDate: string | null;
  endDate: string | null;
  regionIds: string[];
}) {
  const { data, error } = await supabase.rpc('create_georgia_trip', {
    p_name: name.trim(),
    p_start_date: startDate,
    p_end_date: endDate,
    p_region_ids: regionIds.length > 0 ? regionIds : null,
  });
  return { tripId: (data as string | null) ?? null, error };
}

// seed_trip_catalog (migration-09) — the manual "Add Georgia's places"
// import for trips that predate the catalog. Idempotent server-side.
export async function seedTripCatalog(tripId: string, regionIds: string[]) {
  const { data, error } = await supabase.rpc('seed_trip_catalog', {
    p_trip_id: tripId,
    p_region_ids: regionIds.length > 0 ? regionIds : null,
  });
  return { placesAdded: (data as number | null) ?? 0, error };
}

// set_trip_region_selected (migration-09) — any member may change the
// shortlist; it's a shared group decision, matching migration-06's
// "members update regions" policy.
export async function setRegionSelected(regionId: string, selected: boolean) {
  const { error } = await supabase.rpc('set_trip_region_selected', {
    p_region_id: regionId,
    p_selected: selected,
  });
  return { error };
}
