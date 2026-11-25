import Storage from 'expo-sqlite/kv-store';
import { getSession, onAccountForgotten } from '../../../../../auth/session';
import type { StickerShelf } from '../../../composerExtras';
import { emojiGroups } from '../../../emoji/emoji';
import type { EmojiCategory } from '../../../emoji/data';
import type { Failure } from '../../../messageActions';
import type { Sticker } from '../../../types';

export const emojiColumns = 8;
export const stickerColumns = 4;
export const handleDragDp = 40;
export const flingDpPerMs = 0.8;
const defaultPanelHeight = 300;
const panelMin = 260;
export const searchPanelHeight = 196;

export type PanelTab = 'emoji' | 'sticker' | 'gif';
export const panelTabs: PanelTab[] = ['emoji', 'sticker', 'gif'];
export type EmojiSection = 'recent' | EmojiCategory;
export type EmojiRow = { type: 'header'; section: EmojiSection } | { type: 'row'; section: EmojiSection; emojis: string[] };
export type StickerSection = { key: string; title: string; stickers: Sticker[] };
export type StickerRow = { type: 'header'; section: string; title: string } | { type: 'row'; section: string; stickers: Sticker[] };
export type PanelProblem = 'offline' | 'unavailable' | 'server' | 'emptySearch' | 'noStickers';

export function halfPanelHeight(keyboard: number): number {
  return keyboard > 0 ? Math.max(panelMin, keyboard) : defaultPanelHeight;
}

export function handleOutcome(dy: number, vy: number, full: boolean): 'full' | 'half' | 'close' | 'stay' {
  if (dy <= -handleDragDp || vy <= -flingDpPerMs) return 'full';
  if (dy >= handleDragDp || vy >= flingDpPerMs) return full ? 'half' : 'close';
  return 'stay';
}

const tabKey = (account: string) => `composer.panelTab.${account}`;

export function lastPanelTab(): PanelTab {
  const account = getSession().activeId;
  const saved = account ? Storage.getItemSync(tabKey(account)) : null;
  return (panelTabs as string[]).includes(saved ?? '') ? (saved as PanelTab) : 'emoji';
}

export function rememberPanelTab(tab: PanelTab) {
  const account = getSession().activeId;
  if (account) Storage.setItemSync(tabKey(account), tab);
}

onAccountForgotten((account) => Storage.removeItemSync(tabKey(account)));

export function emojiRows(recent: string[]): EmojiRow[] {
  const rows: EmojiRow[] = [];
  const add = (section: EmojiSection, emojis: string[]) => {
    if (!emojis.length) return;
    rows.push({ type: 'header', section });
    for (let index = 0; index < emojis.length; index += emojiColumns) rows.push({ type: 'row', section, emojis: emojis.slice(index, index + emojiColumns) });
  };
  add('recent', recent);
  for (const group of emojiGroups()) add(group.category, group.items.map((item) => item.emoji));
  return rows;
}

export function stickerSections(shelf: StickerShelf, titles: { favorites: string; recent: string }): StickerSection[] {
  const byId = new Map(shelf.packs.flatMap((pack) => pack.stickers.map((sticker) => [sticker.id as number, sticker] as const)));
  const favorites = shelf.favorites.map((id) => byId.get(id)).filter((sticker): sticker is Sticker => sticker !== undefined);
  return [
    { key: 'favorites', title: titles.favorites, stickers: favorites },
    { key: 'recent', title: titles.recent, stickers: shelf.recent },
    ...shelf.packs.map((pack) => ({ key: `pack-${pack.id}`, title: pack.name, stickers: pack.stickers })),
  ].filter((section) => section.stickers.length > 0);
}

export function stickerRows(sections: StickerSection[]): StickerRow[] {
  const rows: StickerRow[] = [];
  for (const section of sections) {
    rows.push({ type: 'header', section: section.key, title: section.title });
    for (let index = 0; index < section.stickers.length; index += stickerColumns) rows.push({ type: 'row', section: section.key, stickers: section.stickers.slice(index, index + stickerColumns) });
  }
  return rows;
}

export function problemOf(failure: Failure | null): PanelProblem | null {
  if (!failure) return null;
  if (failure.code === 'network') return 'offline';
  if (failure.reason === 'gif_unavailable') return 'unavailable';
  return 'server';
}
