import { Linter } from 'eslint';

jest.mock('../lint/design-exceptions', () => ({ 'src/features/probe.tsx': { spacing: [5], colour: ['#123456'] } }));

const config = (require('../eslint.config.js') as Linter.Config[]).filter((entry) => !entry.plugins?.i18next);
const linter = new Linter({ configType: 'flat', cwd: process.cwd() });

const header = "import { StyleSheet } from 'react-native';\nimport { Pressable } from '../ui/Pressable';\nimport { Icon } from '../ui/icons';\nimport { radius, space } from '../theme';\n";

function flagged(code: string, file = 'src/features/other.tsx'): string[] {
  return linter
    .verify(header + code, config, file)
    .filter((message) => message.ruleId?.startsWith('design/') || message.ruleId === 'no-restricted-imports')
    .map((message) => message.ruleId + ' ' + message.message);
}

describe('design guard', () => {
  test.each([
    ['spacing literal on the scale', 'export const s = StyleSheet.create({ a: { padding: 8 } });', 'design/spacing'],
    ['spacing off the scale', 'export const s = StyleSheet.create({ a: { marginTop: -5 } });', 'design/spacing'],
    ['radius off the scale', 'export const s = StyleSheet.create({ a: { width: 20, borderTopLeftRadius: 5 } });', 'design/radius'],
    ['fontSize off the scale', 'export const s = StyleSheet.create({ a: { fontSize: 10 } });', 'design/font-size'],
    ['lineHeight off the scale', 'export const s = StyleSheet.create({ a: { fontSize: 28, lineHeight: 72 } });', 'design/line-height'],
    ['elevation off the levels', 'export const s = StyleSheet.create({ a: { elevation: 40 } });', 'design/elevation'],
    ['duration off the motion scale', 'export const timing = { duration: 70 };', 'design/duration'],
    ['hex colour', "export const s = StyleSheet.create({ a: { color: '#7955A0' } });", 'design/colour'],
    ['rgba colour in a template', 'export const shade = `rgba(0, 0, 0, 0.4)`;', 'design/colour'],
    ['Icon size off the optical sizes', 'export const A = () => <Icon name="chat" color="red" size={18} />;', 'design/icon-size'],
    [
      'square ripple on a rounded sheet style',
      "export const A = () => <Pressable android_ripple={{ color: 'red', foreground: true }} style={({ pressed }) => [s.pill, pressed && s.on]} />;\nconst s = StyleSheet.create({ pill: { borderRadius: radius.pill }, on: { opacity: 0.8 } });",
      'design/ripple',
    ],
    ['Pressable from react-native', "import { Pressable as Raw } from 'react-native';\nexport const A = () => <Raw />;", 'no-restricted-imports'],
  ])('%s fails lint', (_name, code, rule) => {
    const messages = flagged(code);
    expect(messages).toHaveLength(1);
    expect(messages[0].startsWith(rule + ' ')).toBe(true);
  });

  test('tokens, optical nudges, half-size radii and bounded or clipped ripples pass', () => {
    const code = [
      'export const s = StyleSheet.create({',
      '  a: { padding: space.md, margin: 2, gap: 0, fontSize: 16, lineHeight: 24, elevation: 3, borderRadius: radius.card },',
      '  dot: { width: 10, height: 10, borderRadius: 5 },',
      '  title: { fontSize: 32, lineHeight: 40 },',
      "  clip: { borderRadius: radius.pill, overflow: 'hidden' },",
      '  row: { paddingHorizontal: space.lg },',
      '});',
      "export const A = () => <><Icon name=\"chat\" color=\"red\" size={24} /><Pressable android_ripple={{ color: 'red', foreground: true }} style={s.clip} /><Pressable android_ripple={{ color: 'red', radius: 20 }} style={s.dot} /><Pressable android_ripple={{ color: 'red', borderless: true }} style={s.dot} /><Pressable android_ripple={{ color: 'red' }} style={s.row} /><Pressable style={s.dot} /></>;",
    ].join('\n');
    expect(flagged(code)).toEqual([]);
  });

  test('a file exception covers only its listed values and fails once a value is gone', () => {
    expect(flagged("export const s = StyleSheet.create({ a: { padding: 5, color: '#123456' } });", 'src/features/probe.tsx')).toEqual([]);
    expect(flagged("export const s = StyleSheet.create({ a: { padding: 5, margin: 5, color: '#123456' } });", 'src/features/probe.tsx')).toEqual([
      'design/spacing Spacing literal 5 is off the spacing scale: use space.* from src/theme.',
    ]);
    expect(flagged('export const s = StyleSheet.create({ a: { padding: 5 } });', 'src/features/probe.tsx')).toEqual([
      'design/colour The exception #123456 for design/colour no longer matches this file: remove it from lint/design-exceptions.js.',
    ]);
  });

  test('the theme and wallpaper content keep their literals', () => {
    expect(flagged("export const tint = '#7955A0';", 'src/theme/extra.ts')).toEqual([]);
    expect(flagged("export const tint = '#7955A0';", 'src/features/appearance/wallpapers/presets.ts')).toEqual([]);
  });
});
