import '../i18n';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession, verifyActiveSession } from '../auth/session';
import { CallRuntime } from '../features/call/CallRuntime';
import { setLocked } from '../features/call/call';
import { registerHeadlessTask } from '../features/call/decline';
import { ChatRuntime } from '../features/chat/ChatRuntime';
import { LockScreen } from '../lock/LockScreen';
import { useLock } from '../lock/lock';
import { useRecentsGuard } from '../lock/useRecentsGuard';
import { useTheme } from '../theme';

registerHeadlessTask();

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 240, fade: true });

export default function RootLayout() {
  const { colors } = useTheme();
  const session = useSession();
  const lock = useLock();
  const hasAccount = session.active !== null;
  const signedIn = hasAccount && !session.expired;
  const locked = signedIn && lock.locked;
  useRecentsGuard(signedIn && lock.enabled);
  useEffect(() => {
    setLocked(signedIn && lock.locked);
  }, [signedIn, lock.locked]);
  const home = !hasAccount ? '/welcome' : session.expired ? '/expired' : session.onboarded ? '/' : '/setup';

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
      <KeyboardProvider>
      <StatusBar style="auto" />
      <ChatRuntime account={signedIn && session.onboarded ? session.active : null} />
      <View style={styles.fill} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} pointerEvents={locked ? 'none' : 'auto'}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Protected guard={signedIn && session.onboarded} redirectTo={home}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="program" />
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="add-account" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !session.onboarded} redirectTo={home}>
            <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={hasAccount && session.expired} redirectTo={home}>
            <Stack.Screen name="expired" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={!hasAccount} redirectTo={home}>
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </View>
      <CallRuntime account={signedIn && session.onboarded ? session.active : null} />
      {locked ? <LockScreen /> : null}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
