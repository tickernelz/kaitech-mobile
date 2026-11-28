const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

const systemUi = [
  { importNames: ['RefreshControl'], message: 'Use Refresh from src/ui/Refresh: its offset keeps the Android pull indicator whole inside the list.', owner: 'src/ui/Refresh.tsx' },
  { importNames: ['Alert'], message: 'Use confirm, inform, choose, prompt or notify from src/ui/dialog: they draw the Kaitech dialog and snackbar instead of the system alert.' },
  { importNames: ['ActionSheetIOS'], message: 'Use ActionSheet from src/ui/ActionSheet or choose from src/ui/dialog instead of the system action sheet.' },
  { importNames: ['ToastAndroid'], message: 'Use notify from src/ui/dialog instead of the system toast.' },
  { importNames: ['Modal'], message: 'Use Overlay from src/ui/Overlay: it carries the dialog layer, so a dialog opened inside shows above it on iOS.', owner: ['src/ui/Overlay.tsx', 'src/ui/Dialog.tsx'] },
];

const restrictedSyntax = [
  {
    selector: "CallExpression[callee.name='require'][arguments.0.value='livekit-client']",
    message: "require('livekit-client') bundles a second (UMD) copy of livekit-client; import it from src/features/call/liveKitClient instead.",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(FlatList|SectionList|FlashList|ScrollView)$/] > JSXAttribute[name.name='onRefresh']",
    message: 'Pass refreshControl={<Refresh />} from src/ui/Refresh: its offset keeps the Android pull indicator whole inside the list.',
  },
];

const strokeSyntax = [
  {
    selector: "MemberExpression[object.name='StyleSheet'][property.name='hairlineWidth']",
    message: 'Use stroke from src/theme: stroke.thin for any edge with a border radius, stroke.hairline only for a straight divider.',
  },
  {
    selector: "ObjectExpression:has(> Property[key.name=/^border\\w*Radius$/]) > Property MemberExpression[object.name='stroke'][property.name='hairline']",
    message: 'A one-pixel line breaks up along a curve on Android; use stroke.thin on a style with a border radius.',
  },
];

const ownersOf = (entry) => [entry.owner ?? []].flat();

const restrictSystemUi = (file) => ({
  'no-restricted-imports': [
    'error',
    {
      paths: systemUi
        .filter((entry) => !ownersOf(entry).includes(file))
        .map(({ importNames, message }) => ({ name: 'react-native', importNames, message })),
    },
  ],
});

const systemUiOwners = [...new Set(systemUi.flatMap(ownersOf))];

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
      'no-restricted-syntax': ['error', ...restrictedSyntax, ...strokeSyntax],
    },
  },
  {
    files: ['src/theme/tokens.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...restrictedSyntax],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: systemUiOwners,
    rules: restrictSystemUi(null),
  },
  ...systemUiOwners.map((file) => ({ files: [file], rules: restrictSystemUi(file) })),
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
