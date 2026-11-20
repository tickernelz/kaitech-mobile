import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const callbackPath = '/kaitech_mobile/callback';

function buildNumber(): number {
  const raw = process.env.APP_BUILD_NUMBER ?? '';
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

function linkHost(): string | null {
  const raw = (process.env.KAITECH_LINK_HOST ?? '').trim().toLowerCase();
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw) ? raw : null;
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const build = buildNumber();
  const host = linkHost();
  return {
    ...config,
    name: config.name ?? 'Kaitech',
    slug: config.slug ?? 'kaitech-mobile',
    extra: { ...config.extra, ...(host ? { linkHost: host } : {}) },
    ios: {
      ...config.ios,
      buildNumber: String(build),
      ...(host ? { associatedDomains: [`applinks:${host}`] } : {}),
    },
    android: {
      ...config.android,
      versionCode: build,
      ...(googleServicesFile && existsSync(googleServicesFile) ? { googleServicesFile } : {}),
      ...(host
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [{ scheme: 'https', host, path: callbackPath }],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ],
          }
        : {}),
    },
  };
}
