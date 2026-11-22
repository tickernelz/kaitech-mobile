import { useCallback, useEffect, useRef } from 'react';
import { patchMessages } from '../chat';
import { isRemoved } from '../odoo';
import { translationsFor } from '../threadActions';
import type { Message } from '../types';

const batchMs = 150;
const most = 20;

export function useAutoTranslate(on: boolean): (messages: Message[]) => void {
  const asked = useRef(new Set<number>());
  const waiting = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async function flush(): Promise<void> {
    timer.current = null;
    const ids = [...waiting.current].slice(0, most);
    ids.forEach((id) => waiting.current.delete(id));
    if (!ids.length) return;
    const result = await translationsFor(ids);
    if (!result.ok) {
      ids.forEach((id) => asked.current.delete(id));
      return;
    }
    const patches = new Map([...result.value.found].map(([id, translation]) => [id, { translation, translated: true }]));
    patchMessages(patches);
    for (const id of result.value.busy) asked.current.delete(id);
    if (waiting.current.size) timer.current = setTimeout(() => void flush(), batchMs);
  }, []);
  useEffect(() => {
    if (on) return;
    asked.current.clear();
    waiting.current.clear();
  }, [on]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(
    (messages: Message[]) => {
      if (!on) return;
      for (const message of messages) {
        if (message.type !== 'comment' || isRemoved(message) || message.translation || asked.current.has(message.id)) continue;
        asked.current.add(message.id);
        waiting.current.add(message.id);
      }
      if (waiting.current.size && !timer.current) timer.current = setTimeout(() => void flush(), batchMs);
    },
    [flush, on],
  );
}
