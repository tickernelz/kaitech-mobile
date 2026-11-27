import { isSignInCallback, stashCallback } from '../auth/signIn';
import { getSession } from '../auth/session';
import { liveStopUrl, stopAllShares } from '../features/chat/live';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (path.startsWith(liveStopUrl)) {
      void stopAllShares();
      return initial ? '/' : null;
    }
    if (isSignInCallback(path)) {
      stashCallback(path);
      if (!initial) return null;
      return getSession().activeId ? '/add-account' : '/sign-in';
    }
    return path;
  } catch {
    return '/';
  }
}
