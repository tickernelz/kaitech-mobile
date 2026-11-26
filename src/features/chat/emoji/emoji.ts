import Storage from 'expo-sqlite/kv-store';
import { getSession, onAccountForgotten } from '../../../auth/session';
import { emojiData, type EmojiCategory } from './data';
import { modifierBases } from './skinData';

export type Emoji = { emoji: string; words: string };
export type EmojiGroup = { category: EmojiCategory; items: Emoji[] };

let groups: EmojiGroup[] | null = null;
const recentLimit = 24;
const recentKey = (account: string) => `emoji.recent.${account}`;
const skinKey = (account: string) => `emoji.skin.${account}`;
const activeAccount = () => getSession().activeId ?? 'none';

export const skinTones = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'] as const;
const toneSet = new Set<number>(skinTones.slice(1).map((tone) => tone.codePointAt(0) as number));

export function emojiGroups(): EmojiGroup[] {
  if (!groups) {
    groups = emojiData.map(([category, rows]) => ({
      category,
      items: rows.split('\n').map((row) => {
        const tab = row.indexOf('\t');
        return { emoji: row.slice(0, tab), words: row.slice(tab + 1) };
      }),
    }));
  }
  return groups;
}

export function searchEmoji(query: string, limit = 80): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const named: string[] = [];
  const tagged: string[] = [];
  for (const group of emojiGroups()) {
    for (const item of group.items) {
      if (!terms.every((term) => item.words.includes(term))) continue;
      (item.words.startsWith(terms[0]) ? named : tagged).push(item.emoji);
    }
  }
  return [...named, ...tagged].slice(0, limit);
}

function readList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function recentEmoji(): string[] {
  return readList(recentKey(activeAccount())).slice(0, recentLimit);
}

export function noteEmoji(emoji: string) {
  const next = [emoji, ...recentEmoji().filter((item) => item !== emoji)].slice(0, recentLimit);
  Storage.setItemSync(recentKey(activeAccount()), JSON.stringify(next));
}

function isBase(point: number): boolean {
  let low = 0;
  let high = modifierBases.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [start, end] = modifierBases[middle];
    if (point < start) high = middle - 1;
    else if (point > end) low = middle + 1;
    else return true;
  }
  return false;
}

export function supportsSkin(emoji: string): boolean {
  const points = Array.from(emoji, (char) => char.codePointAt(0) as number);
  return points.some(isBase) && !points.some((point) => toneSet.has(point));
}

export function withSkin(emoji: string, tone: number): string {
  const modifier = skinTones[tone] ?? '';
  if (!modifier || !supportsSkin(emoji)) return emoji;
  const chars = Array.from(emoji);
  let out = '';
  for (let index = 0; index < chars.length; index++) {
    const point = chars[index].codePointAt(0) as number;
    out += chars[index];
    if (isBase(point)) {
      out += modifier;
      if (chars[index + 1] === '\uFE0F') index++;
    }
  }
  return out;
}

function readSkins(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(skinKey(activeAccount())) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function skinFor(emoji: string): number {
  const tone = readSkins()[emoji];
  return typeof tone === 'number' && tone >= 0 && tone < skinTones.length ? tone : 0;
}

export function rememberSkin(emoji: string, tone: number) {
  const skins = readSkins();
  if (tone) skins[emoji] = tone;
  else delete skins[emoji];
  Storage.setItemSync(skinKey(activeAccount()), JSON.stringify(skins));
}

onAccountForgotten((account) => {
  Storage.removeItemSync(recentKey(account));
  Storage.removeItemSync(skinKey(account));
});
