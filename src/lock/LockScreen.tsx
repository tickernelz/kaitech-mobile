import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { space, useTheme } from '../theme';
import { duration, useMotion } from '../theme/motion';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Wordmark } from '../ui/Wordmark';
import { unlock } from './lock';

export function LockScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const fadeIn = useMotion(FadeIn.duration(duration.quick));
  const attempt = useCallback(
    () => unlock(t('lock.prompt'), t('settings.cancel')).then((ok) => setFailed(!ok)),
    [t],
  );
  useEffect(() => {
    void unlock(t('lock.prompt'), t('settings.cancel')).then((ok) => setFailed(!ok));
  }, [t]);
  return (
    <Animated.View
      entering={fadeIn}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]}
      accessibilityViewIsModal>
      <Screen testID="lock" footer={<Button label={t('lock.unlock')} onPress={() => void attempt()} testID="lock-unlock" />}>
        <View style={styles.center}>
          <Wordmark width={140} label={t('app.name')} />
          <Text variant="title" accessibilityRole="header">
            {t('lock.title')}
          </Text>
          {failed ? (
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
});
