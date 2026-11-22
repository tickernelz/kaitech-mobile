import { useEffect, useState } from 'react';
import { onAccountForgotten } from '../../auth/session';

const kept = 50;
const held = new Map<string, unknown>();
let next = 0;

export function stash(value: unknown): string {
  next += 1;
  const key = String(next);
  held.set(key, value);
  while (held.size > kept) held.delete(held.keys().next().value as string);
  return key;
}

export function unstash<T>(key: string | undefined): T | undefined {
  return key ? (held.get(key) as T | undefined) : undefined;
}

onAccountForgotten(() => held.clear());

const listeners = new Set<() => void>();
let generation = 0;

export function recordsChanged() {
  generation += 1;
  listeners.forEach((listener) => listener());
}

export function useRecordsGeneration(): number {
  const [seen, setSeen] = useState(generation);
  useEffect(() => {
    const listener = () => setSeen(generation);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return seen;
}
