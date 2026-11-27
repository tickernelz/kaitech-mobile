import '../i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSession, useSession, verifyActiveSession } from '../auth/session';
import { CallRuntime, CallStrip } from '../features/call/CallRuntime';
import { setLocked } from '../features/call/call';
import { ChatRuntime } from '../features/chat/ChatRuntime';
import { LockScreen } from '../lock/LockScreen';
import { useLock } from '../lock/lock';
import { useRecentsGuard } from '../lock/useRecentsGuard';
import { useTheme } from '../theme';
import { useReduceMotion } from '../theme/reduceMotion';
import { applyTheme, useAppliedTheme } from '../features/appearance/appearance';
import { DialogLayer } from '../ui/Dialog';
import { holdDialogs } from '../ui/dialog';
import { firstScreenDrawn, holdSplash, splashGone } from '../ui/launch';

holdSplash();
applyTheme(getSession().activeId);

function ScreenLayout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.fill} onLayout={splashGone() ? undefined : firstScreenDrawn}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const fade = reduceMotion ? 'none' : 'fade';
  const { width, height } = useWindowDimensions();
  const session = useSession();
  const lock = useLock();
  const hasAccount = session.active !== null;
  const signedIn = hasAccount && !session.expired;
  const locked = signedIn && lock.locked;
  useRecentsGuard(signedIn && lock.enabled);
  useAppliedTheme(signedIn ? session.activeId : null);
  useEffect(() => {
    setLocked(signedIn && lock.locked);
    holdDialogs(signedIn && lock.locked);
  }, [signedIn, lock.locked]);
  const home = !hasAccount ? '/welcome' : session.expired ? '/expired' : session.onboarded ? '/' : '/setup';

  useEffect(() => {
    if (!session.activeId) return;
    void verifyActiveSession();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void verifyActiveSession();
    });
    return () => subscription.remove();
  }, [session.activeId]);

  return (
    <GestureHandlerRootView style={[styles.fill, { backgroundColor: colors.canvas }]}>
    <SafeAreaProvider>
      <KeyboardProvider>
      <StatusBar style="auto" />
      <ChatRuntime account={signedIn && session.onboarded ? session.active : null} />
      <View style={{ width, height }} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} pointerEvents={locked ? 'none' : 'auto'}>
        {signedIn && session.onboarded ? <CallStrip /> : null}
        <SafeAreaProvider style={styles.fill}>
        <Stack screenLayout={ScreenLayout} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, ...(reduceMotion ? { animation: 'none' } : {}) }}>
          <Stack.Protected guard={signedIn && session.onboarded} redirectTo={home}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal', animation: fade }} />
            <Stack.Screen name="recording/[id]" options={{ presentation: 'fullScreenModal', animation: fade }} />
            <Stack.Screen name="media" options={{ presentation: 'fullScreenModal', animation: fade }} />
            <Stack.Screen name="pdf" options={{ presentation: 'fullScreenModal', animation: fade }} />
            <Stack.Screen name="place" />
            <Stack.Screen name="program" />
            <Stack.Screen name="mom" />
            <Stack.Screen name="search" options={{ animation: fade }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="person/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="add-account" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !session.onboarded} redirectTo={home}>
            <Stack.Screen name="setup" options={{ animation: fade }} />
          </Stack.Protected>
          <Stack.Protected guard={hasAccount && session.expired} redirectTo={home}>
            <Stack.Screen name="expired" options={{ animation: fade }} />
          </Stack.Protected>
          <Stack.Protected guard={!hasAccount} redirectTo={home}>
            <Stack.Screen name="welcome" options={{ animation: fade }} />
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
        <DialogLayer root />
        </SafeAreaProvider>
      </View>
      <CallRuntime account={signedIn && session.onboarded ? session.active : null} />
      {locked ? <LockScreen /> : null}
      </KeyboardProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
