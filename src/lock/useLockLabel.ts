import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lockMethod, type LockMethod } from './lock';

export function useLockLabel(): { method: LockMethod | null; label: string; ready: boolean } {
  const { t } = useTranslation();
  const [state, setState] = useState<{ method: LockMethod | null; ready: boolean }>({ method: null, ready: false });
  useEffect(() => {
    let live = true;
    lockMethod()
      .then((method) => live && setState({ method, ready: true }))
      .catch(() => live && setState({ method: null, ready: true }));
    return () => {
      live = false;
    };
  }, []);
  return { ...state, label: t(`lock.${state.method ?? 'biometric'}`) };
}
