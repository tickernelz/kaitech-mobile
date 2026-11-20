import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { setLanguagePreference, useLanguage } from '../i18n';
import { space } from '../theme';
import { duration, easing, stagger } from '../theme/motion';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Wordmark } from '../ui/Wordmark';

function rise(order: number) {
  return FadeInDown.duration(duration.hero)
    .delay(order * stagger)
    .easing(easing.expo)
    .withInitialValues({ transform: [{ translateY: 8 }] })
    .reduceMotion(ReduceMotion.System);
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useLanguage();
  const other = language === 'id' ? 'en' : 'id';
  return (
    <Screen
      scroll
      testID="welcome"
      footer={
        <Animated.View entering={rise(3)} style={styles.footer}>
          <Button label={t('welcome.signIn')} onPress={() => router.push('/sign-in')} testID="welcome-sign-in" />
          <Button
            kind="plain"
            label={t('language.switchTo', { language: t(`language.${other}`) })}
            onPress={() => setLanguagePreference(other)}
            testID="welcome-language"
          />
        </Animated.View>
      }>
      <View style={styles.hero}>
        <Animated.View entering={FadeIn.duration(duration.hero).easing(easing.expo).reduceMotion(ReduceMotion.System)}>
          <Wordmark width={176} label={t('app.name')} />
        </Animated.View>
        <Animated.View entering={rise(1)}>
          <Text variant="display" accessibilityRole="header" testID="welcome-title">
            {t('welcome.title')}
          </Text>
        </Animated.View>
        <Animated.View entering={rise(2)}>
          <Text tone="inkSoft">{t('welcome.body')}</Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: space.lg },
  footer: { gap: space.xs },
});
