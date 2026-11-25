import { useEffect, useState, useSyncExternalStore } from 'react';
import i18n from '../i18n';
import type { IconName } from './icons';
import { showNotice } from './undo';

export type ChoiceTone = 'primary' | 'danger' | 'cancel' | 'plain';
export type DialogChoice = { key: string; label: string; tone?: ChoiceTone };
export type DialogInput = { label: string; value?: string; placeholder?: string; secure?: boolean; multiline?: boolean; required?: boolean };
export type DialogSpec = { title?: string; body?: string; icon?: IconName; danger?: boolean; choices: DialogChoice[]; input?: DialogInput; testID?: string };
export type DialogAnswer = { key: string; text: string };
export type OpenDialog = DialogSpec & { id: number };

type Entry = OpenDialog & { resolve: (answer: DialogAnswer | null) => void };

let queue: Entry[] = [];
let held = false;
let nextId = 1;
let layers: number[] = [];
let nextLayer = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openDialog(spec: DialogSpec): Promise<DialogAnswer | null> {
  return new Promise((resolve) => {
    queue = [...queue, { ...spec, id: nextId++, resolve }];
    emit();
  });
}

export function answerDialog(id: number, answer: DialogAnswer | null) {
  const entry = queue.find((candidate) => candidate.id === id);
  if (!entry) return;
  queue = queue.filter((candidate) => candidate !== entry);
  emit();
  entry.resolve(answer);
}

export function holdDialogs(next: boolean) {
  if (held === next) return;
  held = next;
  emit();
}

export function useOpenDialog(): OpenDialog | null {
  return useSyncExternalStore(subscribe, () => (held ? null : (queue[0] ?? null)));
}

export function useLayerOnTop(): boolean {
  const [id] = useState(() => nextLayer++);
  useEffect(() => {
    layers = [...layers, id];
    emit();
    return () => {
      layers = layers.filter((layer) => layer !== id);
      emit();
    };
  }, [id]);
  return useSyncExternalStore(subscribe, () => layers.length > 0 && Math.max(...layers) === id);
}

type Confirm = { title?: string; body?: string; confirm: string; cancel?: string; danger?: boolean; icon?: IconName; testID?: string };

export async function confirm({ title, body, confirm: label, cancel, danger, icon, testID }: Confirm): Promise<boolean> {
  const answer = await openDialog({
    title,
    body,
    icon,
    danger,
    testID,
    choices: [
      { key: 'cancel', label: cancel ?? i18n.t('dialog.cancel'), tone: 'cancel' },
      { key: 'confirm', label, tone: danger ? 'danger' : 'primary' },
    ],
  });
  return answer?.key === 'confirm';
}

export async function inform({ title, body, ok, icon, testID }: { title?: string; body?: string; ok?: string; icon?: IconName; testID?: string }): Promise<void> {
  await openDialog({ title, body, icon, testID, choices: [{ key: 'ok', label: ok ?? i18n.t('dialog.ok'), tone: 'primary' }] });
}

export async function choose({ title, body, choices, cancel, icon, testID }: { title?: string; body?: string; choices: DialogChoice[]; cancel?: string; icon?: IconName; testID?: string }): Promise<string | null> {
  const answer = await openDialog({ title, body, icon, testID, choices: [...choices, { key: 'cancel', label: cancel ?? i18n.t('dialog.cancel'), tone: 'cancel' }] });
  return answer && answer.key !== 'cancel' ? answer.key : null;
}

export async function prompt({ title, body, input, confirm: label, cancel, danger, testID }: Omit<Confirm, 'icon'> & { input: DialogInput }): Promise<string | null> {
  const answer = await openDialog({
    title,
    body,
    input,
    danger,
    testID,
    choices: [
      { key: 'cancel', label: cancel ?? i18n.t('dialog.cancel'), tone: 'cancel' },
      { key: 'confirm', label, tone: danger ? 'danger' : 'primary' },
    ],
  });
  return answer?.key === 'confirm' ? answer.text : null;
}

export function notify(text: string) {
  if (text.trim()) showNotice(text);
}
