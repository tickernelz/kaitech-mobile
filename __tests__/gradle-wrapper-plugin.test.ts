import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExpoConfig } from 'expo/config';

const withGradleWrapper = require('../plugins/with-gradle-wrapper');
const { gradle, pinWrapper } = withGradleWrapper;

const template = [
  'distributionBase=GRADLE_USER_HOME',
  'distributionPath=wrapper/dists',
  'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip',
  'networkTimeout=10000',
  'validateDistributionUrl=true',
  'zipStoreBase=GRADLE_USER_HOME',
  'zipStorePath=wrapper/dists',
  '',
].join('\n');

const pinned = [
  'distributionBase=GRADLE_USER_HOME',
  'distributionPath=wrapper/dists',
  `distributionUrl=https\\://services.gradle.org/distributions/gradle-${gradle.version}-bin.zip`,
  `distributionSha256Sum=${gradle.sha256}`,
  'networkTimeout=10000',
  'validateDistributionUrl=true',
  'zipStoreBase=GRADLE_USER_HOME',
  'zipStorePath=wrapper/dists',
  '',
].join('\n');

async function prebuildMod(androidDir: string) {
  const config = withGradleWrapper({ name: 'Kaitech', slug: 'kaitech-mobile' } as ExpoConfig);
  return config.mods.android.dangerous({
    ...config,
    modResults: null,
    modRequest: {
      projectRoot: androidDir,
      platformProjectRoot: androidDir,
      modName: 'dangerous',
      platform: 'android',
      introspect: false,
    },
  });
}

describe('with-gradle-wrapper', () => {
  it('pins the Expo template wrapper to the Gradle version and checksum and keeps every other line', () => {
    expect(pinWrapper(template)).toBe(pinned);
  });

  it('gives the same file when prebuild runs it twice', () => {
    expect(pinWrapper(pinWrapper(template))).toBe(pinned);
  });

  it('replaces a checksum the template already carries instead of adding a second one', () => {
    const withSum = template.replace('networkTimeout', 'distributionSha256Sum=abc\nnetworkTimeout');
    expect(pinWrapper(withSum)).toBe(pinned);
  });

  it('keeps CRLF line endings', () => {
    expect(pinWrapper(template.replace(/\n/g, '\r\n'))).toBe(pinned.replace(/\n/g, '\r\n'));
  });

  it('pins an -all distribution to the -bin one', () => {
    expect(pinWrapper(template.replace('9.4.1-bin', '9.4.1-all'))).toBe(pinned);
  });

  it.each([
    ['no distributionUrl', template.replace(/^distributionUrl=.*\n/m, '')],
    ['a mirror URL', template.replace('services.gradle.org/distributions', 'mirror.example.com/gradle')],
    ['two distributionUrl lines', template.replace('networkTimeout', 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip\nnetworkTimeout')],
  ])('fails on %s', (_case, text) => {
    expect(() => pinWrapper(text)).toThrow(/expected one; update plugins\/with-gradle-wrapper\.js/);
  });

  it('rewrites gradle-wrapper.properties under the generated android folder', async () => {
    const androidDir = mkdtempSync(join(tmpdir(), 'gradle-wrapper-'));
    mkdirSync(join(androidDir, 'gradle/wrapper'), { recursive: true });
    const file = join(androidDir, 'gradle/wrapper/gradle-wrapper.properties');
    writeFileSync(file, template);
    await prebuildMod(androidDir);
    expect(readFileSync(file, 'utf8')).toBe(pinned);
  });

  it('fails prebuild when the wrapper file is missing', async () => {
    const androidDir = mkdtempSync(join(tmpdir(), 'gradle-wrapper-'));
    await expect(prebuildMod(androidDir)).rejects.toThrow(/Gradle wrapper not found at .*gradle-wrapper\.properties/);
  });
});
