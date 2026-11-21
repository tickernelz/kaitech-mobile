import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/session';
import { changePassword, openPasswordChange } from '../../features/account/security';
import { useIdentity } from '../../features/account/useIdentity';
import { useErrorText } from '../../features/discovery/ui';
import { SettingsPage } from '../../screens/SettingsPage';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';

export default function PasswordSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useSession();
  const errorText = useErrorText();
  const identity = useIdentity();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!active) return null;
  const mismatch = confirmation.length > 0 && confirmation !== password;

  const submit = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const allowed = await identity.run(() => openPasswordChange(active), () => true);
      if (!allowed) return;
      const changed = await identity.run(() => changePassword(active, password, confirmation), () => true);
      if (changed) {
        setDone(true);
        setPassword('');
        setConfirmation('');
      }
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title={t('security.password.title')} testID="settings-password-screen">
      <View style={styles.body}>
        <Text variant="footnote" tone="inkSoft">
          {t('security.password.hint')}
        </Text>
        <TextField label={t('security.password.new')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" testID="password-new" />
        <TextField
          label={t('security.password.confirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
          error={mismatch ? t('security.password.mismatch') : null}
          testID="password-confirm"
        />
        {failed ? (
          <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="password-error">
            {failed}
          </Text>
        ) : null}
        {done ? (
          <Text variant="footnote" tone="okInk" accessibilityLiveRegion="polite" testID="password-done">
            {t('security.password.done')}
          </Text>
        ) : null}
        <Button label={t('security.password.save')} busy={busy} disabled={!password || mismatch || confirmation !== password} onPress={() => void submit()} testID="password-save" />
        {done ? <Button kind="plain" label={t('settings.back')} onPress={() => router.back()} testID="password-back" /> : null}
      </View>
      {identity.sheet}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ body: { gap: space.md } });
