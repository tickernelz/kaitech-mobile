import en from './locales/en.json';
import id from './locales/id.json';

export type Language = 'en' | 'id';

export type Strings = typeof en;

const catalogs: Record<Language, Strings> = { en, id };

export function resolveLanguage(localeTag: string | undefined): Language {
  const primary = (localeTag ?? '').split(/[-_]/)[0].toLowerCase();
  return primary === 'id' || primary === 'in' ? 'id' : 'en';
}

export function deviceLocaleTag(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export function stringsFor(language: Language): Strings {
  return catalogs[language];
}
