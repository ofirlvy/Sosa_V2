import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Flat config (ESLint 9). Tuned for a codebase that was never linted before:
// correctness-leaning rules stay on; deliberately-dynamic patterns (e.g. the
// `content: any` card model) are relaxed to `off`/`warn` so the baseline is green
// without churning working code. `npm run verify` runs typecheck first, then this.
export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'dist',
      'supabase',
      'migrated_prompt_history',
      'extract-svg.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      // The card content model is intentionally dynamic JSON (see CLAUDE.md §4):
      // `onUpdateContent(id, content: any)` etc. `any` is a deliberate choice here.
      '@typescript-eslint/no-explicit-any': 'off',
      // Surface, don't fail, on unused symbols; ignore underscore-prefixed args.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Config files run in Node and don't need browser globals.
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
