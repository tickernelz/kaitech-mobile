import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { apiKeyDurations, apiKeyFrom, apiKeys, makeApiKey, openApiKey, removeApiKey, type ApiKey } from '../../features/account/security';
import { parseServerDate } from '../../features/discovery/dates';
import { useIdentity } from '../../features/account/useIdentity';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { useFormatters } from '../../i18n';
import { teamOnly } from '../../screens/Gate';
import { SettingsPage } from '../../screens/SettingsPage';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Row, Section } from '../../ui/List';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { confirm } from '../../ui/dialog';

export default teamOnly(ApiKeySettings);

function ApiKeySettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const { date } = useFormatters();
  const errorText = useErrorText();
  const identity = useIdentity();
  const list = useResource('account.apiKeys', apiKeys, 60_000);
  const durations = useResource('account.apiKeyDurations', apiKeyDurations, 3_600_000);
  const [form, setForm] = useState<{ name: string; duration: string } | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
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
      const allowed = await identity.run(() => openApiKey(active), () => true);
      if (allowed) setForm({ name: '', duration: durations.data?.[0]?.value ?? '1' });
    });

  const create = () =>
    guard(async () => {
      if (!form) return;
      const key = await identity.run(() => makeApiKey(active, form.name, form.duration), apiKeyFrom);
      if (!key) return;
      setForm(null);
      setCopied(false);
      setMade(key);
      await list.refresh();
    });

  const remove = async (key: ApiKey) => {
    const go = await confirm({ body: t('security.apiKeys.deleteConfirm', { name: key.name }), cancel: t('settings.cancel'), confirm: t('security.apiKeys.delete'), danger: true, icon: 'trash', testID: 'api-key-delete-dialog' });
    if (!go) return;
    await guard(async () => {
      await identity.run(() => removeApiKey(active, key.id), () => true);
      await list.refresh();
    });
  };

  return (
    <SettingsPage title={t('security.apiKeys.title')} testID="settings-api-keys-screen">
      <Text variant="footnote" tone="inkSoft">
        {t('security.apiKeys.hint')}
      </Text>
      {list.data?.length ? (
        <Section>
          {list.data.map((key) => {
            const created = parseServerDate(key.created);
            const expires = parseServerDate(key.expires);
            return (
              <Row
                key={key.id}
                title={key.name}
                detail={[created ? t('security.apiKeys.created', { date: date(created) }) : '', expires ? t('security.apiKeys.expires', { date: date(expires) }) : ''].filter(Boolean).join(' · ')}
                onPress={() => remove(key)}
                testID={`api-key-${key.id}`}
              />
            );
          })}
        </Section>
      ) : (
        <StateView loading={list.loading} error={list.error} empty={{ title: t('security.apiKeys.none'), icon: 'hash' }} onRetry={() => void list.refresh()} testID="api-keys" />
      )}
      <Button label={t('security.apiKeys.add')} busy={busy && !form} onPress={() => void start()} testID="api-key-add" />
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="api-keys-error">
          {failed}
        </Text>
      ) : null}
      {form ? (
        <Sheet title={t('security.apiKeys.add')} onClose={() => setForm(null)} testID="api-key-sheet">
          <View style={styles.body}>
            <TextField label={t('security.apiKeys.name')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoFocus testID="api-key-name" />
            <Text variant="label" tone="inkSoft">
              {t('security.apiKeys.duration')}
            </Text>
            {(durations.data ?? []).map((option) => (
              <Row
                key={option.value}
                title={option.label}
                trailing={<Check visible={form.duration === option.value} />}
                selected={form.duration === option.value}
                onPress={() => setForm({ ...form, duration: option.value })}
                testID={`api-key-duration-${option.value}`}
              />
            ))}
            <Button label={t('security.apiKeys.create')} busy={busy} disabled={!form.name.trim()} onPress={() => void create()} testID="api-key-create" />
          </View>
        </Sheet>
      ) : null}
      {made ? (
        <Sheet title={t('security.apiKeys.ready')} detail={t('security.apiKeys.readyHint')} onClose={() => setMade(null)} testID="api-key-made">
          <View style={[styles.key, { borderColor: colors.line, backgroundColor: colors.surface2 }]}>
            <Text variant="callout" selectable testID="api-key-value">
              {made}
            </Text>
          </View>
          <Button label={copied ? t('security.apiKeys.copied') : t('security.apiKeys.copy')} onPress={() => void Clipboard.setStringAsync(made).then(() => setCopied(true))} testID="api-key-copy" />
        </Sheet>
      ) : null}
      {identity.sheet}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.sm },
  key: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.md },
});
