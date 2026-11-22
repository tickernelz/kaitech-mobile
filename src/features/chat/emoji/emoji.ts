import Storage from 'expo-sqlite/kv-store';
import { emojiData, type EmojiCategory } from './data';

export type Emoji = { emoji: string; words: string };
export type EmojiGroup = { category: EmojiCategory; items: Emoji[] };

let groups: EmojiGroup[] | null = null;
const recentKey = 'emoji.recent';
const recentLimit = 24;

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

export function recentEmoji(): string[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(recentKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, recentLimit) : [];
  } catch {
    return [];
  }
}

export function noteEmoji(emoji: string) {
  const next = [emoji, ...recentEmoji().filter((item) => item !== emoji)].slice(0, recentLimit);
  Storage.setItemSync(recentKey, JSON.stringify(next));
}
