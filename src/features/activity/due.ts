import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dayOf, daysUntil } from './odoo';

export type Due = { key: 'overdue' | 'yesterday' | 'today' | 'tomorrow' | 'inDays' | 'on'; count: number };

export function dueOf(iso: string, today: Date): Due | null {
  const days = daysUntil(iso, today);
  if (days === null) return null;
  if (days === -1) return { key: 'yesterday', count: 1 };
  if (days < 0) return { key: 'overdue', count: -days };
  if (days === 0) return { key: 'today', count: 0 };
  if (days === 1) return { key: 'tomorrow', count: 1 };
  if (days <= 6) return { key: 'inDays', count: days };
  return { key: 'on', count: days };
}

export function useDueLabel() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (iso: string) => {
      const due = dueOf(iso, new Date());
      if (!due) return '';
      if (due.key === 'on') {
        const day = dayOf(iso) as Date;
        return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: day.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(day);
      }
      return t(`activities.when.${due.key}`, { count: due.count });
    },
    [t, i18n.language],
  );
}
