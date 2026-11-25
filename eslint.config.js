const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/features/call/livekit.ts', 'src/features/discovery/kt/Artifact.tsx', 'index.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value='livekit-client']",
          message: "require('livekit-client') bundles a second (UMD) copy of livekit-client; import it from src/features/call/liveKitClient instead.",
        },
        {
          selector: "JSXOpeningElement[name.name=/^(FlatList|SectionList|FlashList|ScrollView)$/] > JSXAttribute[name.name='onRefresh']",
          message: 'Pass refreshControl={<Refresh />} from src/ui/Refresh: its offset keeps the Android pull indicator whole inside the list.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/Refresh.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['RefreshControl'],
              message: 'Use Refresh from src/ui/Refresh: its offset keeps the Android pull indicator whole inside the list.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...i18next.configs['flat/recommended'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { include: ['label', 'title', 'detail', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'hint'] },
        },
      ],
    },
  },
]);
