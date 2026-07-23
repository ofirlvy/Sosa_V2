import { defineConfig } from 'vitest/config';

// Vitest runs in Node against node_modules (entirely separate from the browser's
// esm.sh importmap). Pure invariant tests only — node environment, no jsdom.
// Dummy VITE_SUPABASE_* env so importing modules that transitively load
// services/supabase.ts (which calls createClient at import) doesn't throw.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
