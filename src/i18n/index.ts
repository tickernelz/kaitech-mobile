import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import { createInstance } from 'i18next';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './locales/en.json';
import id from './locales/id.json';
import { effectiveLanguage, intlLocale, parsePreference, type Language, type LanguagePreference } from './language';

export type { Language, LanguagePreference } from './language';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

const i18n = createInstance();
const preferenceKey = 'language';
let preference = parsePreference(Storage.getItemSync(preferenceKey));
const listeners = new Set<() => void>();

function deviceLocaleTag(): string | null {
  return getLocales()[0]?.languageTag ?? null;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, id: { translation: id } },
  lng: effectiveLanguage(preference, deviceLocaleTag()),
  fallbackLng: 'en',
  supportedLngs: ['en', 'id'],
  interpolation: { escapeValue: false },
  initAsync: false,
});

function apply() {
  const next = effectiveLanguage(preference, deviceLocaleTag());
  if (i18n.language !== next) void i18n.changeLanguage(next);
  listeners.forEach((listener) => listener());
}

AppState.addEventListener('change', (state) => {
  if (state === 'active' && preference === 'system') apply();
});

export function setLanguagePreference(next: LanguagePreference) {
  preference = next;
  if (next === 'system') Storage.removeItemSync(preferenceKey);
  else Storage.setItemSync(preferenceKey, next);
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage() {
  const { i18n: instance } = useTranslation();
  const current = useSyncExternalStore(subscribe, () => preference);
  const language = instance.language as Language;
  return { preference: current, language, setPreference: setLanguagePreference };
}

export function useFormatters() {
  const { language } = useLanguage();
  const locale = intlLocale(language);
  const date = useCallback(
    (value: Date | number) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value),
    [locale],
  );
  const number = useCallback((value: number) => new Intl.NumberFormat(locale).format(value), [locale]);
  return { date, number };
}

export function useDeviceLanguageRefresh() {
  useEffect(() => apply(), []);
}

export default i18n;
