import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Attribution, Page } from '../../../composerExtras';
import type { Failure, Result } from '../../../messageActions';
import { failureText } from '../../actions/failure';

export const PanelShown = createContext(true);

export function useWhenPanelShows(shows: () => void, hides: () => void) {
  const shown = useContext(PanelShown);
  const calls = useRef({ shows, hides });
  useEffect(() => {
    calls.current = { shows, hides };
  });
  const was = useRef(shown);
  useEffect(() => {
    if (shown === was.current) return;
    was.current = shown;
    if (shown) calls.current.shows();
    else calls.current.hides();
  }, [shown]);
}

export const searchDelay = 350;
export const maxPlaying = 8;

export function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), searchDelay);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

type Loaded<T> = { key: string; scope: string; items: T[]; next: string | null; attribution: Attribution | null; failure: Failure | null };

export type Paged<T> = { items: T[]; loading: boolean; failure: Failure | null; failureText: string | null; attribution: Attribution | null; more: () => void; retry: () => void; term: string };

export function usePaged<T>(load: (query: string, position: string | null) => Promise<Result<Page<T>>>, query: string, scope = ''): Paged<T> {
  const { t } = useTranslation('chat');
  const term = useDebounced(query.trim());
  const head = `${scope}|${term}`;
  const [after, setAfter] = useState<{ head: string; position: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const position = after?.head === head ? after.position : null;
  const key = `${head}|${position ?? ''}|${attempt}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  useEffect(() => {
    let live = true;
    void load(term, position).then((result) => {
      if (!live) return;
      setLoaded((current) => {
        const before = position && current?.scope === head ? current : null;
        if (!result.ok) return { key, scope: head, items: before?.items ?? [], next: before?.next ?? null, attribution: before?.attribution ?? null, failure: result };
        return { key, scope: head, items: [...(before?.items ?? []), ...result.value.items], next: result.value.next, attribution: result.value.attribution ?? before?.attribution ?? null, failure: null };
      });
    });
    return () => {
      live = false;
    };
  }, [head, key, load, position, term]);
  const loading = loaded?.key !== key;
  const same = loaded?.scope === head;
  const items = same ? loaded.items : [];
  const next = same ? loaded.next : null;
  const failure = !loading && loaded ? loaded.failure : null;
  return {
    items,
    loading,
    failure,
    failureText: failure ? failureText(t, failure) : null,
    attribution: loaded?.attribution ?? null,
    term,
    more: () => {
      if (!loading && next && !failure) setAfter({ head, position: next });
    },
    retry: () => setAttempt((value) => value + 1),
  };
}

export function useVisiblePlaying() {
  const reduce = useReducedMotion();
  const shown = useContext(PanelShown);
  const [playing, setPlaying] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  const onViewableItemsChanged = ({ viewableItems }: { viewableItems: { key?: string; isViewable?: boolean }[] }) => {
    const keys = viewableItems.filter((entry) => entry.isViewable !== false && entry.key).map((entry) => entry.key as string);
    setPlaying(new Set(keys.slice(0, maxPlaying)));
  };
  return { isPlaying: (key: string) => shown && !reduce && active && playing.has(key), onViewableItemsChanged, viewabilityConfig: { itemVisiblePercentThreshold: 50 } };
}
