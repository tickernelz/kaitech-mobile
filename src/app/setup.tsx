import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { markOnboarded } from '../auth/session';
import { setLockEnabled, useLock } from '../lock/lock';
import { useLockLabel } from '../lock/useLockLabel';
import { LanguageChoices } from '../screens/LanguageChoices';
import { space } from '../theme';
import { duration, easing } from '../theme/motion';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';

type Step = 'language' | 'lock';

export default function Setup() {
  const { t } = useTranslation();
  const lock = useLock();
  const { method, label, ready } = useLockLabel();
  const [step, setStep] = useState<Step>('language');
  const [busy, setBusy] = useState(false);
  const steps: Step[] = method ? ['language', 'lock'] : ['language'];
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const enter = SlideInRight.duration(duration.axis).easing(easing.expo).reduceMotion(ReduceMotion.System);
  const exit = SlideOutLeft.duration(duration.slow).easing(easing.exit).reduceMotion(ReduceMotion.System);

  const turnOnLock = async () => {
    setBusy(true);
    try {
      if (await setLockEnabled(true, t('lock.prompt'), t('settings.cancel'))) markOnboarded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      testID="setup"
      footer={
        step === 'lock' && !lock.enabled ? (
          <>
            <Button label={t('wizard.lockEnable')} busy={busy} onPress={() => void turnOnLock()} testID="setup-lock-enable" />
            <Button kind="plain" label={t('wizard.lockLater')} onPress={markOnboarded} disabled={busy} testID="setup-lock-later" />
          </>
        ) : (
          <Button
            label={last ? t('wizard.done') : t('wizard.next')}
            disabled={!ready}
            onPress={() => (last ? markOnboarded() : setStep(steps[index + 1]))}
            testID="setup-next"
          />
        )
      }>
      <View style={styles.top}>
        <Text variant="label" tone="inkSoft" testID="setup-step">
          {t('wizard.step', { current: index + 1, total: steps.length })}
        </Text>
        <Button kind="plain" label={t('wizard.skip')} onPress={markOnboarded} style={styles.skip} testID="setup-skip" />
      </View>
      <Animated.View key={step} entering={index === 0 ? FadeIn.duration(duration.hero) : enter} exiting={exit} style={styles.step}>
        {step === 'language' ? (
          <>
            <Text variant="title" accessibilityRole="header">
              {t('wizard.languageTitle')}
            </Text>
            <Text tone="inkSoft">{t('wizard.languageBody')}</Text>
            <LanguageChoices />
          </>
        ) : (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.step}>
            <Text variant="title" accessibilityRole="header">
              {t('wizard.lockTitle')}
            </Text>
            <Text tone="inkSoft">{t('wizard.lockBody', { method: label })}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { minHeight: 44, paddingHorizontal: space.sm },
  step: { gap: space.lg },
});
