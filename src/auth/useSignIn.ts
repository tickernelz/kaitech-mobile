import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';
import { errorCodeOf, type ErrorCode } from './errors';
import { signIn } from './signIn';

export function useSignIn(onDone: () => void, initiallyBusy = false) {
  const { language } = useLanguage();
  const [busy, setBusy] = useState(initiallyBusy);
  const [error, setError] = useState<ErrorCode | null>(null);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const run = useCallback(async (attempt: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await attempt();
      done.current();
    } catch (caught) {
      setError(errorCodeOf(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    (server: string, database: string) => run(() => signIn(server, database, language)),
    [run, language],
  );

  return { busy, error, setError, run, start };
}
