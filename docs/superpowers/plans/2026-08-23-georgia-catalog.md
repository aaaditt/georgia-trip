# Georgia Catalog & Region Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the generic "any destination" mobile trip planner into a Georgia-specific one: every new trip is auto-seeded with a curated 10-region / ~113-place Georgia catalog, groups opt into the regions they actually care about, trip creation is a name + date-range wizard with no destination field, and every screen respects the device notch.

**Architecture:** Two new global `catalog_regions` / `catalog_places` tables hold the curated content. A single `SECURITY DEFINER` RPC copies all of it into a trip's own `regions` / `experiences` rows at creation, minting per-trip ids and keeping a `catalog_*_id` backlink, so every existing foreign key, RLS policy, hook and screen keeps working untouched. A `regions.is_selected` flag marks the trip's shortlist, which gates emphasis and prompting but never access.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, TypeScript 6, Supabase Postgres, react-native-safe-area-context 5.7, jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-23-georgia-catalog-design.md`

## Global Constraints

- **Every database write must go through a `SECURITY DEFINER` RPC.** Direct `supabase.from(t).insert/update/upsert/delete` silently fails with an RLS error — a confirmed Supabase platform bug. See the header of `supabase/migration-08-rls-workaround-rpcs.sql`. Read-only `.select()` is unaffected and stays direct.
- Every new RPC follows the migration-08 pattern exactly: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`, owned by `postgres`, re-implementing its RLS policy's own authorization check (`private.is_trip_member` / `is_trip_admin` / `my_member_ids`) in the function body, then `REVOKE EXECUTE … FROM PUBLIC, anon;` and `GRANT EXECUTE … TO authenticated;`.
- Every migration file is idempotent and safe to re-run: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `ON CONFLICT DO NOTHING`.
- **Migrations cannot be executed from this environment.** No Supabase CLI, no service-role key. Migration files are deliverables handed to the user to paste into the Supabase SQL Editor, exactly like migrations 01–08.
- `regions.id` and `experiences.id` are **globally unique** `TEXT PRIMARY KEY` columns — not composite with `trip_id`. Any row seeded into a trip must mint a per-trip-unique id. The convention is `<catalog_slug>-<trip_uuid>`.
- Expo SDK version is pinned at 57. Per `mobile/AGENTS.md`, verify APIs against `https://docs.expo.dev/versions/v57.0.0/` rather than from memory.
- On Windows, `npx expo install` needs the escaped separator to pass flags through to the package manager: `npx expo install <pkgs> "--" --save-dev`. Use `--save-dev`, **not** `--dev` — npm 11 accepts `--dev` without error but does not treat it as `--save-dev`, so the packages land in `dependencies`. Always verify placement in `package.json` afterwards rather than trusting the command's exit code.
- All dates are handled in **UTC** (`new Date(iso + 'T00:00:00Z')`), matching the existing `tripDays()` in `mobile/src/lib/itinerary.ts`. Never construct a bare `new Date(iso)`.
- Day counts are **inclusive** of both endpoints: 2027-08-03 → 2027-08-14 is 12 days.
- Region and place ids in the catalog are stable lowercase kebab-case slugs. Once a slug ships it must never be renamed — trips reference it via `catalog_region_id` / `catalog_place_id`.
- Commit after every task. Push to `origin main` (the user's standing instruction; a push is a Vercel deploy for the web app, which this work does not touch).

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `mobile/src/lib/date-range.ts` | Pure UTC date maths: iso conversion, inclusive day count, month grid generation. No React. |
| `mobile/src/lib/__tests__/date-range.test.ts` | Tests for the above. |
| `mobile/src/lib/__tests__/access.test.ts` | Tests for the re-scoped voting gate. |
| `mobile/src/lib/__tests__/itinerary.test.ts` | Tests for structured-duration preference. |
| `mobile/src/lib/catalog.ts` | Catalog reads + the three new RPC wrappers. |
| `mobile/src/components/screen.tsx` | Safe-area screen wrapper. One place that knows about insets. |
| `mobile/src/components/date-range-calendar.tsx` | Month-grid range picker. Presentational; all maths delegated to `date-range.ts`. |
| `mobile/src/components/region-picker-grid.tsx` | Multi-select region grid, shared by the create wizard and the dashboard. |
| `mobile/src/components/place-detail-sheet.tsx` | The rich per-place info block, rendered by the place page. |
| `mobile/src/app/trip/[tripId]/explore.tsx` | Browse the full catalog; add regions to the trip. |
| `mobile/src/app/trip/[tripId]/place/[placeId].tsx` | Full place info page. |
| `supabase/migration-09-georgia-catalog.sql` | Schema, indexes, RLS, RPCs, the 10 catalog region rows. |
| `supabase/migration-10-catalog-<region>.sql` × 10 | Place rows + guide scripts, one file per region. |
| `content/catalog/<region>.json` | Machine-readable source of truth for the seed SQL, checked in so content is diffable. |
| `scripts/build-catalog-sql.mjs` | Generates the migration-10 files from the JSON. Deterministic. |

**Modified files**

| Path | Change |
|---|---|
| `mobile/package.json` | jest-expo devDeps, jest config, test scripts. |
| `mobile/src/app/_layout.tsx` | `SafeAreaProvider` + `StatusBar`. |
| `mobile/src/constants/theme.ts` | Remove the dead `BottomTabInset` stub. |
| `mobile/src/lib/hooks.ts` | Extended `Region`/`Experience` types + mappers; selected/unselected splits. |
| `mobile/src/lib/access.ts` | `hasCompletedVoting` scoped to selected regions. |
| `mobile/src/lib/itinerary.ts` | `parseDefaultDuration` prefers structured `duration_min`. |
| `mobile/src/app/(trips)/create.tsx` | 3-step wizard; destination deleted. |
| `mobile/src/app/(trips)/index.tsx`, `join.tsx`, `account.tsx` | Safe-area wrapper. |
| `mobile/src/app/(auth)/login.tsx`, `sign-up.tsx` | Safe-area wrapper. |
| `mobile/src/app/trip/[tripId]/(tabs)/dashboard.tsx` | Our-regions / Explore split, scoped progress, import CTA, safe area. |
| `mobile/src/app/trip/[tripId]/(tabs)/consensus.tsx`, `calendar.tsx`, `plan.tsx`, `notes.tsx` | Safe area; scope to selected regions where they aggregate. |
| `mobile/src/app/trip/[tripId]/_layout.tsx` | Register the two new routes. |
| `mobile/src/app/trip/[tripId]/region/[regionId].tsx` | Region header fields, add-to-trip toggle, tap-through to place pages. |
| `mobile/src/components/experience-card.tsx` | Becomes a summary card that navigates to the place page. |

## Execution order

Tasks 1–3 are independent of each other and of the content. Task 9 (research) is the long pole and has no code dependency beyond the JSON schema fixed in Task 3 — start it as early as convenient and let it run while Tasks 4–8 are built.

---

### Task 1: Test harness and safe-area system

Fixes brief item 6. `react-native-safe-area-context@5.7.0` is installed but used nowhere in `mobile/src`, and `SafeAreaProvider` is absent from the root layout — so `useSafeAreaInsets()` would return zeros even if something called it. Every route group sets `headerShown: false`, so all 11 headerless screens currently collide with the notch. Ten of them are fixed here; `(trips)/create.tsx` is the eleventh and is rewritten wholesale in Task 5, which applies the wrapper itself.

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/src/lib/date-range.ts` (stub for the first test only; filled in Task 2)
- Create: `mobile/src/components/screen.tsx`
- Modify: `mobile/src/app/_layout.tsx`
- Modify: `mobile/src/constants/theme.ts:105`
- Modify: `mobile/src/app/(auth)/login.tsx`, `(auth)/sign-up.tsx`
- Modify: `mobile/src/app/(trips)/index.tsx`, `(trips)/join.tsx`, `(trips)/account.tsx`
- Modify: `mobile/src/app/trip/[tripId]/(tabs)/dashboard.tsx`, `consensus.tsx`, `calendar.tsx`, `plan.tsx`, `notes.tsx`

**Interfaces:**
- Produces: `<Screen edges?: readonly Edge[]>` from `@/components/screen`, default `['top', 'bottom']`. Every later task's new screen uses it.

- [ ] **Step 1: Install the test harness**

Windows quoting is required — without `"--"` npm swallows the `--dev` flag:

```bash
cd mobile && npx expo install jest-expo jest @types/jest "--" --save-dev
```

- [ ] **Step 2: Configure jest in `mobile/package.json`**

Add to `scripts`:

```json
"test": "jest",
"test:watch": "jest --watchAll"
```

Add `"types": ["jest"]` to `compilerOptions` in `mobile/tsconfig.json` — without it `npx tsc --noEmit` fails on `describe`/`it`/`expect` even though `@types/jest` is installed, because the Expo base config does not include them.

Add a top-level `jest` key:

```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
}
```

- [ ] **Step 3: Write a failing smoke test proving the harness runs**

Create `mobile/src/lib/__tests__/date-range.test.ts`:

```ts
import { dayCount } from '@/lib/date-range';

describe('dayCount', () => {
  it('counts both endpoints', () => {
    expect(dayCount('2027-08-03', '2027-08-14')).toBe(12);
  });
});
```

- [ ] **Step 4: Run it and confirm it fails for the right reason**

```bash
cd mobile && npm test
```

Expected: FAIL — `Cannot find module '@/lib/date-range'`. If it instead fails on the `@/` alias not resolving, add `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }` to the jest config and re-run.

- [ ] **Step 5: Create the minimal module to make it pass**

Create `mobile/src/lib/date-range.ts`:

```ts
/** An ISO calendar date, `YYYY-MM-DD`. Always interpreted as UTC midnight. */
export type IsoDate = string;

export function fromIso(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Inclusive of both endpoints: 03→14 is 12 days. Returns 0 if end precedes start. */
export function dayCount(start: IsoDate, end: IsoDate): number {
  const ms = fromIso(end).getTime() - fromIso(start).getTime();
  if (ms < 0) return 0;
  return Math.round(ms / 86_400_000) + 1;
}
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
cd mobile && npm test
```

Expected: PASS, 1 test.

- [ ] **Step 7: Create the safe-area wrapper**

Create `mobile/src/components/screen.tsx`. `SafeAreaView` from `react-native-safe-area-context` (not the one from `react-native`, which is iOS-only and ignores `edges`) applies the insets as padding:

```tsx
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
```

- [ ] **Step 8: Add the provider and status bar to the root layout**

In `mobile/src/app/_layout.tsx`, add the imports:

```tsx
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
```

and wrap the tree inside `GestureHandlerRootView`. `initialWindowMetrics` avoids a one-frame layout flash on cold start. SDK 57's `StatusBar` takes only `style` / `hidden` / `animated` / `hideTransitionAnimation` — there is no `backgroundColor` or `translucent` prop:

```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <TripProvider>
              <RootNavigator />
            </TripProvider>
          </AuthProvider>
        </ThemeProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 9: Apply `<Screen>` to the seven no-header screens**

For `(auth)/login.tsx` and `(auth)/sign-up.tsx`, whose root is a `ScrollView`, wrap it — do not replace it, the `keyboardShouldPersistTaps` behaviour matters:

```tsx
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* unchanged */}
      </ScrollView>
    </Screen>
  );
```

For `(trips)/index.tsx` and `(trips)/account.tsx`, replace the outer `<View style={[styles.container, { backgroundColor: theme.background }]}>` with `<Screen style={styles.container}>` and delete `flex: 1` plus the `backgroundColor` from that style object — `Screen` owns both. For `(trips)/join.tsx`, wrap its root `ScrollView` the same way as the auth screens.

- [ ] **Step 10: Apply `<Screen edges={['top']}>` to the five tab screens**

`dashboard.tsx`, `consensus.tsx`, `calendar.tsx`, `plan.tsx`, `notes.tsx` all root at `<View style={[styles.container, { backgroundColor: theme.background }]}>`. Replace with `<Screen edges={['top']} style={styles.container}>` and drop `flex: 1` / `backgroundColor` from each `styles.container`. Bottom is excluded because the tab bar already insets itself.

- [ ] **Step 11: Remove the dead stub**

Delete `export const BottomTabInset = 0;` from `mobile/src/constants/theme.ts:105`. Confirm nothing referenced it:

```bash
cd mobile && grep -rn "BottomTabInset" src/ || echo "no references — safe"
```

- [ ] **Step 12: Typecheck, lint, test**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

Expected: no type errors, no new lint errors, 1 test passing.

- [ ] **Step 13: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src
git commit -m "fix: apply safe-area insets across all headerless screens

react-native-safe-area-context was installed but used nowhere, and
SafeAreaProvider was missing from the root layout, so every screen in
the app rendered under the status bar. Adds a single Screen wrapper and
applies it to ten of the eleven headerless screens; create.tsx gets it in
the wizard rewrite.

Also sets up jest-expo, which the app had no test harness for."
git push origin main
```

---

### Task 2: Date-range picker

Fixes brief item 1. Replaces the two `YYYY-MM-DD` text inputs with a real month grid. Built by hand rather than pulling in `react-native-calendars`, matching how the app already hand-builds `time-grid.tsx` and `day-picker.tsx`.

**Files:**
- Modify: `mobile/src/lib/date-range.ts`
- Modify: `mobile/src/lib/__tests__/date-range.test.ts`
- Create: `mobile/src/components/date-range-calendar.tsx`

**Interfaces:**
- Consumes: `dayCount`, `fromIso`, `toIso` from Task 1.
- Produces:
  - `type YearMonth = { year: number; month: number }` — `month` is **1-based** (1 = January).
  - `addDays(iso: IsoDate, n: number): IsoDate`
  - `addMonths(ym: YearMonth, n: number): YearMonth`
  - `monthGrid(ym: YearMonth): (IsoDate | null)[]` — always exactly 42 cells, Monday-first, `null` for padding.
  - `monthLabel(ym: YearMonth): string` — e.g. `"August 2027"`.
  - `isBetween(iso: IsoDate, start: IsoDate, end: IsoDate): boolean` — inclusive.
  - `todayIso(): IsoDate`
  - `yearMonthOf(iso: IsoDate): YearMonth`
  - `<DateRangeCalendar start={IsoDate | null} end={IsoDate | null} onChange={(start, end) => void} minDate?: IsoDate />` from `@/components/date-range-calendar`.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `mobile/src/lib/__tests__/date-range.test.ts`:

```ts
import {
  addDays,
  addMonths,
  dayCount,
  isBetween,
  monthGrid,
  monthLabel,
  yearMonthOf,
} from '@/lib/date-range';

describe('dayCount', () => {
  it('counts both endpoints', () => {
    expect(dayCount('2027-08-03', '2027-08-14')).toBe(12);
  });

  it('is 1 for a single day', () => {
    expect(dayCount('2027-08-03', '2027-08-03')).toBe(1);
  });

  it('is 0 when end precedes start', () => {
    expect(dayCount('2027-08-14', '2027-08-03')).toBe(0);
  });

  it('crosses a month boundary', () => {
    expect(dayCount('2027-08-30', '2027-09-02')).toBe(4);
  });

  it('crosses a leap day', () => {
    expect(dayCount('2028-02-27', '2028-03-01')).toBe(4);
  });
});

describe('addDays', () => {
  it('rolls over a month end', () => {
    expect(addDays('2027-08-31', 1)).toBe('2027-09-01');
  });

  it('goes backwards', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('addMonths', () => {
  it('rolls over a year end', () => {
    expect(addMonths({ year: 2027, month: 12 }, 1)).toEqual({ year: 2028, month: 1 });
  });

  it('goes backwards past a year start', () => {
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe('monthGrid', () => {
  it('always returns 42 cells so the grid height never jumps', () => {
    expect(monthGrid({ year: 2027, month: 8 })).toHaveLength(42);
    expect(monthGrid({ year: 2027, month: 2 })).toHaveLength(42);
  });

  it('is Monday-first: 1 Aug 2027 is a Sunday, so it sits in cell 6', () => {
    const grid = monthGrid({ year: 2027, month: 8 });
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toBe('2027-08-01');
  });

  it('pads the tail with nulls after the last day', () => {
    const grid = monthGrid({ year: 2027, month: 8 });
    expect(grid[36]).toBe('2027-08-31');
    expect(grid[37]).toBeNull();
  });

  it('handles a month starting on a Monday with no leading pad', () => {
    // 1 Feb 2027 is a Monday.
    expect(monthGrid({ year: 2027, month: 2 })[0]).toBe('2027-02-01');
  });
});

describe('isBetween', () => {
  it('includes both endpoints', () => {
    expect(isBetween('2027-08-03', '2027-08-03', '2027-08-14')).toBe(true);
    expect(isBetween('2027-08-14', '2027-08-03', '2027-08-14')).toBe(true);
  });

  it('excludes outside days', () => {
    expect(isBetween('2027-08-02', '2027-08-03', '2027-08-14')).toBe(false);
    expect(isBetween('2027-08-15', '2027-08-03', '2027-08-14')).toBe(false);
  });
});

describe('monthLabel', () => {
  it('formats as month and year', () => {
    expect(monthLabel({ year: 2027, month: 8 })).toBe('August 2027');
  });
});

describe('yearMonthOf', () => {
  it('extracts a 1-based month', () => {
    expect(yearMonthOf('2027-08-03')).toEqual({ year: 2027, month: 8 });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd mobile && npm test
```

Expected: FAIL — `addDays is not a function` and similar for each new export. All five `dayCount` tests should already pass from Task 1.

- [ ] **Step 3: Implement the module**

Replace `mobile/src/lib/date-range.ts` with:

```ts
/**
 * Pure UTC date maths for the trip date-range picker.
 *
 * Everything is UTC on purpose, matching tripDays() in lib/itinerary.ts. A
 * bare `new Date('2027-08-03')` parses as UTC but `new Date(2027, 7, 3)` is
 * local, and mixing the two shifts dates by a day for anyone west of
 * Greenwich. Always go through fromIso().
 */

/** An ISO calendar date, `YYYY-MM-DD`. Always interpreted as UTC midnight. */
export type IsoDate = string;

/** `month` is 1-based: 1 = January, 12 = December. */
export type YearMonth = { year: number; month: number };

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function fromIso(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function todayIso(): IsoDate {
  return toIso(new Date());
}

export function yearMonthOf(iso: IsoDate): YearMonth {
  const d = fromIso(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return toIso(new Date(fromIso(iso).getTime() + n * MS_PER_DAY));
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  // Work in absolute months to avoid manual wrap-around arithmetic.
  const total = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function monthLabel(ym: YearMonth): string {
  return `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
}

/** Inclusive of both endpoints: 03 to 14 is 12 days. Returns 0 if end precedes start. */
export function dayCount(start: IsoDate, end: IsoDate): number {
  const ms = fromIso(end).getTime() - fromIso(start).getTime();
  if (ms < 0) return 0;
  return Math.round(ms / MS_PER_DAY) + 1;
}

/** Inclusive of both endpoints. */
export function isBetween(iso: IsoDate, start: IsoDate, end: IsoDate): boolean {
  const t = fromIso(iso).getTime();
  return t >= fromIso(start).getTime() && t <= fromIso(end).getTime();
}

/**
 * A Monday-first calendar grid for one month, always exactly 42 cells (6
 * rows) so the picker's height never jumps between months. Padding cells are
 * null rather than adjacent-month dates — greying out neighbours adds
 * ambiguity about which month a tap belongs to for no real benefit.
 */
export function monthGrid(ym: YearMonth): (IsoDate | null)[] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  // getUTCDay() is Sunday-0; shift so Monday is 0.
  const leadingPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();

  const cells: (IsoDate | null)[] = [];
  for (let i = 0; i < leadingPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toIso(new Date(Date.UTC(ym.year, ym.month - 1, day))));
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd mobile && npm test
```

Expected: PASS, 17 tests (5 dayCount + 12 new).

- [ ] **Step 5: Build the calendar component**

Create `mobile/src/components/date-range-calendar.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMonths,
  dayCount,
  fromIso,
  isBetween,
  monthGrid,
  monthLabel,
  todayIso,
  yearMonthOf,
  type IsoDate,
} from '@/lib/date-range';

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// A plain string literal, not `${100 / 7}%`. TypeScript does not evaluate
// arithmetic inside template literal types, so the computed form widens to
// `string` in a standalone const and stops satisfying RN's DimensionValue
// (`${number}%`). Inline template literals in a style object are fine —
// they get the contextual type — but an extracted const does not.
const COLUMN_WIDTH = '14.2857%';

export function DateRangeCalendar({
  start,
  end,
  onChange,
  minDate = todayIso(),
}: {
  start: IsoDate | null;
  end: IsoDate | null;
  onChange: (start: IsoDate | null, end: IsoDate | null) => void;
  minDate?: IsoDate;
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(() => yearMonthOf(start ?? todayIso()));

  const cells = useMemo(() => monthGrid(visible), [visible]);
  const minTime = fromIso(minDate).getTime();

  const onPressDay = (iso: IsoDate) => {
    // First tap, a tap after a complete range, or a tap that would invert
    // the range all start over from that day.
    if (!start || end || fromIso(iso).getTime() < fromIso(start).getTime()) {
      onChange(iso, null);
      return;
    }
    onChange(start, iso);
  };

  const count = start && end ? dayCount(start, end) : 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => setVisible(addMonths(visible, -1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month">
          <ThemedText type="subtitle" themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="default" style={{ fontFamily: Fonts.headingMedium }}>
          {monthLabel(visible)}
        </ThemedText>
        <Pressable
          onPress={() => setVisible(addMonths(visible, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month">
          <ThemedText type="subtitle" themeColor="accent">
            ›
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_INITIALS.map((initial, i) => (
          <ThemedText key={i} type="small" themeColor="textMuted" style={styles.weekdayText}>
            {initial}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`pad-${i}`} style={styles.cell} />;

          const disabled = fromIso(iso).getTime() < minTime;
          const isEdge = iso === start || iso === end;
          const inRange = !!start && !!end && isBetween(iso, start, end);

          return (
            <Pressable
              key={iso}
              onPress={() => onPressDay(iso)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: inRange, disabled }}
              style={[
                styles.cell,
                inRange && !isEdge && { backgroundColor: theme.accentGlow },
                isEdge && { backgroundColor: theme.accent, borderRadius: Radius.full },
              ]}>
              <ThemedText
                type="small"
                style={[
                  styles.cellText,
                  disabled && { color: theme.textMuted, opacity: 0.4 },
                  isEdge && { color: '#fff', fontFamily: Fonts.headingMedium },
                ]}>
                {fromIso(iso).getUTCDate()}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        {count > 0 ? (
          <>
            <View style={[styles.countPill, { backgroundColor: theme.accentGlow }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {count} {count === 1 ? 'day' : 'days'}
              </ThemedText>
            </View>
            <Pressable onPress={() => onChange(null, null)} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Clear
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="small" themeColor="textMuted">
            {start ? 'Now pick the last day' : 'Pick the first day'}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: { width: COLUMN_WIDTH, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: COLUMN_WIDTH, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    minHeight: 28,
  },
  countPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
});
```

`ThemedText`'s `type` prop accepts exactly `'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'link'` (`mobile/src/components/themed-text.tsx:7`). There is no `'defaultSemiBold'` — weight above `default` comes from an inline `fontFamily: Fonts.headingMedium`, as the month label above does. Do not add new variants in this task.

- [ ] **Step 6: Typecheck, lint, test**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

Expected: no type errors, no new lint errors, 17 tests passing.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/lib/date-range.ts mobile/src/lib/__tests__/date-range.test.ts mobile/src/components/date-range-calendar.tsx
git commit -m "feat: hand-built date-range calendar with inclusive day count"
git push origin main
```

---

### Task 3: Migration 09 — catalog schema, region opt-in, seeding RPCs

The database half of brief items 2, 3 and 5. No content yet — this ships the tables, the columns, the RPCs and the ten region rows, so the app work in Tasks 4–8 has something real to run against while the content research in Tasks 9–11 proceeds in parallel.

**Files:**
- Create: `supabase/migration-09-georgia-catalog.sql`

**Interfaces:**
- Produces, callable from the app as `supabase.rpc(...)`:
  - `create_georgia_trip(p_name TEXT, p_start_date DATE, p_end_date DATE, p_region_ids TEXT[]) RETURNS UUID`
  - `seed_trip_catalog(p_trip_id UUID, p_region_ids TEXT[]) RETURNS INT` — returns the number of place rows inserted
  - `set_trip_region_selected(p_region_id TEXT, p_selected BOOLEAN) RETURNS VOID`
- Produces, readable via `supabase.from(...).select(...)`: `catalog_regions`, `catalog_places`
- Produces, new columns consumed by Task 4's mappers: `regions.is_selected`, `regions.catalog_region_id`, `regions.summary`, `regions.when_to_go`, `regions.getting_there`, `regions.base_towns`; `experiences.catalog_place_id`, `experiences.hook`, `experiences.tips`, `experiences.best_time`, `experiences.duration_min`, `experiences.price_gel_min`, `experiences.price_gel_max`, `experiences.nearest_town`, `experiences.lat`, `experiences.lng`, `experiences.kid_note`, `experiences.booking_required`

**The ten catalog region slugs.** These are frozen once this migration runs — Task 9's research and Task 11's seed files must use exactly these:

`tbilisi`, `mtskheta`, `kakheti`, `gudauri-kazbegi`, `borjomi-bakuriani`, `samtskhe-javakheti`, `shida-kartli`, `kutaisi-imereti`, `svaneti`, `batumi-adjara`

- [ ] **Step 1: Write the migration file**

Create `supabase/migration-09-georgia-catalog.sql`:

```sql
-- Migration 09 — Georgia catalog, region opt-in, richer place detail
--
-- This app is for planning a trip to Georgia (the country). The destination
-- is not a variable. What varies per trip is the dates and which of
-- Georgia's regions a given group actually wants to visit.
--
-- Adds:
--   1. catalog_regions / catalog_places — global, read-only reference data
--      holding the curated Georgia content. Readable by any authenticated
--      user whether or not they belong to a trip, which is what lets the
--      create wizard show the region grid before the trip exists.
--   2. Mirror columns + a catalog_*_id backlink on the existing per-trip
--      regions / experiences tables.
--   3. regions.is_selected — the trip's shared shortlist. Gates emphasis and
--      prompting in the app; never gates access. Every place stays browsable
--      and votable by anyone.
--   4. Three SECURITY DEFINER RPCs to create-and-seed, seed, and toggle.
--
-- WHY THE ROWS ARE COPIED RATHER THAN JOINED: votes, ratings, comments,
-- itinerary_items and place_notes all carry an experience_id foreign key to
-- experiences(id). Reading the catalog directly would break all five. Copying
-- keeps every existing FK, RLS policy, hook and screen working untouched, and
-- leaves each trip's rows independently editable by its own members.
--
-- WHY IDS ARE SUFFIXED WITH THE TRIP UUID: regions.id and experiences.id are
-- globally unique TEXT primary keys — migration-06 added trip_id as a plain
-- column but never made the key composite, so two trips cannot both own a
-- region with id 'tbilisi'. (This is also why addRegion() in the app appends
-- Date.now().toString(36).) Making the key composite would break those same
-- five foreign keys, so seeded rows mint '<catalog_slug>-<trip_uuid>' instead
-- and carry the catalog id in a dedicated column.
--
-- Every write below goes through a SECURITY DEFINER function per
-- migration-08's header — direct table writes fail under the Supabase RLS
-- platform bug documented there.
--
-- Run in Supabase Dashboard > SQL Editor, after migration-08. Idempotent.
-- Follow with the migration-10-catalog-*.sql files, which carry the places.

-- ============================================================
-- 1. Global catalog tables
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_regions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '📍',
  subtitle      TEXT,
  summary       TEXT,
  when_to_go    TEXT,
  getting_there TEXT,
  base_towns    TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS catalog_places (
  id               TEXT PRIMARY KEY,
  region_id        TEXT NOT NULL REFERENCES catalog_regions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  hook             TEXT,
  description      TEXT,
  tips             TEXT,
  best_time        TEXT,
  duration_min     INT,
  time_needed      TEXT,
  price_gel_min    INT,
  price_gel_max    INT,
  price_lari       TEXT,
  nearest_town     TEXT,
  lat              NUMERIC(9,6),
  lng              NUMERIC(9,6),
  kid_note         TEXT,
  booking_required BOOLEAN NOT NULL DEFAULT false,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  sort_order       INT NOT NULL DEFAULT 0,
  -- Audio guide. Scripts ship with the content; the rest is filled in later
  -- by the TTS pipeline (see docs/roadmap/audio-guides.md). These live on the
  -- catalog, not on per-trip rows, because one narration serves every trip
  -- and the guide is meant to be usable without a trip at all.
  guide_script       TEXT,
  guide_script_words INT,
  guide_version      INT NOT NULL DEFAULT 1,
  audio_url          TEXT,
  audio_duration_sec INT,
  audio_voice        TEXT
);

CREATE INDEX IF NOT EXISTS catalog_places_region_id_idx ON catalog_places (region_id);

-- ============================================================
-- 2. RLS on the catalog: readable by any signed-in user, written only by
--    migrations running as postgres. No write policies on purpose.
-- ============================================================

ALTER TABLE catalog_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_places  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read catalog_regions" ON catalog_regions;
CREATE POLICY "authenticated read catalog_regions" ON catalog_regions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read catalog_places" ON catalog_places;
CREATE POLICY "authenticated read catalog_places" ON catalog_places
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Mirror columns + backlinks on the per-trip tables
-- ============================================================

ALTER TABLE regions ADD COLUMN IF NOT EXISTS catalog_region_id TEXT REFERENCES catalog_regions(id) ON DELETE SET NULL;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS summary       TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS when_to_go    TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS getting_there TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS base_towns    TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS is_selected   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS selected_at   TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS selected_by   UUID REFERENCES trip_members(id) ON DELETE SET NULL;

ALTER TABLE experiences ADD COLUMN IF NOT EXISTS catalog_place_id TEXT REFERENCES catalog_places(id) ON DELETE SET NULL;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS hook             TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS tips             TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS best_time        TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS duration_min     INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS price_gel_min    INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS price_gel_max    INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS nearest_town     TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS lat              NUMERIC(9,6);
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS lng              NUMERIC(9,6);
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS kid_note         TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS booking_required BOOLEAN NOT NULL DEFAULT false;

-- Partial: member-added rows have a NULL backlink and must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS regions_trip_catalog_uidx
  ON regions (trip_id, catalog_region_id) WHERE catalog_region_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS experiences_trip_catalog_uidx
  ON experiences (trip_id, catalog_place_id) WHERE catalog_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS regions_trip_selected_idx ON regions (trip_id, is_selected);

-- regions was never added to the realtime publication — schema.sql adds
-- votes/ratings/comments and migration-01 adds experiences, but regions was
-- missed, so useRegions()'s subscription has never actually fired. Harmless
-- while regions were static; not harmless now that is_selected is a live
-- toggle other members need to see.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE regions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. Seeding + selection RPCs
-- ============================================================

-- Copies the whole catalog into one trip. Called by create_georgia_trip
-- below, and directly by the app's "Add Georgia's places" import action for
-- trips that predate the catalog.
--
-- p_region_ids marks which regions land in the trip's shortlist; everything
-- else is still copied in, just unselected, so members can browse and vote
-- outside the shortlist without anything being fetched on demand.
--
-- ON CONFLICT DO NOTHING with no target covers both the primary key and the
-- partial unique indexes above, which makes re-running this a no-op.
CREATE OR REPLACE FUNCTION public.seed_trip_catalog(
  p_trip_id UUID, p_region_ids TEXT[] DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_places INT;
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;

  INSERT INTO public.regions (
    id, trip_id, catalog_region_id, name, icon, subtitle,
    summary, when_to_go, getting_there, base_towns, sort_order,
    is_selected, selected_at
  )
  SELECT
    cr.id || '-' || p_trip_id::TEXT, p_trip_id, cr.id, cr.name, cr.icon, cr.subtitle,
    cr.summary, cr.when_to_go, cr.getting_there, cr.base_towns, cr.sort_order,
    COALESCE(cr.id = ANY(p_region_ids), false),
    CASE WHEN COALESCE(cr.id = ANY(p_region_ids), false) THEN NOW() END
  FROM public.catalog_regions cr
  WHERE cr.is_active
  ON CONFLICT DO NOTHING;

  INSERT INTO public.experiences (
    id, trip_id, catalog_place_id, region_id, name, description, hook, tips,
    best_time, duration_min, time_needed, price_lari, price_gel_min,
    price_gel_max, nearest_town, lat, lng, kid_note, booking_required,
    tags, sort_order
  )
  SELECT
    cp.id || '-' || p_trip_id::TEXT, p_trip_id, cp.id,
    cp.region_id || '-' || p_trip_id::TEXT,
    cp.name, cp.description, cp.hook, cp.tips, cp.best_time, cp.duration_min,
    cp.time_needed, cp.price_lari, cp.price_gel_min, cp.price_gel_max,
    cp.nearest_town, cp.lat, cp.lng, cp.kid_note, cp.booking_required,
    cp.tags, cp.sort_order
  FROM public.catalog_places cp
  JOIN public.catalog_regions cr ON cr.id = cp.region_id AND cr.is_active
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_places = ROW_COUNT;
  RETURN v_places;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_trip_catalog(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seed_trip_catalog(UUID, TEXT[]) TO authenticated;

-- Create + seed in one call. The on_trip_created trigger from migration-06
-- inserts the creator's owner row synchronously as part of the INSERT, so
-- private.is_trip_member() inside seed_trip_catalog already passes by the
-- time it runs.
--
-- destination is hardcoded: every trip in this app is a Georgia trip. The
-- column stays for the legacy Georgia 2026 row rather than being dropped.
--
-- The old create_trip(TEXT, TEXT, DATE, DATE) is deliberately left in place
-- and untouched.
CREATE OR REPLACE FUNCTION public.create_georgia_trip(
  p_name TEXT, p_start_date DATE, p_end_date DATE, p_region_ids TEXT[] DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF COALESCE(BTRIM(p_name), '') = '' THEN
    RAISE EXCEPTION 'Trip name is required';
  END IF;
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date cannot precede start date';
  END IF;

  INSERT INTO public.trips (name, destination, start_date, end_date, cover_emoji, created_by)
  VALUES (BTRIM(p_name), 'Georgia', p_start_date, p_end_date, '🇬🇪', (SELECT auth.uid()))
  RETURNING id INTO v_id;

  PERFORM public.seed_trip_catalog(v_id, p_region_ids);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_georgia_trip(TEXT, DATE, DATE, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_georgia_trip(TEXT, DATE, DATE, TEXT[]) TO authenticated;

-- Toggle one region into or out of the trip's shortlist. Any member may do
-- this, matching the "members insert/update regions" RLS policies from
-- migration-06 section 7 — the shortlist is a shared group decision, not an
-- admin-only one.
CREATE OR REPLACE FUNCTION public.set_trip_region_selected(
  p_region_id TEXT, p_selected BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id   UUID;
  v_member_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.regions WHERE id = p_region_id;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Region not found';
  END IF;
  IF NOT (SELECT private.is_trip_member(v_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;

  SELECT id INTO v_member_id FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = (SELECT auth.uid()) AND status = 'active'
   LIMIT 1;

  UPDATE public.regions
     SET is_selected = p_selected,
         selected_at = CASE WHEN p_selected THEN NOW() ELSE NULL END,
         selected_by = CASE WHEN p_selected THEN v_member_id ELSE NULL END
   WHERE id = p_region_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_trip_region_selected(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_trip_region_selected(TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- 5. The ten catalog regions. Places arrive in migration-10-catalog-*.sql.
--    Slugs are frozen once this runs — trips reference them via
--    regions.catalog_region_id, so renaming one orphans live rows.
-- ============================================================

INSERT INTO catalog_regions (id, name, icon, subtitle, sort_order) VALUES
  ('tbilisi',            'Tbilisi',                        '🏙️', 'City, views, sulfur baths',            1),
  ('mtskheta',           'Mtskheta & the Military Highway','⛪', 'Ancient capital, the road north',      2),
  ('kakheti',            'Kakheti',                        '🍇', 'Wine country',                          3),
  ('gudauri-kazbegi',    'Gudauri & Kazbegi',              '🏔️', 'Alpine, cool, glaciers',                4),
  ('borjomi-bakuriani',  'Borjomi & Bakuriani',            '🌿', 'Mineral springs, forest, cool air',     5),
  ('samtskhe-javakheti', 'Samtskhe-Javakheti',             '🪨', 'Vardzia cave city & Rabati fortress',   6),
  ('shida-kartli',       'Shida Kartli',                   '🏛️', 'Gori & the Uplistsikhe rock town',      7),
  ('kutaisi-imereti',    'Kutaisi & Imereti',              '🌊', 'Caves, canyons & water',                8),
  ('svaneti',            'Svaneti',                        '🗼', 'Medieval towers under big mountains',   9),
  ('batumi-adjara',      'Batumi & Adjara',                '🌴', 'Black Sea coast & subtropical hills',  10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. Verification — run these after the migration and eyeball the output.
-- ============================================================

-- Expect 10 rows.
SELECT count(*) AS catalog_regions FROM catalog_regions;

-- Expect 0 here until the migration-10-catalog-*.sql files have been run.
SELECT count(*) AS catalog_places FROM catalog_places;

-- Expect all three functions, each prosecdef = true (SECURITY DEFINER).
SELECT p.proname, p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_georgia_trip', 'seed_trip_catalog', 'set_trip_region_selected')
 ORDER BY p.proname;

-- Expect exactly one row per function, granted to `authenticated` and to
-- nobody else. Anything mentioning anon or PUBLIC here is a bug.
SELECT routine_name, grantee
  FROM information_schema.routine_privileges
 WHERE routine_schema = 'public'
   AND routine_name IN ('create_georgia_trip', 'seed_trip_catalog', 'set_trip_region_selected')
 ORDER BY routine_name, grantee;

-- Expect regions to appear.
SELECT tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND tablename IN ('regions', 'experiences')
 ORDER BY tablename;
```

- [ ] **Step 2: Check the SQL parses**

There is no Supabase CLI in this environment and no local Postgres, so this cannot be executed here. Do a syntax read-through against these specific risks, all of which have bitten this project before:

1. Every `CREATE FUNCTION` body is dollar-quoted with `$$` and ends `$$;`
2. Every function has `SET search_path = ''` and therefore **every** table reference inside is schema-qualified (`public.regions`, not `regions`)
3. Every function has both a `REVOKE ... FROM PUBLIC, anon` and a `GRANT ... TO authenticated`, with argument types matching the signature exactly
4. `DROP POLICY IF EXISTS` precedes each `CREATE POLICY`
5. Re-running the whole file is a no-op

- [ ] **Step 3: Hand the migration to the user**

This is the one place the work has to leave the machine. Tell the user:

> `supabase/migration-09-georgia-catalog.sql` is ready. Run it in the Supabase SQL Editor after migration-08, then paste back the output of the five verification queries at the bottom.

Do not proceed to Task 5 (which calls `create_georgia_trip`) until that confirmation comes back. Tasks 4, 9 and 10 do not depend on it and can continue meanwhile.

- [ ] **Step 4: Commit**

```bash
git add supabase/migration-09-georgia-catalog.sql
git commit -m "feat(db): Georgia catalog tables, region opt-in, seeding RPCs

Global catalog_regions/catalog_places hold the curated content; a
SECURITY DEFINER seed_trip_catalog() copies it into a trip's own rows at
creation, minting per-trip ids because regions.id/experiences.id are
globally unique TEXT keys. regions.is_selected carries the trip's shared
shortlist.

Also adds regions to the supabase_realtime publication, which it was
never added to -- useRegions()'s subscription has silently never fired."
git push origin main
```

---

### Task 4: App data layer for the catalog and the shortlist

Extends the typed data layer to carry the new columns, adds the three RPC wrappers, and fixes the calendar gate that seeding would otherwise break. No UI yet — this task's deliverable is a typechecking, tested data layer.

**Files:**
- Modify: `mobile/src/lib/hooks.ts`
- Create: `mobile/src/lib/catalog.ts`
- Modify: `mobile/src/lib/access.ts:8`
- Modify: `mobile/src/lib/itinerary.ts:47`
- Modify: `mobile/src/app/trip/[tripId]/(tabs)/calendar.tsx:43,84`
- Create: `mobile/src/lib/__tests__/access.test.ts`
- Create: `mobile/src/lib/__tests__/itinerary.test.ts`

**Interfaces:**
- Consumes: the RPCs and columns from Task 3.
- Produces, from `@/lib/hooks`:
  - `Region` gains `catalogRegionId: string | null`, `summary: string | null`, `whenToGo: string | null`, `gettingThere: string | null`, `baseTowns: string | null`, `isSelected: boolean`
  - `Experience` gains `catalogPlaceId: string | null`, `hook: string | null`, `tips: string | null`, `bestTime: string | null`, `durationMin: number | null`, `priceGelMin: number | null`, `priceGelMax: number | null`, `nearestTown: string | null`, `lat: number | null`, `lng: number | null`, `kidNote: string | null`, `bookingRequired: boolean`
  - `useRegions(tripId)` now returns `{ regions, selectedRegions, unselectedRegions, loading, refetch }`
  - `experiencesInSelectedRegions(experiences: Experience[], regions: Region[]): Experience[]`
- Produces, from `@/lib/catalog`:
  - `useCatalogRegions(): { catalogRegions: CatalogRegion[]; loading: boolean }`
  - `type CatalogRegion = { id: string; name: string; icon: string; subtitle: string | null; sortOrder: number }`
  - `createGeorgiaTrip(args: { name: string; startDate: string | null; endDate: string | null; regionIds: string[] }): Promise<{ tripId: string | null; error: Error | null }>`
  - `seedTripCatalog(tripId: string, regionIds: string[]): Promise<{ placesAdded: number; error: Error | null }>`
  - `setRegionSelected(regionId: string, selected: boolean): Promise<{ error: Error | null }>`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/lib/__tests__/access.test.ts`:

```ts
import { hasCompletedVoting } from '@/lib/access';
import { experiencesInSelectedRegions, type Experience, type Region, type Vote } from '@/lib/hooks';

const region = (id: string, isSelected: boolean): Region => ({
  id,
  name: id,
  icon: '📍',
  subtitle: null,
  sortOrder: 0,
  catalogRegionId: id,
  summary: null,
  whenToGo: null,
  gettingThere: null,
  baseTowns: null,
  isSelected,
});

const place = (id: string, regionId: string): Experience => ({
  id,
  regionId,
  name: id,
  description: '',
  time: '1 hr',
  priceLari: 'Free',
  priceRupee: '—',
  priceAED: '—',
  tags: [],
  sortOrder: 0,
  catalogPlaceId: id,
  hook: null,
  tips: null,
  bestTime: null,
  durationMin: null,
  priceGelMin: null,
  priceGelMax: null,
  nearestTown: null,
  lat: null,
  lng: null,
  kidNote: null,
  bookingRequired: false,
});

const vote = (memberId: string, experienceId: string): Vote => ({
  id: 1,
  trip_id: 't',
  member_id: memberId,
  experience_id: experienceId,
  vote: 'go',
  trip_members: null,
});

describe('experiencesInSelectedRegions', () => {
  it('keeps only places whose region is shortlisted', () => {
    const regions = [region('tbilisi', true), region('svaneti', false)];
    const places = [place('a', 'tbilisi'), place('b', 'svaneti'), place('c', 'tbilisi')];
    expect(experiencesInSelectedRegions(places, regions).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('returns nothing when no region is shortlisted', () => {
    const regions = [region('tbilisi', false)];
    expect(experiencesInSelectedRegions([place('a', 'tbilisi')], regions)).toEqual([]);
  });

  it('drops places whose region is missing entirely', () => {
    expect(experiencesInSelectedRegions([place('a', 'ghost')], [region('tbilisi', true)])).toEqual([]);
  });
});

describe('hasCompletedVoting', () => {
  it('is true once every place in scope is voted on', () => {
    const places = [place('a', 'tbilisi'), place('b', 'tbilisi')];
    const votes = [vote('m1', 'a'), vote('m1', 'b')];
    expect(hasCompletedVoting(votes, places, 'm1')).toBe(true);
  });

  it('is false with one place left', () => {
    const places = [place('a', 'tbilisi'), place('b', 'tbilisi')];
    expect(hasCompletedVoting([vote('m1', 'a')], places, 'm1')).toBe(false);
  });

  it('ignores other members votes', () => {
    const places = [place('a', 'tbilisi')];
    expect(hasCompletedVoting([vote('m2', 'a')], places, 'm1')).toBe(false);
  });

  // Array.every() on an empty array is true, which would have unlocked the
  // calendar for a trip with no places at all.
  it('is false when the scope is empty', () => {
    expect(hasCompletedVoting([], [], 'm1')).toBe(false);
  });
});
```

Create `mobile/src/lib/__tests__/itinerary.test.ts`:

```ts
import { parseDefaultDuration, tripDays } from '@/lib/itinerary';

describe('parseDefaultDuration', () => {
  it('prefers the structured duration when present', () => {
    expect(parseDefaultDuration('2–3 hr', 90)).toBe(90);
  });

  it('snaps a structured duration to the 30-minute grid', () => {
    expect(parseDefaultDuration(undefined, 100)).toBe(90);
    expect(parseDefaultDuration(undefined, 105)).toBe(120);
  });

  it('ignores a non-positive structured duration', () => {
    expect(parseDefaultDuration('45 min', 0)).toBe(60);
  });

  it('falls back to parsing the human string for member-added places', () => {
    expect(parseDefaultDuration('2 hr', null)).toBe(120);
    expect(parseDefaultDuration('full day', null)).toBe(480);
    expect(parseDefaultDuration('half day', null)).toBe(240);
  });

  it('defaults to an hour when it can parse nothing', () => {
    expect(parseDefaultDuration(undefined, null)).toBe(60);
  });
});

describe('tripDays', () => {
  it('is inclusive of both endpoints', () => {
    expect(tripDays('2027-08-03', '2027-08-06')).toEqual([
      '2027-08-03',
      '2027-08-04',
      '2027-08-05',
      '2027-08-06',
    ]);
  });

  it('is empty when either date is missing', () => {
    expect(tripDays(null, '2027-08-06')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd mobile && npm test
```

Expected: FAIL — `experiencesInSelectedRegions` is not exported, and `parseDefaultDuration` takes one argument.

- [ ] **Step 3: Extend the types and mappers in `hooks.ts`**

Replace the `Region` type and add the selection helper. Note `regionId?: never` is dropped from `Region` — it was a hack to stop `Region` and `Experience` being structurally assignable, and the new distinct fields make it unnecessary:

```ts
export type Region = {
  id: string;
  name: string;
  icon: string;
  subtitle: string | null;
  sortOrder: number;
  catalogRegionId: string | null;
  summary: string | null;
  whenToGo: string | null;
  gettingThere: string | null;
  baseTowns: string | null;
  isSelected: boolean;
};
```

```ts
function mapDbRegion(row: any): Region {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || '📍',
    subtitle: row.subtitle,
    sortOrder: row.sort_order ?? 0,
    catalogRegionId: row.catalog_region_id ?? null,
    summary: row.summary ?? null,
    whenToGo: row.when_to_go ?? null,
    gettingThere: row.getting_there ?? null,
    baseTowns: row.base_towns ?? null,
    isSelected: row.is_selected ?? false,
  };
}
```

Extend `Experience` and `mapDbExperience` the same way:

```ts
export type Experience = {
  id: string;
  regionId: string;
  name: string;
  description: string;
  time: string;
  priceLari: string;
  priceRupee: string;
  priceAED: string;
  tags: string[];
  sortOrder: number;
  catalogPlaceId: string | null;
  hook: string | null;
  tips: string | null;
  bestTime: string | null;
  durationMin: number | null;
  priceGelMin: number | null;
  priceGelMax: number | null;
  nearestTown: string | null;
  lat: number | null;
  lng: number | null;
  kidNote: string | null;
  bookingRequired: boolean;
};
```

```ts
function mapDbExperience(row: any): Experience {
  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    description: row.description || '',
    time: row.time_needed || '—',
    priceLari: row.price_lari || '—',
    priceRupee: row.price_rupee || '—',
    priceAED: row.price_aed || '—',
    tags: row.tags || [],
    sortOrder: row.sort_order ?? 0,
    catalogPlaceId: row.catalog_place_id ?? null,
    hook: row.hook ?? null,
    tips: row.tips ?? null,
    bestTime: row.best_time ?? null,
    // NUMERIC comes back from PostgREST as a string; INT comes back as a
    // number. Normalise both rather than letting `lat` be a string.
    durationMin: row.duration_min ?? null,
    priceGelMin: row.price_gel_min ?? null,
    priceGelMax: row.price_gel_max ?? null,
    nearestTown: row.nearest_town ?? null,
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    kidNote: row.kid_note ?? null,
    bookingRequired: row.booking_required ?? false,
  };
}
```

Replace `useRegions` and add the scoping helper:

```ts
export function useRegions(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<any>('regions', tripId, '*', {
    column: 'sort_order',
  });
  const regions = useMemo(() => data.map(mapDbRegion), [data]);
  const selectedRegions = useMemo(() => regions.filter((r) => r.isSelected), [regions]);
  const unselectedRegions = useMemo(() => regions.filter((r) => !r.isSelected), [regions]);
  return { regions, selectedRegions, unselectedRegions, loading, refetch };
}

/**
 * Every trip carries the whole Georgia catalog, so "all experiences" is ~113
 * places whether or not the group is going to any of them. Anything that
 * counts progress, nags, or gates has to run over the shortlist instead.
 * Browsing and voting are deliberately NOT scoped — those stay open.
 */
export function experiencesInSelectedRegions(experiences: Experience[], regions: Region[]): Experience[] {
  const selected = new Set(regions.filter((r) => r.isSelected).map((r) => r.id));
  return experiences.filter((e) => selected.has(e.regionId));
}
```

Add `useMemo` to the React import at the top of the file.

- [ ] **Step 4: Fix the voting gate in `access.ts`**

```ts
/**
 * A person may edit the calendar once they've voted on every place in the
 * trip's shortlisted regions. Callers must pass an already-scoped list —
 * experiencesInSelectedRegions() in lib/hooks.
 *
 * The empty guard matters: Array.every() on [] is true, so a trip with no
 * shortlisted regions would otherwise hand everyone calendar access.
 */
export function hasCompletedVoting(votes: Vote[], experiences: Experience[], memberId: string) {
  if (experiences.length === 0) return false;
  return experiences.every((e) => votes.some((v) => v.member_id === memberId && v.experience_id === e.id));
}
```

- [ ] **Step 5: Prefer the structured duration in `itinerary.ts`**

```ts
/**
 * Catalog places carry a real duration_min. Member-added places only have
 * the free-text "2–3 hr" string, so the regex path stays as the fallback.
 */
export function parseDefaultDuration(timeNeeded?: string, durationMin?: number | null): number {
  const snap = (min: number) => Math.max(SLOT_MIN, Math.round(min / SLOT_MIN) * SLOT_MIN);
  if (typeof durationMin === 'number' && durationMin > 0) return snap(durationMin);

  const text = (timeNeeded || '').toLowerCase();
  if (text.includes('full day')) return 480;
  if (text.includes('half')) return 240;
  const firstNumber = text.match(/\d+(?:\.\d+)?/);
  if (firstNumber) {
    const n = parseFloat(firstNumber[0]);
    if (text.includes('hr') || text.includes('hour')) return snap(n * 60);
    if (text.includes('min')) return snap(n);
  }
  return 60;
}
```

- [ ] **Step 6: Update the two calendar call sites**

In `mobile/src/app/trip/[tripId]/(tabs)/calendar.tsx`, import the helper and scope the gate. Replace lines 42–43:

```tsx
  const scopedExperiences = useMemo(
    () => experiencesInSelectedRegions(experiences, regions),
    [experiences, regions]
  );
  const votedCount = activeMember
    ? scopedExperiences.filter((e) => votes.some((v) => v.member_id === activeMember.id && v.experience_id === e.id)).length
    : 0;
  const canEdit =
    !gateLoading && !!activeMember &&
    (hasCompletedVoting(votes, scopedExperiences, activeMember.id) || grantedIds.has(activeMember.id));
```

Update the locked-banner copy at line 133 to read `{votedCount}/{scopedExperiences.length}` instead of `{experiences.length}`, and update line 84 to pass the structured duration:

```tsx
    const exp = payload.kind === 'place' ? expById.get(payload.experienceId) : undefined;
    const durationMin = payload.kind === 'place' ? parseDefaultDuration(exp?.time, exp?.durationMin) : 60;
```

Add `experiencesInSelectedRegions` to the `@/lib/hooks` import.

- [ ] **Step 7: Create the catalog module**

Create `mobile/src/lib/catalog.ts`:

```ts
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
// insert; see that migration's header for why. Creating and seeding in one
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

// seed_trip_catalog (migration-09) — SECURITY DEFINER RPC, not a direct
// insert; see that migration's header for why. The manual "Add Georgia's
// places" import for trips that predate the catalog. Idempotent server-side.
export async function seedTripCatalog(tripId: string, regionIds: string[]) {
  const { data, error } = await supabase.rpc('seed_trip_catalog', {
    p_trip_id: tripId,
    p_region_ids: regionIds.length > 0 ? regionIds : null,
  });
  return { placesAdded: (data as number | null) ?? 0, error };
}

// set_trip_region_selected (migration-09) — SECURITY DEFINER RPC, not a
// direct update; see that migration's header for why. Any member may change
// the shortlist; it's a shared group decision, matching migration-06's
// "members update regions" policy.
export async function setRegionSelected(regionId: string, selected: boolean) {
  const { error } = await supabase.rpc('set_trip_region_selected', {
    p_region_id: regionId,
    p_selected: selected,
  });
  return { error };
}
```

- [ ] **Step 8: Run the tests and typecheck**

```bash
cd mobile && npm test && npx tsc --noEmit && npm run lint
```

Expected: PASS on all tests including the 12 new ones. Typecheck will surface any other file still constructing a `Region` or `Experience` literal — fix those to include the new fields.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/lib mobile/src/app/trip
git commit -m "feat: catalog data layer, shortlist scoping, structured durations

Extends Region/Experience with the migration-09 columns, adds the three
catalog RPC wrappers, and scopes the calendar's voting gate to
shortlisted regions -- seeding ~113 places into every trip would
otherwise have locked the calendar permanently.

Also fixes hasCompletedVoting() returning true for an empty scope, which
handed calendar access to anyone in a trip with no places."
git push origin main
```

---

### Task 5: Region picker and the 3-step create wizard

Brief items 1 and 2. Deletes the free-text destination field, replaces the date inputs with the Task 2 calendar, and adds the region pick as a third step.

**Files:**
- Create: `mobile/src/components/region-picker-grid.tsx`
- Rewrite: `mobile/src/app/(trips)/create.tsx`
- Modify: `mobile/src/app/(trips)/index.tsx` (stop rendering `trip.destination`)

**Interfaces:**
- Consumes: `DateRangeCalendar` (Task 2), `useCatalogRegions` / `createGeorgiaTrip` (Task 4), `Screen` (Task 1).
- Produces: `<RegionPickerGrid options={RegionOption[]} selectedIds={Set<string>} onToggle={(id: string) => void} />` and `type RegionOption = { id: string; name: string; icon: string; subtitle: string | null }`, both from `@/components/region-picker-grid`. Task 6 reuses these.

- [ ] **Step 1: Build the region picker grid**

Create `mobile/src/components/region-picker-grid.tsx`. It is deliberately generic over `RegionOption` rather than taking `CatalogRegion` or `Region`, because the wizard feeds it catalog rows (pre-trip) and the dashboard feeds it trip rows (post-trip):

```tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RegionOption = {
  id: string;
  name: string;
  icon: string;
  subtitle: string | null;
};

export function RegionPickerGrid({
  options,
  selectedIds,
  onToggle,
}: {
  options: RegionOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = selectedIds.has(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => onToggle(option.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.name}
            style={[
              styles.tile,
              {
                borderColor: selected ? theme.accent : theme.border,
                backgroundColor: selected ? theme.accentGlow : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="default" style={styles.icon}>
              {option.icon}
            </ThemedText>
            <ThemedText
              type="small"
              style={selected ? { color: theme.accent, fontFamily: Fonts.headingMedium } : undefined}>
              {option.name}
            </ThemedText>
            {!!option.subtitle && (
              <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
                {option.subtitle}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Two columns: half the width minus half the gap.
  tile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
    minHeight: 96,
  },
  icon: { fontSize: 24 },
});
```

- [ ] **Step 2: Rewrite the create screen as a wizard**

Replace `mobile/src/app/(trips)/create.tsx` entirely:

```tsx
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateRangeCalendar } from '@/components/date-range-calendar';
import { RegionPickerGrid } from '@/components/region-picker-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { createGeorgiaTrip, useCatalogRegions } from '@/lib/catalog';
import { dayCount, type IsoDate } from '@/lib/date-range';

const STEPS = 3;

export default function CreateTripScreen() {
  const theme = useTheme();
  const { refetchTrips, setActiveTripId } = useTrip();
  const { catalogRegions, loading: catalogLoading } = useCatalogRegions();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [start, setStart] = useState<IsoDate | null>(null);
  const [end, setEnd] = useState<IsoDate | null>(null);
  const [regionIds, setRegionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleRegion = (id: string) => {
    setRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const options = useMemo(
    () => catalogRegions.map((r) => ({ id: r.id, name: r.name, icon: r.icon, subtitle: r.subtitle })),
    [catalogRegions]
  );

  const canAdvance = step === 1 ? name.trim().length > 0 : step === 2 ? !!start && !!end : true;

  const onCreate = async () => {
    setError(null);
    setSubmitting(true);
    const { tripId, error: rpcError } = await createGeorgiaTrip({
      name,
      startDate: start,
      endDate: end,
      regionIds: [...regionIds],
    });
    setSubmitting(false);
    if (rpcError || !tripId) {
      setError(rpcError?.message ?? 'Could not create trip');
      return;
    }
    await refetchTrips();
    setActiveTripId(tripId);
    router.replace({ pathname: '/trip/[tripId]/dashboard', params: { tripId } });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.dots}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i < step ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">What&rsquo;s this trip called?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              You&rsquo;ll be the owner and can invite others once it&rsquo;s created.
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Georgia 2027"
              placeholderTextColor={theme.textMuted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => canAdvance && setStep(2)}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">When are you going?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Tap the first day, then the last. You can change this later.
            </ThemedText>
            <DateRangeCalendar
              start={start}
              end={end}
              onChange={(nextStart, nextEnd) => {
                setStart(nextStart);
                setEnd(nextEnd);
              }}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">Which parts of Georgia?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Pick the regions you&rsquo;re planning around. You&rsquo;ll still be able to browse and vote on
              everywhere else, and you can change this anytime.
            </ThemedText>
            {catalogLoading ? (
              <ThemedText type="default" themeColor="textMuted">
                Loading regions…
              </ThemedText>
            ) : (
              <RegionPickerGrid options={options} selectedIds={regionIds} onToggle={toggleRegion} />
            )}
          </View>
        )}

        {error && (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        )}

        <View style={styles.nav}>
          {step > 1 ? (
            <Pressable onPress={() => setStep(step - 1)} hitSlop={8}>
              <ThemedText type="default" themeColor="textSecondary">
                ‹ Back
              </ThemedText>
            </Pressable>
          ) : (
            <View />
          )}

          {step < STEPS ? (
            <Pressable
              onPress={() => setStep(step + 1)}
              disabled={!canAdvance}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: canAdvance ? 1 : 0.4 }]}>
              <ThemedText type="default" style={styles.primaryLabel}>
                Next ›
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={onCreate}
              disabled={submitting}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
              <ThemedText type="default" style={styles.primaryLabel}>
                {submitting ? 'Creating…' : regionIds.size > 0 ? 'Create trip' : 'Skip for now'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {step === 2 && start && end && (
          <ThemedText type="small" themeColor="textMuted" style={styles.centered}>
            {dayCount(start, end)} days in Georgia
          </ThemedText>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center' },
  dot: { width: 28, height: 4, borderRadius: Radius.full },
  stepBody: { gap: Spacing.md, flex: 1 },
  centered: { textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  primary: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
  },
  primaryLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
});
```

- [ ] **Step 3: Stop showing the destination on the trip list**

Every trip's destination is now the literal string `Georgia`, so rendering it under each card is noise. In `mobile/src/app/(trips)/index.tsx`, delete the `{item.destination && (...)}` block from the card and show the date range instead:

```tsx
            <View style={{ flex: 1 }}>
              <ThemedText type="default">{item.name}</ThemedText>
              {item.start_date && item.end_date && (
                <ThemedText type="small" themeColor="textSecondary">
                  {dayCount(item.start_date, item.end_date)} days
                </ThemedText>
              )}
            </View>
```

Import `dayCount` from `@/lib/date-range`. Leave `TripSummary.destination` in `TripContext` — the column still exists and the legacy trip still uses it.

- [ ] **Step 4: Typecheck, lint, test**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

- [ ] **Step 5: Verify against a real trip**

This step needs migration-09 to have been run (Task 3, Step 3). Start the app, create a trip through all three steps picking two regions, and confirm: the trip is created, the dashboard opens, and `select count(*) from experiences where trip_id = '<new id>'` returns the full catalog count while `select count(*) from regions where trip_id = '<new id>' and is_selected` returns 2.

If the catalog place files (Task 11) have not been run yet, the experience count will be 0 and only the 10 region rows will appear. That is expected and not a failure.

- [ ] **Step 6: Commit**

```bash
git add mobile/src
git commit -m "feat: 3-step trip creation wizard, drop the destination field

Every trip in this app is a Georgia trip, so the free-text destination
is gone; create_georgia_trip hardcodes it. Trip creation is now name,
then a date-range calendar, then an opt-in region pick that seeds the
trip's shortlist."
git push origin main
```

---

### Task 6: Dashboard — shortlist, explore entry point, catalog import

Brief item 5's main surface. The dashboard stops being a flat region list and splits into the trip's shortlist plus a doorway to everything else.

**Files:**
- Modify: `mobile/src/app/trip/[tripId]/(tabs)/dashboard.tsx`
- Modify: `mobile/src/app/trip/[tripId]/_layout.tsx`

**Interfaces:**
- Consumes: `RegionPickerGrid` (Task 5), `useRegions` / `experiencesInSelectedRegions` (Task 4), `seedTripCatalog` / `setRegionSelected` (Task 4), `Screen` (Task 1).
- Produces: routes `/trip/[tripId]/explore` and `/trip/[tripId]/place/[placeId]` registered in the stack (the screens themselves land in Tasks 7 and 8).

- [ ] **Step 1: Register the new routes**

In `mobile/src/app/trip/[tripId]/_layout.tsx`, add two screens to the `Stack`:

```tsx
      <Stack.Screen name="explore" options={{ headerShown: true, title: 'Explore Georgia' }} />
      <Stack.Screen name="place/[placeId]" options={{ headerShown: true, title: '' }} />
```

- [ ] **Step 2: Rework the dashboard**

Replace the body of `mobile/src/app/trip/[tripId]/(tabs)/dashboard.tsx`. Three changes matter: progress is computed over shortlisted places only, the inline "add region" form is replaced by shortlist editing (the catalog covers the regions; free-text region creation stays available but moves to Explore), and a trip with no catalog rows gets an import prompt.

```tsx
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { RegionCard } from '@/components/region-card';
import { RegionPickerGrid } from '@/components/region-picker-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { seedTripCatalog, setRegionSelected } from '@/lib/catalog';
import { dayCount } from '@/lib/date-range';
import {
  experiencesInSelectedRegions,
  useExperiences,
  useRegions,
  useTripMembers,
  useVotes,
} from '@/lib/hooks';

export default function DashboardScreen() {
  const theme = useTheme();
  const { trips, activeTripId, activeMember } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);
  const isAdmin = activeMember?.role === 'owner' || activeMember?.role === 'admin';

  const { regions, selectedRegions, unselectedRegions, loading: regionsLoading, refetch } = useRegions(activeTripId);
  const { experiences } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { members } = useTripMembers(activeTripId);

  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);

  const scoped = useMemo(() => experiencesInSelectedRegions(experiences, regions), [experiences, regions]);
  const placeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of experiences) counts.set(e.regionId, (counts.get(e.regionId) ?? 0) + 1);
    return counts;
  }, [experiences]);

  // A trip created before migration-09, or one whose seeding was skipped.
  const needsCatalog = !regionsLoading && regions.every((r) => r.catalogRegionId === null);

  const openRegion = (regionId: string) => {
    if (!activeTripId) return;
    router.push({ pathname: '/trip/[tripId]/region/[regionId]', params: { tripId: activeTripId, regionId } });
  };

  const onImport = async () => {
    if (!activeTripId) return;
    setImporting(true);
    await seedTripCatalog(activeTripId, []);
    await refetch();
    setImporting(false);
  };

  const progressForMember = (memberId: string) => {
    if (scoped.length === 0) return 0;
    const voted = scoped.filter((e) => votes.some((v) => v.member_id === memberId && v.experience_id === e.id)).length;
    return voted / scoped.length;
  };

  return (
    <Screen edges={['top']}>
      <FlatList
        data={selectedRegions}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="title" style={{ flex: 1 }}>
                {trip?.cover_emoji ?? '🧳'} {trip?.name ?? 'Trip'}
              </ThemedText>
              {isAdmin && activeTripId && (
                <Pressable
                  onPress={() => router.push({ pathname: '/trip/[tripId]/admin', params: { tripId: activeTripId } })}>
                  <ThemedText type="link">⚙️ Admin</ThemedText>
                </Pressable>
              )}
            </View>
            {trip?.start_date && trip?.end_date && (
              <ThemedText type="default" themeColor="textSecondary">
                {dayCount(trip.start_date, trip.end_date)} days in Georgia
              </ThemedText>
            )}

            {needsCatalog && (
              <View style={[styles.notice, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
                <ThemedText type="small">
                  This trip was made before the Georgia guide existed. Add all of Georgia&rsquo;s regions and places
                  to it — nothing you already have is changed or removed.
                </ThemedText>
                <Pressable
                  onPress={onImport}
                  disabled={importing}
                  style={[styles.noticeButton, { backgroundColor: theme.accent, opacity: importing ? 0.6 : 1 }]}>
                  <ThemedText type="small" style={styles.buttonLabel}>
                    {importing ? 'Adding…' : "Add Georgia's places"}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {members.length > 0 && scoped.length > 0 && (
              <View style={[styles.progressCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progressTitle}>
                  Voting progress · {scoped.length} places
                </ThemedText>
                {members.map((m) => {
                  const pct = progressForMember(m.id);
                  return (
                    <View key={m.id} style={styles.progressRow}>
                      <ThemedText type="small">
                        {m.emoji} {m.display_name}
                      </ThemedText>
                      <View style={[styles.progressTrack, { backgroundColor: theme.background }]}>
                        <View
                          style={[
                            styles.progressFill,
                            { backgroundColor: theme.accent, width: `${Math.round(pct * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.sectionRow}>
              <ThemedText type="subtitle" style={{ flex: 1 }}>
                Our regions
              </ThemedText>
              {regions.length > 0 && (
                <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
                  <ThemedText type="link">{editing ? 'Done' : 'Edit'}</ThemedText>
                </Pressable>
              )}
            </View>

            {editing && (
              <RegionPickerGrid
                options={regions.map((r) => ({ id: r.id, name: r.name, icon: r.icon, subtitle: r.subtitle }))}
                selectedIds={new Set(selectedRegions.map((r) => r.id))}
                onToggle={async (id) => {
                  const region = regions.find((r) => r.id === id);
                  if (!region) return;
                  await setRegionSelected(id, !region.isSelected);
                  await refetch();
                }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          !regionsLoading && !editing ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No regions picked yet. Tap Edit above to choose where you&rsquo;re going, or explore all of Georgia
              below.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RegionCard region={item} placeCount={placeCount.get(item.id) ?? 0} onPress={() => openRegion(item.id)} />
          </View>
        )}
        ListFooterComponent={
          activeTripId ? (
            <Pressable
              onPress={() => router.push({ pathname: '/trip/[tripId]/explore', params: { tripId: activeTripId } })}
              style={[styles.exploreCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="default">🇬🇪 Explore all of Georgia ›</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {unselectedRegions.length} more regions ·{' '}
                {experiences.length - scoped.length} places · browse and vote freely
              </ThemedText>
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm },
  header: { gap: Spacing.sm, marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.lg },
  cardWrap: { marginBottom: Spacing.sm },
  notice: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  noticeButton: { borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  buttonLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
  progressCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  progressTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  progressRow: { gap: 4 },
  progressTrack: { height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  exploreCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 2, marginTop: Spacing.md },
});
```

- [ ] **Step 3: Add the place count to `RegionCard`**

`mobile/src/components/region-card.tsx` currently takes only `region` and `onPress`. Add an optional `placeCount?: number` prop and render it as a `small` / `textMuted` line under the subtitle, e.g. `12 places`. Read the file first and match its existing structure rather than rewriting it.

- [ ] **Step 4: Typecheck, lint, test, then look at it**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

Then run the app and confirm: shortlisted regions appear under "Our regions", Edit toggles regions in and out and the list updates live, progress reads over the shortlist only, and the Explore card shows the remaining counts.

- [ ] **Step 5: Commit**

```bash
git add mobile/src
git commit -m "feat: dashboard splits into the trip shortlist and Explore Georgia

Voting progress now counts only shortlisted regions instead of all ~113
catalog places, Edit toggles the shared shortlist inline, and trips
predating the catalog get a one-tap import."
git push origin main
```

---

### Task 7: Explore screen and the region screen

The other half of brief item 5: browsing the full catalog is never blocked, and a region you haven't shortlisted can be added from where you're standing.

**Files:**
- Create: `mobile/src/app/trip/[tripId]/explore.tsx`
- Modify: `mobile/src/app/trip/[tripId]/region/[regionId].tsx`

**Interfaces:**
- Consumes: `useRegions` (Task 4), `setRegionSelected` (Task 4), `RegionCard`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Build the explore screen**

Create `mobile/src/app/trip/[tripId]/explore.tsx`. It lists the regions not on the shortlist, each with an inline add control, and keeps the free-text "add your own region" escape hatch that used to live on the dashboard:

```tsx
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { RegionCard } from '@/components/region-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { setRegionSelected } from '@/lib/catalog';
import { addRegion, useExperiences, useRegions } from '@/lib/hooks';

export default function ExploreScreen() {
  const theme = useTheme();
  const { activeTripId } = useTrip();
  const { regions, unselectedRegions, loading, refetch } = useRegions(activeTripId);
  const { experiences } = useExperiences(activeTripId);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📍');
  const [submitting, setSubmitting] = useState(false);

  const placeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of experiences) counts.set(e.regionId, (counts.get(e.regionId) ?? 0) + 1);
    return counts;
  }, [experiences]);

  const openRegion = (regionId: string) => {
    if (!activeTripId) return;
    router.push({ pathname: '/trip/[tripId]/region/[regionId]', params: { tripId: activeTripId, regionId } });
  };

  const onAddOwn = async () => {
    if (!activeTripId || !newName.trim()) return;
    setSubmitting(true);
    await addRegion({ tripId: activeTripId, name: newName, icon: newIcon });
    await refetch();
    setSubmitting(false);
    setNewName('');
    setNewIcon('📍');
    setAdding(false);
  };

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={unselectedRegions}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            Everywhere else in Georgia. Browse and vote on any of it — adding a region to your trip just means it
            shows up on your dashboard and counts toward everyone&rsquo;s voting progress.
          </ThemedText>
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              {regions.length === 0
                ? "This trip has no regions yet — use “Add Georgia's places” on the dashboard."
                : "Every region is already on your trip."}
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RegionCard region={item} placeCount={placeCount.get(item.id) ?? 0} onPress={() => openRegion(item.id)} />
            <Pressable
              onPress={async () => {
                await setRegionSelected(item.id, true);
                await refetch();
              }}
              style={[styles.addButton, { borderColor: theme.accent }]}>
              <ThemedText type="small" themeColor="accent">
                + Add to our trip
              </ThemedText>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.cardWrap}>
            {adding ? (
              <View style={[styles.addForm, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Somewhere the guide doesn&rsquo;t cover yet
                </ThemedText>
                <View style={styles.addFormRow}>
                  <TextInput
                    value={newIcon}
                    onChangeText={setNewIcon}
                    style={[styles.iconInput, { color: theme.text, borderColor: theme.border }]}
                  />
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Region name"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <View style={styles.addFormActions}>
                  <Pressable onPress={() => setAdding(false)}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={onAddOwn}
                    disabled={submitting || !newName.trim()}
                    style={[styles.saveButton, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
                    <ThemedText type="small" style={styles.saveLabel}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setAdding(true)} style={[styles.ownButton, { borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  + Add your own region
                </ThemedText>
              </Pressable>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm },
  intro: { marginBottom: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  cardWrap: { marginBottom: Spacing.md, gap: Spacing.xs },
  addButton: { borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  ownButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  addForm: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  addFormRow: { flexDirection: 'row', gap: Spacing.sm },
  iconInput: { width: 56, borderWidth: 1, borderRadius: Radius.md, textAlign: 'center', fontSize: 20, paddingVertical: Spacing.sm },
  nameInput: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  addFormActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md },
  saveButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  saveLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
});
```

- [ ] **Step 2: Give the region screen its header content and an add toggle**

In `mobile/src/app/trip/[tripId]/region/[regionId].tsx`, wrap the root in `<Screen edges={['bottom']}>` (the native header handles the top), and replace the bare-subtitle `ListHeaderComponent` with the region's real content plus, when the region isn't shortlisted, a prompt to add it:

```tsx
        ListHeaderComponent={
          region ? (
            <View style={styles.regionHeader}>
              {!!region.subtitle && (
                <ThemedText type="default" themeColor="textSecondary">
                  {region.subtitle}
                </ThemedText>
              )}
              {!!region.summary && <ThemedText type="default">{region.summary}</ThemedText>}
              {!!region.whenToGo && <Fact label="When to go" value={region.whenToGo} />}
              {!!region.gettingThere && <Fact label="Getting there" value={region.gettingThere} />}
              {!!region.baseTowns && <Fact label="Where to stay" value={region.baseTowns} />}

              {!region.isSelected && (
                <Pressable
                  onPress={async () => {
                    await setRegionSelected(region.id, true);
                    await refetch();
                  }}
                  style={[styles.addBanner, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
                  <ThemedText type="small" themeColor="accent">
                    + Add {region.name} to our trip
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : null
        }
```

with a small local component in the same file:

```tsx
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}
```

and styles:

```tsx
  regionHeader: { gap: Spacing.sm, marginBottom: Spacing.md },
  fact: { gap: 2 },
  addBanner: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
```

Pull `refetch` out of `useRegions` and import `setRegionSelected` from `@/lib/catalog`, `Radius` from `@/constants/theme`, and `Pressable` from `react-native`.

- [ ] **Step 3: Typecheck, lint, test**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src
git commit -m "feat: Explore Georgia screen and richer region headers

Regions outside the trip's shortlist stay fully browsable and votable,
with add-to-trip available from both the explore list and the region
screen itself. Free-text region creation moves here from the dashboard."
git push origin main
```

---

### Task 8: Place detail page

The "information pages about each place". With hook, description, tips, best time, kid note and coordinates per place, the existing card cannot carry all of it *plus* voting, ratings, comments and notes and stay readable inside a `FlatList`. The card becomes a scannable summary; the page holds the detail.

**Files:**
- Create: `mobile/src/components/place-detail-sheet.tsx`
- Create: `mobile/src/app/trip/[tripId]/place/[placeId].tsx`
- Modify: `mobile/src/components/experience-card.tsx`

**Interfaces:**
- Consumes: `Experience` (Task 4), `Screen` (Task 1).
- Produces: `<PlaceDetailSheet experience={Experience} />` from `@/components/place-detail-sheet`.

- [ ] **Step 1: Build the detail block**

Create `mobile/src/components/place-detail-sheet.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Experience } from '@/lib/hooks';

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" style={styles.factIcon}>
        {icon}
      </ThemedText>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="small">{value}</ThemedText>
      </View>
    </View>
  );
}

export function PlaceDetailSheet({ experience }: { experience: Experience }) {
  const theme = useTheme();
  const price = experience.priceLari && experience.priceLari !== '—' ? experience.priceLari : null;

  return (
    <View style={styles.root}>
      {!!experience.hook && (
        <ThemedText type="default" style={styles.hook}>
          {experience.hook}
        </ThemedText>
      )}

      {!!experience.description && (
        <ThemedText type="default" themeColor="textSecondary">
          {experience.description}
        </ThemedText>
      )}

      {experience.tags.length > 0 && (
        <View style={styles.tagRow}>
          {experience.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      )}

      <View style={[styles.facts, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {experience.time !== '—' && <Fact icon="⏱" label="How long" value={experience.time} />}
        {!!price && <Fact icon="💰" label="Cost" value={price} />}
        {!!experience.nearestTown && <Fact icon="📍" label="Where" value={experience.nearestTown} />}
        {!!experience.bestTime && <Fact icon="🌤" label="Best time" value={experience.bestTime} />}
        {!!experience.kidNote && <Fact icon="🧒" label="With kids" value={experience.kidNote} />}
        {experience.bookingRequired && <Fact icon="📅" label="Booking" value="Book ahead — walk-ins are not reliable" />}
      </View>

      {!!experience.tips && (
        <View style={[styles.tips, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
          <ThemedText type="smallBold" themeColor="accent">
            Worth knowing
          </ThemedText>
          <ThemedText type="small">{experience.tips}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  hook: { fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  facts: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  fact: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  factIcon: { width: 20 },
  tips: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
});
```

- [ ] **Step 2: Build the place page**

Create `mobile/src/app/trip/[tripId]/place/[placeId].tsx`. It carries the detail block and everything interactive, so the card no longer has to:

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CommentBox } from '@/components/comment-box';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { PlaceNoteBox } from '@/components/place-note-box';
import { Screen } from '@/components/screen';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { VoteButtons } from '@/components/vote-buttons';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import {
  addComment,
  getAverageRating,
  getCommentsForExperience,
  getMemberRating,
  getMemberVote,
  getRatingsForExperience,
  getVoteCounts,
  upsertRating,
  upsertVote,
  useComments,
  useExperiences,
  useRatings,
  useVotes,
} from '@/lib/hooks';
import { blockMember, reportComment, useBlockedMemberIds } from '@/lib/moderation';
import { getPlaceNote, upsertPlaceNote, usePlaceNotes } from '@/lib/notes';

export default function PlaceScreen() {
  const { placeId } = useLocalSearchParams<{ tripId: string; placeId: string }>();
  const { activeTripId, activeMember } = useTrip();

  const { experiences, loading } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { ratings } = useRatings(activeTripId);
  const { comments } = useComments(activeTripId);
  const { notes: placeNotes } = usePlaceNotes(activeTripId);
  const { blockedIds } = useBlockedMemberIds(activeTripId, activeMember?.id ?? null);

  const experience = experiences.find((e) => e.id === placeId);

  if (!experience) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
          {loading ? 'Loading…' : "That place isn't part of this trip."}
        </ThemedText>
      </Screen>
    );
  }

  const memberId = activeMember?.id;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: experience.name }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">{experience.name}</ThemedText>

        <PlaceDetailSheet experience={experience} />

        {activeTripId && memberId && (
          <View style={styles.interactive}>
            <VoteButtons
              value={getMemberVote(votes, memberId, experience.id)}
              counts={getVoteCounts(votes, experience.id)}
              onChange={(vote) => upsertVote(activeTripId, memberId, experience.id, vote)}
            />

            <StarRating
              value={getMemberRating(ratings, memberId, experience.id)}
              average={getAverageRating(ratings, experience.id)}
              count={getRatingsForExperience(ratings, experience.id).length}
              onChange={(rating) => upsertRating(activeTripId, memberId, experience.id, rating)}
            />

            <CommentBox
              comments={getCommentsForExperience(comments, experience.id).filter((c) => !blockedIds.has(c.member_id))}
              myMemberId={memberId}
              onAdd={async (text) => {
                await addComment(activeTripId, memberId, experience.id, text);
              }}
              onReport={(commentId) => reportComment(activeTripId, commentId, memberId)}
              onBlock={(blockedMemberId) => blockMember(activeTripId, memberId, blockedMemberId)}
            />

            <PlaceNoteBox
              note={getPlaceNote(placeNotes, experience.id)}
              onSave={async (text) => {
                await upsertPlaceNote(activeTripId, memberId, experience.id, text);
              }}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.lg },
  interactive: { gap: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.xl, padding: Spacing.lg },
});
```

Check `useBlockedMemberIds`'s signature in `mobile/src/lib/moderation.ts` before wiring it — the existing card calls it as `useBlockedMemberIds(tripId, memberId)` with non-null arguments. If it doesn't accept nulls, guard the call the way the card does rather than changing its signature here.

- [ ] **Step 3: Slim the card down to a summary**

Rewrite `mobile/src/components/experience-card.tsx` as a pressable summary. It keeps the vote buttons — voting from the list is the app's core loop and shouldn't require a navigation — but ratings, comments and notes move to the page:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { VoteButtons } from '@/components/vote-buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getCommentsForExperience,
  getMemberVote,
  getVoteCounts,
  upsertVote,
  type Comment,
  type Experience,
  type Vote,
} from '@/lib/hooks';

export function ExperienceCard({
  experience,
  tripId,
  memberId,
  votes,
  comments,
  onPress,
}: {
  experience: Experience;
  tripId: string;
  memberId: string;
  votes: Vote[];
  comments: Comment[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const commentCount = getCommentsForExperience(comments, experience.id).length;
  const price = experience.priceLari && experience.priceLari !== '—' ? experience.priceLari : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="default" style={{ flex: 1 }}>
          {experience.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {experience.time}
        </ThemedText>
      </View>

      {!!(experience.hook || experience.description) && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {experience.hook || experience.description}
        </ThemedText>
      )}

      {experience.tags.length > 0 && (
        <View style={styles.tagRow}>
          {experience.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      )}

      <View style={styles.metaRow}>
        {/* price_lari already reads "Free" or "₾20 + boat", so it is not
            prefixed with a currency symbol here — the old card rendered
            "₾Free". */}
        <ThemedText type="small" themeColor="textMuted">
          {price ?? 'Free'}
        </ThemedText>
        {commentCount > 0 && (
          <ThemedText type="small" themeColor="textMuted">
            💬 {commentCount}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="accent" style={styles.more}>
          Details ›
        </ThemedText>
      </View>

      <VoteButtons
        value={getMemberVote(votes, memberId, experience.id)}
        counts={getVoteCounts(votes, experience.id)}
        onChange={(vote) => upsertVote(tripId, memberId, experience.id, vote)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  more: { marginLeft: 'auto' },
});
```

**Important:** the seed data must write `price_lari` values without a leading `₾` — the symbol belongs in the data (`'₾20'`, `'Free'`, `'₾20 + ₾15 boat'`), not prepended by the card. Task 9's schema states this; the old card's hardcoded `₾` prefix is what produced `₾Free`.

- [ ] **Step 4: Update the region screen's call site**

`ExperienceCard`'s props changed — `ratings`, `placeNotes` are gone and `onPress` is required. In `mobile/src/app/trip/[tripId]/region/[regionId].tsx`:

```tsx
              <ExperienceCard
                experience={item}
                tripId={activeTripId}
                memberId={activeMember.id}
                votes={votes}
                comments={comments}
                onPress={() =>
                  router.push({
                    pathname: '/trip/[tripId]/place/[placeId]',
                    params: { tripId: activeTripId, placeId: item.id },
                  })
                }
              />
```

Drop the now-unused `useRatings` / `usePlaceNotes` calls from that screen and import `router` from `expo-router`.

- [ ] **Step 5: Check for other call sites**

```bash
cd mobile && grep -rn "ExperienceCard" src/
```

Fix any other usage the same way.

- [ ] **Step 6: Typecheck, lint, test, then look at it**

```bash
cd mobile && npx tsc --noEmit && npm run lint && npm test
```

Run the app: a region's places show as summary cards with working vote buttons; tapping one opens a page with the full detail block and the rating, comments and notes below.

- [ ] **Step 7: Commit**

```bash
git add mobile/src
git commit -m "feat: per-place detail pages

Rich place content (hook, tips, best time, kid notes, location) cannot
share a FlatList row with voting, ratings, comments and notes. The card
becomes a scannable summary that keeps vote buttons and taps through to
a full page. Also fixes the card rendering a hardcoded currency prefix
that produced 'GEL-Free'."
git push origin main
```

---

## Content phase (Tasks 9–11)

The content is checked into the repo as JSON and compiled to SQL by a script, rather than hand-written as SQL. Three reasons: the JSON is reviewable in a diff where a 900-word narration change is legible and a `$guide$…$guide$` block is not; regenerating all ten SQL files after a schema tweak is one command; and a validator can enforce the field contract before anything reaches the database.

**The content contract.** Every `content/catalog/<region>.json` file matches this shape exactly. Tasks 9, 10 and 11 all key off it.

```jsonc
{
  "region": {
    "id": "tbilisi",              // MUST be one of the ten frozen slugs from Task 3
    "name": "Tbilisi",
    "icon": "🏙️",
    "subtitle": "City, views, sulfur baths",   // <= 40 chars, fits a card
    "summary": "…",               // 2–4 sentences: what this region is and why you'd go
    "when_to_go": "…",            // season + time-of-day guidance, heat especially
    "getting_there": "…",         // from Tbilisi: how, how long, road quality
    "base_towns": "…",            // where you'd actually sleep
    "sort_order": 1
  },
  "places": [
    {
      "id": "tbilisi-narikala",   // lowercase kebab, prefixed with the region slug, globally unique, FROZEN once shipped
      "name": "Narikala Fortress & Cable Car",
      "hook": "…",                // ONE sentence, <= 120 chars, the reason to go
      "description": "…",         // 3–5 sentences: what you actually do and see
      "tips": "…",                // practical only: closing days, cash, queues, weather, scams. null if genuinely none
      "best_time": "…",           // e.g. "Before 11am, or golden hour" / "Apr–Oct". null if it truly doesn't matter
      "duration_min": 45,         // integer minutes, realistic including queueing
      "time_needed": "45 min",    // the human display string; must agree with duration_min
      "price_gel_min": 5,         // integer GEL. BOTH null means free
      "price_gel_max": 5,
      "price_lari": "₾2.50 each way",  // display string. Include the ₾ symbol HERE — the card does not add one. Use "Free" when free.
      "nearest_town": "Tbilisi",
      "lat": 41.688000,           // 6dp, verified against the actual site not the town centre
      "lng": 44.809000,
      "kid_note": "…",            // null if nothing specific to say
      "booking_required": false,
      "tags": ["scenic", "kids"], // ONLY from: cool kids wine scenic water cave walk hike thrill evening
      "sort_order": 3,
      "guide_script": "…"         // Task 10 fills this; null after Task 9
    }
  ]
}
```

Hard rules the validator enforces (Task 11, Step 1):

- `region.id` is one of the ten frozen slugs
- every `places[].id` starts with the region slug, is unique across **all ten files**, and matches `^[a-z0-9-]+$`
- every tag is in the ten-tag vocabulary from `mobile/src/constants/tags.ts`
- `duration_min` is a positive integer
- `price_gel_min <= price_gel_max` when both are present; both null iff `price_lari` is `"Free"`
- `lat` is within 41.0–43.6 and `lng` within 40.0–46.7 (Georgia's bounding box) — this catches a transposed pair or a wrong hemisphere, which is otherwise invisible until a map renders
- `guide_script` is 900–1400 words (Task 10 onward)
- no string contains the literal `$guide$`

---

### Task 9: Research the ten regions

Brief item 4. Produces the structured fields for ~113 places. `guide_script` stays null; Task 10 fills it.

**Files:**
- Create: `content/catalog/tbilisi.json`, `mtskheta.json`, `kakheti.json`, `gudauri-kazbegi.json`, `borjomi-bakuriani.json`, `samtskhe-javakheti.json`, `shida-kartli.json`, `kutaisi-imereti.json`, `svaneti.json`, `batumi-adjara.json`

**Interfaces:**
- Consumes: the region slugs frozen in Task 3; the tag vocabulary in `mobile/src/constants/tags.ts`; the existing research in `src/lib/data.js` (`REGIONS`, `EXPERIENCES`) and `docs/collected-trip-data.md` as *starting material only*.
- Produces: ten JSON files matching the contract above, `guide_script: null` throughout.

**Place targets:** tbilisi 12, mtskheta 10, kakheti 12, gudauri-kazbegi 12, borjomi-bakuriani 11, samtskhe-javakheti 10, shida-kartli 10, kutaisi-imereti 12, svaneti 12, batumi-adjara 12. Total 113.

- [ ] **Step 1: Run the research fan-out**

Ten independent regions with no shared state — one agent each. Use the `Workflow` tool (the session's `/effort ultracode` setting authorises it; if running without that, dispatch ten agents via `superpowers:dispatching-parallel-agents` instead).

Each agent's brief:

> You are researching the **{region.name}** region of Georgia (the country) for a trip-planning app. Produce exactly **{N} places** as JSON matching the contract in `docs/superpowers/plans/2026-08-23-georgia-catalog.md`.
>
> Starting material — treat as a draft to verify and improve, never as ground truth:
> - `src/lib/data.js` (`REGIONS`, `EXPERIENCES`) — the existing entries for `{region.id}`, if any
> - `docs/collected-trip-data.md`
>
> **Cross-check every factual claim against the current web.** The existing copy dates from mid-2026 and is uneven. Specifically verify and correct: prices in GEL (they drift), opening hours and closing days (many Georgian sites close Mondays), whether a site is currently open at all or under renovation, and seasonal access (several mountain roads close in winter). Where the old copy is thin, stale or wrong, replace it — do not port it faithfully.
>
> **Coordinates must be for the site itself**, not the town it's near. A wrong `lat`/`lng` is invisible until it renders on a map, so check each one.
>
> Aim for a genuinely useful mix, not twelve variations on one thing: the unmissable sites, one or two things most visitors miss, somewhere to eat that is a destination rather than a refuel, and at least one option that works in bad weather. Prices, durations and kid notes should be honest — "2 hours" that is really 4 makes the whole app untrustworthy.
>
> Return only the JSON object. `guide_script` must be `null` for every place.

- [ ] **Step 2: Write the ten files**

Write each agent's result to `content/catalog/<region-id>.json`, pretty-printed with 2-space indent so diffs stay readable.

- [ ] **Step 3: Sanity-check the totals**

```bash
cd "C:/Aadit/Personal/code-ide/vs-code/trip" && node -e "
const fs=require('fs');
let total=0; const ids=new Set(); let dupes=0;
for (const f of fs.readdirSync('content/catalog')) {
  const j=JSON.parse(fs.readFileSync('content/catalog/'+f,'utf8'));
  console.log(j.region.id.padEnd(20), j.places.length);
  total+=j.places.length;
  for (const p of j.places) { if (ids.has(p.id)) { console.log('  DUPLICATE ID', p.id); dupes++; } ids.add(p.id); }
}
console.log('total', total, 'duplicate ids', dupes);
"
```

Expected: ten rows summing to 113, zero duplicate ids.

- [ ] **Step 4: Commit**

```bash
git add content/catalog
git commit -m "content: research 10 Georgia regions, 113 places

Ports and substantially expands src/lib/data.js: Batumi/Adjara and
Samtskhe-Javakheti (Vardzia, Rabati) are new, Uplistsikhe is promoted
from a 2-place stub into a full Shida Kartli region, and every thin
region is brought up to comparable depth. Prices, closing days and
coordinates re-verified rather than ported."
git push origin main
```

---

### Task 10: Write the guide scripts

Produces a 5–10 minute tour-guide narration for every place. These are the scripts the future TTS pipeline reads — see `docs/roadmap/audio-guides.md`.

**Files:**
- Modify: all ten `content/catalog/<region>.json` (fill `guide_script`)

**Interfaces:**
- Consumes: Task 9's structured fields as the factual base.
- Produces: `guide_script` on all 113 places, 900–1400 words each.

- [ ] **Step 1: Fan out over places, not regions**

~113 scripts at ~1,100 words each is ~124,000 words. One agent per region would mean ~13,000 words in a single response, where quality visibly degrades toward the end. Pipeline over places in **chunks of three** instead — roughly 38 agents, each writing ~3,300 words with the full region context in front of it.

Each agent receives: the region's `summary`, `when_to_go`, `getting_there`, `base_towns`; the names of all places in that region (so it can cross-reference without repeating); and the complete structured record for its own three places.

Agent brief:

> Write the tour-guide narration for these three places in **{region.name}**, Georgia. Each script is read aloud by a voice guide to someone standing at the place, so it must run **900–1400 words** (5–10 minutes spoken).
>
> Voice: a Georgian local who knows the history properly but talks like a friend walking beside you, not a museum placard. Second person. Present tense for what they can see right now, past tense for what happened here.
>
> Structure each script as: (1) arrival — what they're looking at, plus one sensory detail; (2) origin — when, who, why, and what was happening in Georgia at the time; (3) the story — the one thing about this place genuinely worth telling; (4) look for this — two or three specific details most visitors walk straight past; (5) before you go — a practical closing note and where this sits in the wider region.
>
> Rules:
> - Specific over sweeping. "The 1783 treaty signed in that room" beats "centuries of history".
> - Exactly one genuine surprise per script — something a well-read visitor wouldn't already know.
> - No superlative stacking. Never "nestled", "hidden gem", "steeped in history", "must-see".
> - Write it to be **spoken**: short sentences, no parentheses, no bulleted lists, no headings, no stage directions. Plain prose only.
> - Spell out numbers and dates as they should be read: "eleven hundred", "the fourth century".
> - Georgian proper nouns will be run through TTS — use them, but introduce each one naturally the first time so a listener can follow.
> - Never contradict the structured record's prices, durations or closing days.
>
> Return JSON: `{"scripts": [{"id": "<place id>", "guide_script": "..."}]}`.

- [ ] **Step 2: Merge the scripts into the JSON files**

Match on `id` and set `guide_script`. Fail loudly on any id that doesn't match a known place rather than silently dropping it.

- [ ] **Step 3: Check word counts and coverage**

```bash
cd "C:/Aadit/Personal/code-ide/vs-code/trip" && node -e "
const fs=require('fs');
let n=0, words=0, bad=[];
for (const f of fs.readdirSync('content/catalog')) {
  for (const p of JSON.parse(fs.readFileSync('content/catalog/'+f,'utf8')).places) {
    n++;
    const w = p.guide_script ? p.guide_script.trim().split(/\s+/).length : 0;
    words += w;
    if (w < 900 || w > 1400) bad.push(p.id + ' = ' + w);
  }
}
console.log('places', n, 'total words', words, 'avg', Math.round(words/n));
console.log(bad.length ? 'OUT OF RANGE:\n' + bad.join('\n') : 'all scripts in range');
"
```

Expected: 113 places, ~124,000 words, nothing out of range. Re-run the relevant agents for any that are.

- [ ] **Step 4: Spot-check three scripts by reading them aloud**

Pick one marquee site, one small site, and one where the region's material is thinnest. Read each aloud and check it takes 5–10 minutes, that nothing trips the tongue, and that it doesn't slip into brochure voice. This is the only quality gate that catches tone drift; the word count won't.

- [ ] **Step 5: Commit**

```bash
git add content/catalog
git commit -m "content: 5-10 minute guide scripts for all 113 places

Narration written to a single consistent persona; these are the scripts
the TTS pipeline will read (docs/roadmap/audio-guides.md)."
git push origin main
```

---

### Task 11: Compile the seed SQL and verify end to end

**Files:**
- Create: `scripts/build-catalog-sql.mjs`
- Create: `supabase/migration-10-catalog-<region>.sql` × 10 (generated)

**Interfaces:**
- Consumes: `content/catalog/*.json`, the `catalog_places` schema from Task 3.
- Produces: ten paste-ready SQL files.

- [ ] **Step 1: Write the generator with the validator built in**

Create `scripts/build-catalog-sql.mjs`. Node, no dependencies, deterministic output (stable key order, no timestamps) so re-running produces a zero-diff when the content hasn't changed:

```js
// Generates supabase/migration-10-catalog-<region>.sql from
// content/catalog/*.json. Run: node scripts/build-catalog-sql.mjs
//
// The JSON is the source of truth; the SQL is a build artefact that happens
// to be committed so the user can paste it into the Supabase SQL Editor.
// Never hand-edit the generated files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'content/catalog';
const OUT_DIR = 'supabase';

const REGION_SLUGS = new Set([
  'tbilisi', 'mtskheta', 'kakheti', 'gudauri-kazbegi', 'borjomi-bakuriani',
  'samtskhe-javakheti', 'shida-kartli', 'kutaisi-imereti', 'svaneti', 'batumi-adjara',
]);

const TAGS = new Set([
  'cool', 'kids', 'wine', 'scenic', 'water', 'cave', 'walk', 'hike', 'thrill', 'evening',
]);

// Georgia's bounding box, generously padded. Catches transposed or
// wrong-hemisphere coordinates, which are otherwise invisible until a map
// renders them in the Indian Ocean.
const BOUNDS = { latMin: 41.0, latMax: 43.6, lngMin: 40.0, lngMax: 46.7 };

const errors = [];
const seenIds = new Set();

/** Single-quoted SQL literal, or NULL. */
function sql(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Dollar-quoted, for the long narration bodies. */
function sqlLong(value) {
  if (!value) return 'NULL';
  if (value.includes('$guide$')) throw new Error('script contains the dollar-quote tag');
  return `$guide$${value}$guide$`;
}

function num(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

function bool(value) {
  return value ? 'true' : 'false';
}

function tagArray(tags) {
  if (!tags || tags.length === 0) return `'{}'::TEXT[]`;
  return `ARRAY[${tags.map(sql).join(', ')}]::TEXT[]`;
}

function wordCount(text) {
  return text ? text.trim().split(/\s+/).length : 0;
}

function validate(regionId, place) {
  const where = `${regionId}/${place.id}`;
  if (!/^[a-z0-9-]+$/.test(place.id)) errors.push(`${where}: id is not lowercase kebab-case`);
  if (!place.id.startsWith(regionId)) errors.push(`${where}: id is not prefixed with its region slug`);
  if (seenIds.has(place.id)) errors.push(`${where}: duplicate id`);
  seenIds.add(place.id);

  for (const tag of place.tags ?? []) {
    if (!TAGS.has(tag)) errors.push(`${where}: unknown tag "${tag}"`);
  }

  if (!Number.isInteger(place.duration_min) || place.duration_min <= 0) {
    errors.push(`${where}: duration_min must be a positive integer`);
  }

  const { price_gel_min: lo, price_gel_max: hi } = place;
  if (lo != null && hi != null && lo > hi) errors.push(`${where}: price_gel_min exceeds price_gel_max`);
  const isFree = lo == null && hi == null;
  if (isFree !== (place.price_lari === 'Free')) {
    errors.push(`${where}: price_lari "${place.price_lari}" disagrees with the numeric price being ${isFree ? 'absent' : 'present'}`);
  }

  if (place.lat != null && (place.lat < BOUNDS.latMin || place.lat > BOUNDS.latMax)) {
    errors.push(`${where}: lat ${place.lat} is outside Georgia`);
  }
  if (place.lng != null && (place.lng < BOUNDS.lngMin || place.lng > BOUNDS.lngMax)) {
    errors.push(`${where}: lng ${place.lng} is outside Georgia`);
  }

  const words = wordCount(place.guide_script);
  if (words > 0 && (words < 900 || words > 1400)) {
    errors.push(`${where}: guide_script is ${words} words, expected 900-1400`);
  }
}

let totalPlaces = 0;
let totalWords = 0;

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));
  const { region, places } = doc;

  if (!REGION_SLUGS.has(region.id)) {
    errors.push(`${file}: "${region.id}" is not one of the ten frozen region slugs`);
  }

  const rows = [];
  for (const place of places) {
    validate(region.id, place);
    totalPlaces++;
    totalWords += wordCount(place.guide_script);
    rows.push(
      `  (${sql(place.id)}, ${sql(region.id)}, ${sql(place.name)}, ${sql(place.hook)}, ` +
        `${sql(place.description)}, ${sql(place.tips)}, ${sql(place.best_time)}, ` +
        `${num(place.duration_min)}, ${sql(place.time_needed)}, ` +
        `${num(place.price_gel_min)}, ${num(place.price_gel_max)}, ${sql(place.price_lari)}, ` +
        `${sql(place.nearest_town)}, ${num(place.lat)}, ${num(place.lng)}, ` +
        `${sql(place.kid_note)}, ${bool(place.booking_required)}, ${tagArray(place.tags)}, ` +
        `${num(place.sort_order)}, ${sqlLong(place.guide_script)}, ${num(wordCount(place.guide_script) || null)})`
    );
  }

  const out = `-- Migration 10 — Georgia catalog places: ${region.name}
--
-- GENERATED FILE. Source of truth is content/catalog/${region.id}.json.
-- Regenerate with: node scripts/build-catalog-sql.mjs
-- Do not hand-edit — your changes will be overwritten.
--
-- Run in Supabase Dashboard > SQL Editor after migration-09. Idempotent:
-- re-running is a no-op, and it will not overwrite an edited row.

UPDATE catalog_regions SET
  subtitle      = ${sql(region.subtitle)},
  summary       = ${sql(region.summary)},
  when_to_go    = ${sql(region.when_to_go)},
  getting_there = ${sql(region.getting_there)},
  base_towns    = ${sql(region.base_towns)}
WHERE id = ${sql(region.id)};

INSERT INTO catalog_places (
  id, region_id, name, hook, description, tips, best_time,
  duration_min, time_needed, price_gel_min, price_gel_max, price_lari,
  nearest_town, lat, lng, kid_note, booking_required, tags, sort_order,
  guide_script, guide_script_words
) VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- Expect ${places.length}.
SELECT count(*) AS ${region.id.replace(/-/g, '_')}_places
  FROM catalog_places WHERE region_id = ${sql(region.id)};
`;

  writeFileSync(join(OUT_DIR, `migration-10-catalog-${region.id}.sql`), out);
  console.log(`${region.id.padEnd(20)} ${String(places.length).padStart(3)} places`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

console.log(`\n${totalPlaces} places, ${totalWords.toLocaleString()} script words. OK.`);
```

- [ ] **Step 2: Run it**

```bash
cd "C:/Aadit/Personal/code-ide/vs-code/trip" && node scripts/build-catalog-sql.mjs
```

Expected: ten lines summing to 113, then `113 places, ~124,000 script words. OK.` A non-zero exit means a validation error — fix the JSON, not the SQL.

- [ ] **Step 3: Confirm it is deterministic**

```bash
cd "C:/Aadit/Personal/code-ide/vs-code/trip" && node scripts/build-catalog-sql.mjs && git diff --stat supabase/
```

Expected: no diff on the second run.

- [ ] **Step 4: Check the generated SQL by eye**

Open one small file and confirm: the `INSERT` column list matches `catalog_places` exactly and in order; apostrophes inside prose are doubled (`'Georgia''s'`); every `guide_script` is wrapped in `$guide$…$guide$`; the file ends with `ON CONFLICT (id) DO NOTHING;` and its count query.

- [ ] **Step 5: Hand the ten files to the user**

> `supabase/migration-10-catalog-*.sql` are ready — ten files, run them in the SQL Editor in any order after migration-09. Each ends with a count query; the ten should sum to 113.

- [ ] **Step 6: Full end-to-end verification once they are loaded**

With migration-09 and all ten migration-10 files run, create a fresh trip through the wizard picking two regions, then check:

```sql
-- Expect 10 regions, 2 of them selected, and 113 places.
SELECT
  (SELECT count(*) FROM regions     WHERE trip_id = '<new trip id>')                    AS regions,
  (SELECT count(*) FROM regions     WHERE trip_id = '<new trip id>' AND is_selected)    AS selected,
  (SELECT count(*) FROM experiences WHERE trip_id = '<new trip id>')                    AS places;

-- Expect 0 — every seeded row must carry its backlink.
SELECT count(*) FROM experiences WHERE trip_id = '<new trip id>' AND catalog_place_id IS NULL;

-- Re-run seeding; expect 0 inserted and the counts above unchanged.
SELECT seed_trip_catalog('<new trip id>', NULL);
```

In the app, confirm: the dashboard shows exactly the two shortlisted regions with place counts, voting progress reads over those regions' places only, Explore lists the other eight, a place page shows hook/tips/best time/location, adding a region from Explore moves it to the dashboard, and the calendar unlocks after voting on the shortlist rather than demanding all 113.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-catalog-sql.mjs supabase/migration-10-catalog-*.sql
git commit -m "feat(db): generate catalog seed SQL from the content JSON

content/catalog/*.json is the source of truth; the generator validates
ids, tags, prices, coordinates against Georgia's bounding box, and
script word counts before emitting ten paste-ready migration files."
git push origin main
```

---

## Done when

- [ ] All 11 headerless screens clear the notch on a device with one
- [ ] Trip creation is name → date range → region pick, with no destination field anywhere
- [ ] A new trip has 10 regions and 113 places without anyone adding one by hand
- [ ] The dashboard separates the shortlist from Explore, and progress counts only the shortlist
- [ ] Nothing outside the shortlist is blocked — every place is browsable and votable
- [ ] The calendar unlocks on the shortlist, not on all 113 places
- [ ] Every place has a detail page with its practical fields
- [ ] `npx tsc --noEmit`, `npm run lint` and `npm test` are all clean in `mobile/`
- [ ] `node scripts/build-catalog-sql.mjs` exits 0 and produces no diff on a second run

## Self-review notes

Checked against the spec:

- **Spec coverage.** Every section maps to a task: data model → Task 3; server functions → Task 3; app data layer → Task 4; the nine screen/component rows in the spec's UI table → Tasks 1, 2, 5, 6, 7, 8; safe area → Task 1; content → Tasks 9–11; testing → the verification steps in each task plus the Done-when list. The spec's "existing trips untouched + manual import" decision is Task 6, Step 2 (`needsCatalog`). The audio-guide columns are Task 3, and the scripts that fill them are Task 10.
- **Type consistency.** `Region.isSelected`, `Experience.durationMin`, `experiencesInSelectedRegions`, `RegionOption`, `CatalogRegion`, `seedTripCatalog`, `setRegionSelected`, `createGeorgiaTrip` and `PlaceDetailSheet` are each defined once (Tasks 4, 5, 8) and referenced with the same names and shapes afterwards. `parseDefaultDuration` changes arity in Task 4 and both call sites are updated in the same task. `ExperienceCard`'s props change in Task 8 and its only call site is updated in the same task.
- **Known ordering constraint.** Task 5's Step 5 and Task 11's Step 6 are the only steps that require migration-09 to have already been run by the user. Tasks 1, 2, 4, 9 and 10 have no such dependency.
- **Deliberately not covered.** The TTS pipeline, audio player and offline download (`docs/roadmap/audio-guides.md`); the AI planner and pricing (`docs/roadmap/ai-planner-and-pricing.md`); EAS build and store submission; the legacy Next.js app at the repo root.
