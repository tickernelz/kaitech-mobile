import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { deletePasskey, passkeys, renamePasskey, type Passkey } from '../../features/account/security';
import { useIdentity } from '../../features/account/useIdentity';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { useFormatters } from '../../i18n';
import { SettingsPage } from '../../screens/SettingsPage';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Sheet, SheetItem } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { parseServerDate } from '../../features/discovery/dates';

export default function PasskeySettings() {
  const { t } = useTranslation();
  const { active } = useSession();
  const { date } = useFormatters();
  const errorText = useErrorText();
  const identity = useIdentity();
  const list = useResource('account.passkeys', passkeys, 60_000);
  const [open, setOpen] = useState<Passkey | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!active) return null;

  const guard = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await work();
      setOpen(null);
      await list.refresh();
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = (key: Passkey) =>
    Alert.alert('', t('security.passkeys.deleteConfirm', { name: key.name }), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('security.passkeys.delete'), style: 'destructive', onPress: () => void guard(() => identity.run(() => deletePasskey(active, key.id), () => true)) },
    ]);

  return (
    <SettingsPage title={t('security.passkeys.title')} testID="settings-passkeys-screen">
      <Text variant="footnote" tone="inkSoft">
        {t('security.passkeys.hint')}
      </Text>
      {list.data?.length ? (
        <Section>
          {list.data.map((key) => {
            const created = parseServerDate(key.created);
            return (
              <Row
                key={key.id}
                title={key.name}
                detail={created ? t('security.passkeys.created', { date: date(created) }) : undefined}
                onPress={() => {
                  setName(key.name);
                  setOpen(key);
                }}
                testID={`passkey-${key.id}`}
              />
            );
          })}
        </Section>
      ) : (
        <StateView loading={list.loading} error={list.error} empty={{ title: t('security.passkeys.none'), icon: 'sign' }} onRetry={() => void list.refresh()} testID="passkeys" />
      )}
      <Text variant="footnote" tone="inkSoft" testID="passkeys-add-hint">
        {t('security.passkeys.addLater')}
      </Text>
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="passkeys-error">
          {failed}
        </Text>
      ) : null}
      {open ? (
        <Sheet title={open.name} onClose={() => setOpen(null)} testID="passkey-sheet">
          <View style={styles.body}>
            <TextField label={t('security.passkeys.name')} value={name} onChangeText={setName} maxLength={64} testID="passkey-name" />
            <Button label={t('security.passkeys.rename')} busy={busy} disabled={!name.trim() || name.trim() === open.name} onPress={() => void guard(() => renamePasskey(active, open.id, name))} testID="passkey-rename" />
          </View>
          <SheetItem icon="trash" label={t('security.passkeys.delete')} onPress={() => remove(open)} danger disabled={busy} testID="passkey-delete" />
        </Sheet>
      ) : null}
      {identity.sheet}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ body: { gap: space.md, paddingBottom: space.sm } });
