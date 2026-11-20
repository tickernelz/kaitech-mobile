export type Language = 'en' | 'id';
export type LanguagePreference = 'system' | Language;

export const languages: readonly Language[] = ['en', 'id'];

export function resolveLanguage(localeTag: string | null | undefined): Language {
  const primary = (localeTag ?? '').split(/[-_]/)[0].toLowerCase();
  return primary === 'id' || primary === 'in' ? 'id' : 'en';
}

export function parsePreference(stored: string | null | undefined): LanguagePreference {
  return stored === 'en' || stored === 'id' ? stored : 'system';
}

export function effectiveLanguage(preference: LanguagePreference, deviceLocaleTag: string | null | undefined): Language {
  return preference === 'system' ? resolveLanguage(deviceLocaleTag) : preference;
}

export function intlLocale(language: Language): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}
