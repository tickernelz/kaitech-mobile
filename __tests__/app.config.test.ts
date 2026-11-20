import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigContext } from 'expo/config';
import appConfig from '../app.config';

const context: ConfigContext = {
  projectRoot: process.cwd(),
  staticConfigPath: join(process.cwd(), 'app.json'),
  packageJsonPath: join(process.cwd(), 'package.json'),
  config: {
    name: 'Kaitech',
    slug: 'kaitech-mobile',
    android: { package: 'io.kaitech.mobile' },
    ios: { bundleIdentifier: 'io.kaitech.mobile' },
  },
};

describe('appConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.GOOGLE_SERVICES_JSON;
    delete process.env.APP_BUILD_NUMBER;
  });

  afterAll(() => {
    process.env = original;
  });

  it('builds without google-services.json when the secret is absent', () => {
    const config = appConfig(context);
    expect(config.android?.googleServicesFile).toBeUndefined();
    expect(config.android?.package).toBe('io.kaitech.mobile');
  });

  it('ignores a google-services.json path that does not exist', () => {
    process.env.GOOGLE_SERVICES_JSON = join(tmpdir(), 'missing-google-services.json');
    expect(appConfig(context).android?.googleServicesFile).toBeUndefined();
  });

  it('uses google-services.json when CI wrote it', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'kaitech-')), 'google-services.json');
    writeFileSync(file, '{}');
    process.env.GOOGLE_SERVICES_JSON = file;
    expect(appConfig(context).android?.googleServicesFile).toBe(file);
  });

  it('stamps the CI build number on both platforms', () => {
    process.env.APP_BUILD_NUMBER = '42';
    const config = appConfig(context);
    expect(config.android?.versionCode).toBe(42);
    expect(config.ios?.buildNumber).toBe('42');
  });

  it.each(['', '0', '-3', '12abc', '1.5', '99999999999'])(
    'falls back to build 1 for APP_BUILD_NUMBER=%p',
    (value) => {
      process.env.APP_BUILD_NUMBER = value;
      const config = appConfig(context);
      expect(config.android?.versionCode).toBe(1);
      expect(config.ios?.buildNumber).toBe('1');
    },
  );
});
