import type { IconName } from '../ui/icons';

export type TabName = 'chat' | 'discovery' | 'mom' | 'activity';

export const tabs: TabName[] = ['chat', 'discovery', 'mom', 'activity'];

export const routes: Record<TabName, { name: string; href: '/' | '/discovery' | '/mom' | '/activity' }> = {
  chat: { name: 'index', href: '/' },
  discovery: { name: 'discovery', href: '/discovery' },
  mom: { name: 'mom', href: '/mom' },
  activity: { name: 'activity', href: '/activity' },
};

export const tabIcons = { chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<TabName, IconName>;

const countKeys: Partial<Record<TabName, string>> = { chat: 'tabs.unread', activity: 'activities.pending' };

export function tabSpoken(t: (key: string, options?: { count: number }) => string, name: TabName, count: number): string {
  const label = t(`tabs.${name}`);
  const key = countKeys[name];
  return key && count > 0 ? `${label}, ${t(key, { count })}` : label;
}

export function badgeText(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}
