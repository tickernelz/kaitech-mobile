import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getSession, signOut } from '../auth/session';
import { space, useTheme } from '../theme';
import { duration, useMotion } from '../theme/motion';
import { Button } from '../ui/Button';
import { openDialog } from '../ui/dialog';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Wordmark } from '../ui/Wordmark';
import { deviceHasScreenLock, resetLock, unlock } from './lock';

export function LockScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [stranded, setStranded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const fadeIn = useMotion(FadeIn.duration(duration.quick));
  const attempt = useCallback(
    () =>
      deviceHasScreenLock().then(async (secured) => {
        if (!secured) return setStranded(true);
        setFailed(!(await unlock(t('lock.prompt'), t('settings.cancel'))));
      }),
    [t],
  );
  useEffect(() => {
    void attempt();
  }, [attempt]);
  const leave = async () => {
    const answer = await openDialog({
      title: t('lock.signOutTitle'),
      body: t('lock.signOutBody'),
      danger: true,
      choices: [
        { key: 'cancel', label: t('settings.cancel'), tone: 'cancel' },
        { key: 'leave', label: t('lock.signOut'), tone: 'danger' },
      ],
      testID: 'lock-sign-out-dialog',
    });
    if (answer?.key !== 'leave') return;
    setLeaving(true);
    setLeaveFailed(false);
    try {
      for (const account of getSession().accounts) await signOut(account.id);
      resetLock();
    } catch {
      setLeaveFailed(true);
    } finally {
      setLeaving(false);
    }
  };
  return (
    <Animated.View
      entering={fadeIn}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]}
      accessibilityViewIsModal>
      <Screen
        testID="lock"
        footer={
          stranded ? (
            <Button kind="danger" label={t('lock.signOut')} busy={leaving} onPress={() => void leave()} testID="lock-sign-out" />
          ) : (
            <Button label={t('lock.unlock')} onPress={() => void attempt()} testID="lock-unlock" />
          )
        }>
        <View style={styles.center}>
          <Wordmark width={140} label={t('app.name')} />
          <Text variant="title" accessibilityRole="header">
            {t('lock.title')}
          </Text>
          {stranded ? (
            <>
              <Text tone="inkSoft" style={styles.text} testID="lock-no-screen-lock">
                {t('lock.noScreenLock')}
              </Text>
              {leaveFailed ? (
                <Text tone="dangerInk" style={styles.text} accessibilityRole="alert" testID="lock-sign-out-failed">
                  {t('lock.signOutFailed')}
                </Text>
              ) : null}
            </>
          ) : failed ? (
            <Text tone="dangerInk" accessibilityRole="alert">
              {t('lock.failed')}
            </Text>
          ) : null}
        </View>
      </Screen>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  text: { textAlign: 'center' },
});
