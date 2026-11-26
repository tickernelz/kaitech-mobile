import { useTabTrigger } from 'expo-router/ui';
import { routes, type TabName } from './tabs';

export function useTab(name: TabName) {
  const { switchTab, trigger } = useTabTrigger({ name: routes[name].name });
  const focused = !!trigger?.isFocused;
  return { focused, open: () => (focused ? false : (switchTab(routes[name].name, {}), true)) };
}
