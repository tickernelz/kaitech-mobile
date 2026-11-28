import type { TFunction } from 'i18next';
import { can, type Access } from '../auth/access';
import type { IconName } from '../ui/icons';

export type TabName = 'home' | 'chat' | 'discovery' | 'mom' | 'activity';

export const allTabs: TabName[] = ['home', 'chat', 'discovery', 'mom', 'activity'];

export const routes: Record<TabName, { name: string; href: '/home' | '/' | '/discovery' | '/mom' | '/activity' }> = {
  home: { name: 'home', href: '/home' },
  chat: { name: 'index', href: '/' },
  discovery: { name: 'discovery', href: '/discovery' },
  mom: { name: 'mom', href: '/mom' },
  activity: { name: 'activity', href: '/activity' },
};

export const tabIcons = { home: 'home', chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<TabName, IconName>;

export function tabsFor(access: Access): TabName[] {
  return allTabs.filter((name) => {
    if (name === 'chat') return true;
    if (name === 'home') return can(access, 'client.home');
    return can(access, 'team');
  });
}

const countKeys = { home: null, chat: 'tabs.unread', discovery: null, mom: null, activity: 'activities.pending' } as const satisfies Record<TabName, string | null>;

export function tabSpoken(t: TFunction, name: TabName, count: number): string {
  const label = t(`tabs.${name}`);
  const key = countKeys[name];
  return key && count > 0 ? `${label}, ${t(key, { count })}` : label;
}

export function badgeText(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}
