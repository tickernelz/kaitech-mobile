import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { errorCodeOf, type ErrorCode } from '../auth/errors';
import { removeAccount, useSession } from '../auth/session';
import { signIn } from '../auth/signIn';
import { useLanguage } from '../i18n';
import { space } from '../theme';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';

export default function Expired() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { active } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  if (!active) return null;
  const host = active.origin.replace(/^https:\/\//, '');

  const again = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(active.origin, active.db, language);
    } catch (caught) {
      setError(errorCodeOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      testID="expired"
      footer={
        <>
          {error ? (
            <Text tone="dangerInk" accessibilityRole="alert">
              {t(`errors.${error}`)}
            </Text>
          ) : null}
          <Button label={t('expired.signIn')} busy={busy} onPress={() => void again()} testID="expired-sign-in" />
          <Button kind="plain" label={t('expired.remove')} disabled={busy} onPress={() => void removeAccount(active.id)} />
        </>
      }>
      <View style={styles.center}>
        <Text variant="title" accessibilityRole="header">
          {t('expired.title')}
        </Text>
        <Text tone="inkSoft">{t('expired.body', { server: host })}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: space.md },
});
