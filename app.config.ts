import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

function buildNumber(): number {
  const raw = process.env.APP_BUILD_NUMBER ?? '';
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const build = buildNumber();
  return {
    ...config,
    name: config.name ?? 'Kaitech',
    slug: config.slug ?? 'kaitech-mobile',
    ios: { ...config.ios, buildNumber: String(build) },
    android: {
      ...config.android,
      versionCode: build,
      ...(googleServicesFile && existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
  };
}
