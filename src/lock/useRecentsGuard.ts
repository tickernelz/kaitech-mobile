import { allowScreenCaptureAsync, disableAppSwitcherProtectionAsync, enableAppSwitcherProtectionAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

const key = 'recents';

export function useRecentsGuard(enabled: boolean) {
  useEffect(() => {
    if (Platform.OS === 'ios') {
      void (enabled ? enableAppSwitcherProtectionAsync(1) : disableAppSwitcherProtectionAsync());
      return;
    }
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (next) => {
      void (next === 'active' ? allowScreenCaptureAsync(key) : preventScreenCaptureAsync(key));
    });
    return () => {
      subscription.remove();
      void allowScreenCaptureAsync(key);
    };
  }, [enabled]);
}
