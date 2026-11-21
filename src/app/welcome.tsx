import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { defaultServer } from '../auth/signIn';
import { useSignIn } from '../auth/useSignIn';
import { setLanguagePreference, useLanguage } from '../i18n';
import { space } from '../theme';
import { duration, easing, stagger, useMotion } from '../theme/motion';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Wordmark } from '../ui/Wordmark';

function stay() {}

function rise(order: number) {
  return FadeInDown.duration(duration.hero)
    .delay(order * stagger)
    .easing(easing.expo)
    .withInitialValues({ transform: [{ translateY: 8 }] });
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const other = language === 'id' ? 'en' : 'id';
  const markIn = useMotion(FadeIn.duration(duration.hero).easing(easing.expo));
  const titleIn = useMotion(rise(1));
  const footerIn = useMotion(rise(2));
  const [preset] = useState(defaultServer);
  const { busy, error, start } = useSignIn(stay);
  const signIn = () => (preset ? void start(preset.server, preset.database) : router.push('/sign-in'));
  return (
    <Screen
      scroll
      testID="welcome"
      footer={
        <Animated.View entering={footerIn} style={styles.footer}>
          {error ? (
            <Text tone="dangerInk" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="welcome-error">
              {t(`errors.${error}`)}
            </Text>
          ) : null}
          <Button
            label={busy ? t('signIn.finishing') : t('welcome.signIn')}
            accessibilityHint={preset ? t('signIn.continueHint') : undefined}
            busy={busy}
            onPress={signIn}
            testID="welcome-sign-in"
          />
          {preset ? (
            <Button
              kind="plain"
              label={t('signIn.otherServer')}
              onPress={() => router.push({ pathname: '/sign-in', params: { custom: '1' } })}
              disabled={busy}
              testID="welcome-other-server"
            />
          ) : null}
          <Button
            kind="plain"
            label={t('language.switchTo', { language: t(`language.${other}`) })}
            onPress={() => setLanguagePreference(other)}
            disabled={busy}
            testID="welcome-language"
          />
        </Animated.View>
      }>
      <View style={styles.hero}>
        <Animated.View entering={markIn}>
          <Wordmark width={176} label={t('app.name')} />
        </Animated.View>
        <Animated.View entering={titleIn}>
          <Text variant="display" accessibilityRole="header" testID="welcome-title">
            {t('welcome.title')}
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: space.lg },
  footer: { gap: space.xs },
});
