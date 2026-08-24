// lib/supabase.ts reads process.env.EXPO_PUBLIC_* at module scope and
// throws if they're unset. Jest sets NODE_ENV=test, and @expo/env
// deliberately excludes .env.local for the "test" mode ("you expect tests
// to produce the same results for everyone") -- so there's no file for it
// to load here even in the real app's flow, and any test that requires a
// lib/ module transitively importing lib/supabase.ts (access.ts,
// itinerary.ts, hooks.ts, catalog.ts, ...) would otherwise crash before a
// single assertion runs. These are inert stubs, not real credentials --
// nothing in these tests makes a network call.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

// lib/supabase.ts also imports @react-native-async-storage/async-storage at
// module scope, which crashes under Jest ("NativeModule: AsyncStorage is
// null") because there's no native module to link against in the test
// environment. Any test that imports a lib/ module transitively pulling in
// lib/supabase.ts (access.ts, itinerary.ts, hooks.ts, catalog.ts, ...) hits
// this, so it's mocked globally rather than per-test. Per the package's own
// Jest guide: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest/
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
