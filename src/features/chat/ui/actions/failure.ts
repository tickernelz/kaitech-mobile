import type { TFunction } from 'i18next';
import type { Failure } from '../../messageActions';

export function failureText(t: TFunction<'chat'>, failure: Failure): string {
  if (failure.detail) return failure.detail;
  if (failure.code === 'network') return t('errors.network');
  if (failure.code === 'forbidden') return t('act.forbidden');
  return t('act.failed');
}
