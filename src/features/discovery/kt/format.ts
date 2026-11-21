import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale, type Language } from '../../../i18n/language';

const DAY = 86400000;
const HUMAN = ['k', 'M', 'G', 'T', 'P', 'E'];

export type Numbers = {
  locale: string;
  number: (value: number, places: number, trailingZeros?: boolean) => string;
  date: (value: string) => string;
  day: (day: number, withYear: boolean) => string;
  month: (day: number) => string;
  human: (value: number) => string;
};

export function decimalsOf(values: unknown[]): number {
  let places = 0;
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
      places = Math.max(places, Math.min(6, (String(value).split('.')[1] ?? '').length));
    }
  }
  return places;
}

export function dayOf(value: string): number {
  const [year, month, date] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, date) / DAY;
}

export function numbersFor(language: string): Numbers {
  const locale = intlLocale(language === 'id' ? 'id' : ('en' as Language));
  const fixed = new Map<string, Intl.NumberFormat>();
  const formatter = (places: number, trailingZeros: boolean) => {
    const key = places + (trailingZeros ? 't' : 'f');
    let found = fixed.get(key);
    if (!found) {
      found = new Intl.NumberFormat(locale, { minimumFractionDigits: trailingZeros ? places : 0, maximumFractionDigits: places });
      fixed.set(key, found);
    }
    return found;
  };
  const dateShape = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dayShape = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const monthShape = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const number = (value: number, places: number, trailingZeros = true) => formatter(places, trailingZeros).format(value);
  return {
    locale,
    number,
    date: (value) => dateShape.format(new Date(dayOf(value) * DAY)),
    day: (day, withYear) => (withYear ? dateShape : dayShape).format(new Date(day * DAY)),
    month: (day) => monthShape.format(new Date(day * DAY)),
    human: (value) => {
      let scaled = value;
      let unit = '';
      for (const symbol of HUMAN) {
        if (Math.abs(scaled) < 1000) break;
        scaled /= 1000;
        unit = symbol;
      }
      return number(scaled, unit ? 1 : 0, false) + unit;
    },
  };
}

export function useNumbers(): Numbers {
  const { i18n } = useTranslation();
  return useMemo(() => numbersFor(i18n.language), [i18n.language]);
}

export function withUnit(text: string, unit: string): string {
  if (!unit) return text;
  return unit === '%' ? text + '%' : text + ' ' + unit;
}

export function signed(numbers: Numbers, value: number, places: number): string {
  if (value > 0) return '+' + numbers.number(value, places, false);
  return value < 0 ? '\u2212' + numbers.number(-value, places, false) : numbers.number(0, places, false);
}
