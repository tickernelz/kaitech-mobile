import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../../i18n';
import { intlLocale } from '../../../i18n/language';

const day = 86400000;

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function useChatFormat() {
  const { t } = useTranslation('chat');
  const { language } = useLanguage();
  const locale = intlLocale(language);
  const formats = useMemo(
    () => ({
      clock: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
      date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
      dateLong: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
      number: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    }),
    [locale],
  );

  const clock = useCallback((ms: number) => formats.clock.format(ms), [formats]);

  const listTime = useCallback(
    (ms: number) => {
      if (!ms) return '';
      const today = startOfDay(Date.now());
      if (ms >= today) return formats.clock.format(ms);
      if (ms >= today - day) return t('time.yesterday');
      if (ms >= today - 6 * day) return formats.weekday.format(ms);
      return formats.date.format(ms);
    },
    [formats, t],
  );

  const dayLabel = useCallback(
    (ms: number) => {
      const today = startOfDay(Date.now());
      if (ms >= today) return t('time.today');
      if (ms >= today - day) return t('time.yesterday');
      if (ms >= today - 6 * day) return formats.weekdayLong.format(ms);
      return formats.dateLong.format(ms);
    },
    [formats, t],
  );

  const duration = useCallback((ms: number) => {
    const total = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }, []);

  const size = useCallback(
    (bytes: number) => {
      if (bytes < 1024) return t('size.bytes', { count: bytes });
      if (bytes < 1024 * 1024) return t('size.kb', { value: formats.number.format(bytes / 1024) });
      return t('size.mb', { value: formats.number.format(bytes / 1024 / 1024) });
    },
    [formats, t],
  );

  return { clock, listTime, dayLabel, duration, size, sameDay: (a: number, b: number) => startOfDay(a) === startOfDay(b) };
}
