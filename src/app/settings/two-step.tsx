import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readMe } from '../../features/account/odoo';
import { disableTotp, enableTotp, openTotp, totpSecretGroups, totpSetup, type TotpSetup } from '../../features/account/security';
import { useIdentity } from '../../features/account/useIdentity';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { SettingsPage } from '../../screens/SettingsPage';
import { radius, space, stroke, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { confirm } from '../../ui/dialog';

export default function TwoStepSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const identity = useIdentity();
  const me = useResource('account.me', readMe, 60_000);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!active) return null;

  const guard = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    try {
      await work();
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    guard(async () => {
      const next = await identity.run(() => openTotp(active), (action) => totpSetup(active, action));
      if (next) setSetup(next);
    });

  const enable = () =>
    guard(async () => {
      if (!setup) return;
      const enabled = await identity.run(() => enableTotp(active, setup.wizardId, code), () => true);
      if (!enabled) return;
      setSetup(null);
      setCode('');
      await me.refresh();
    });

  const disable = async () => {
    const go = await confirm({ body: t('security.totp.disableConfirm'), cancel: t('settings.cancel'), confirm: t('security.totp.disable'), danger: true, icon: 'lock', testID: 'totp-disable-dialog' });
    if (!go) return;
    await guard(async () => {
      await identity.run(() => disableTotp(active), () => true);
      await me.refresh();
    });
  };

  return (
    <SettingsPage title={t('security.totp.title')} testID="settings-totp-screen">
      {!me.data ? (
        <StateView loading={me.loading} error={me.error} onRetry={() => void me.refresh()} testID="totp" />
      ) : me.data.totpEnabled ? (
        <View style={styles.body}>
          <Text variant="body" testID="totp-enabled">
            {t('security.totp.enabledBody')}
          </Text>
          <Button kind="danger" label={t('security.totp.disable')} busy={busy} onPress={disable} testID="totp-disable" />
        </View>
      ) : setup ? (
        <View style={styles.body}>
          <Text variant="body">{t('security.totp.scan')}</Text>
          {setup.qrcode ? (
            <View style={[styles.qr, { borderColor: colors.line }]}>
              <Image source={{ uri: `data:image/png;base64,${setup.qrcode}` }} style={styles.qrImage} accessibilityLabel={t('security.totp.qr')} testID="totp-qr" />
            </View>
          ) : null}
          {setup.url ? <Button kind="secondary" label={t('security.totp.openApp')} onPress={() => void Linking.openURL(setup.url).catch(() => setFailed(t('security.totp.noApp')))} testID="totp-open-app" /> : null}
          <Text variant="footnote" tone="inkSoft">
            {t('security.totp.manual')}
          </Text>
          <Text variant="headline" selectable testID="totp-secret">
            {totpSecretGroups(setup.secret)}
          </Text>
          <Button
            kind="plain"
            label={copied ? t('security.totp.copied') : t('security.totp.copy')}
            onPress={() => void Clipboard.setStringAsync(setup.secret.replace(/\s+/g, '')).then(() => setCopied(true))}
            testID="totp-copy"
          />
          <TextField label={t('security.totp.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={7} testID="totp-code" />
          <Button label={t('security.totp.enable')} busy={busy} disabled={code.replace(/\s+/g, '').length < 6} onPress={() => void enable()} testID="totp-enable" />
        </View>
      ) : (
        <View style={styles.body}>
          <Text variant="body" testID="totp-disabled">
            {t('security.totp.disabledBody')}
          </Text>
          <Button label={t('security.totp.start')} busy={busy} onPress={() => void start()} testID="totp-start" />
        </View>
      )}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="totp-error">
          {failed}
        </Text>
      ) : null}
      {identity.sheet}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  qr: { alignSelf: 'center', padding: space.md, borderRadius: radius.card, borderWidth: stroke.thin, backgroundColor: '#ffffff' },
  qrImage: { width: 200, height: 200 },
});
