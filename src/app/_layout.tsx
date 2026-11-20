import '../i18n';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession, verifyActiveSession } from '../auth/session';
import { useLock } from '../lock/lock';
import { LockScreen } from '../lock/LockScreen';
import { useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 240, fade: true });

export default function RootLayout() {
  const { colors } = useTheme();
  const session = useSession();
  const lock = useLock();
  const hasAccount = session.active !== null;
  const signedIn = hasAccount && !session.expired;

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  useEffect(() => {
    if (!session.activeId) return;
    void verifyActiveSession();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void verifyActiveSession();
    });
    return () => subscription.remove();
  }, [session.activeId]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={signedIn && session.onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-account" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !session.onboarded}>
          <Stack.Screen name="setup" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasAccount && session.expired}>
          <Stack.Screen name="expired" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!hasAccount}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {signedIn && lock.locked ? <LockScreen /> : null}
    </SafeAreaProvider>
  );
}
