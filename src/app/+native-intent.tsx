import { isSignInCallback, stashCallback } from '../auth/signIn';
import { getSession } from '../auth/session';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
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
