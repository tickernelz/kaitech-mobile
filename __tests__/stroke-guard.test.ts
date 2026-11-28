import { Linter } from 'eslint';

const config = (require('../eslint.config.js') as Linter.Config[]).filter((entry) => !entry.plugins?.i18next);
const linter = new Linter({ configType: 'flat', cwd: process.cwd() });

async function flagged(code: string): Promise<string[]> {
  return linter
    .verify(code, config, 'src/features/probe.tsx')
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

const header = "import { StyleSheet } from 'react-native';\nimport { radius, stroke } from '../theme';\n";

describe('line width guard', () => {
  test('a one-pixel line on a rounded style fails lint, inline or behind a condition', async () => {
    expect(await flagged(`${header}export const styles = StyleSheet.create({ chip: { borderRadius: radius.pill, borderWidth: stroke.hairline } });\n`)).toHaveLength(1);
    expect(await flagged(`${header}export const edge = (on: boolean) => ({ borderTopLeftRadius: 8, borderWidth: on ? stroke.hairline : 0 });\n`)).toHaveLength(1);
  });

  test('the raw StyleSheet hairline fails lint anywhere outside the theme', async () => {
    expect(await flagged(`${header}export const styles = StyleSheet.create({ rule: { borderBottomWidth: StyleSheet.hairlineWidth } });\n`)).toHaveLength(1);
  });

  test('a straight divider keeps the hairline and a rounded edge takes the thin stroke', async () => {
    expect(await flagged(`${header}export const styles = StyleSheet.create({ rule: { borderBottomWidth: stroke.hairline }, chip: { borderRadius: radius.pill, borderWidth: stroke.thin }, glow: { shadowRadius: 4, borderTopWidth: stroke.hairline } });\n`)).toEqual([]);
  });
});
