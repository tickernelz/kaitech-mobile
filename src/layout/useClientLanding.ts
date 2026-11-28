import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { can } from '../auth/access';
import { useSession } from '../auth/session';
import { accessOf } from '../auth/useAccess';

export function useClientLanding() {
  const router = useRouter();
  const pathname = usePathname();
  const { channel } = useGlobalSearchParams<{ channel?: string }>();
  const { active } = useSession();
  const home = can(accessOf(active), 'client.home');
  const landed = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !home || landed.current === active.id) return;
    landed.current = active.id;
    if (pathname === '/' && !channel) router.replace('/home');
  }, [active, home, pathname, channel, router]);
}
