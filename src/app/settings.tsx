import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { signOut, switchAccount, useSession } from '../auth/session';
import { pictureInPictureSupported } from '../features/call/call';
import { setPictureInPictureAllowed, usePictureInPictureAllowed } from '../features/call/pipSetting';
import { useFormatters } from '../i18n';
import { setLockEnabled, useLock } from '../lock/lock';
import { useLockLabel } from '../lock/useLockLabel';
import { LanguageChoices } from '../screens/LanguageChoices';
import { space } from '../theme';
import { IconButton } from '../features/discovery/ui';
import { Button } from '../ui/Button';
import { Check, Divider, Row, Section, ToggleRow } from '../ui/List';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accounts, active } = useSession();
  const lock = useLock();
  const { method, label } = useLockLabel();
  const { date } = useFormatters();
  const [busy, setBusy] = useState(false);
  const pipAllowed = usePictureInPictureAllowed();
  if (!active) return null;
  const pipShown = Platform.OS === 'ios' || pictureInPictureSupported();
  const others = accounts.filter((account) => account.id !== active.id);
  const host = (origin: string) => origin.replace(/^https:\/\//, '');
  const version = Application.nativeApplicationVersion ?? '';
  const build = Application.nativeBuildVersion ?? '';

  const confirmSignOut = () => {
    Alert.alert(t('settings.signOutTitle', { name: active.name }), t('settings.signOutBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void signOut(active.id)
            .then((result) => {
              if (result === 'local') Alert.alert(t('settings.signOut'), t('settings.signOutOffline'));
            })
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  return (
    <Screen scroll testID="settings" contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {t('settings.title')}
        </Text>
        <IconButton icon="close" label={t('settings.close')} onPress={() => router.back()} testID="settings-close" />
      </View>
      <Section title={t('settings.account')}>
        <Row title={active.name} detail={active.login} />
        <Divider />
        <Row title={t('settings.server')} detail={host(active.origin)} />
        <Divider />
        <Row title={t('settings.database')} detail={active.db} />
        <Divider />
        <Row title={t('settings.signedInSince', { date: date(active.signedInAt) })} />
      </Section>
      <Section title={t('settings.accounts')}>
        <Row title={active.name} detail={`${active.login} · ${host(active.origin)}`} trailing={<Check visible />} />
        {others.map((account) => (
          <View key={account.id}>
            <Divider />
            <Row
              title={account.name}
              detail={`${account.login} · ${host(account.origin)}`}
              onPress={() => switchAccount(account.id)}
              trailing={<Check visible={false} />}
            />
          </View>
        ))}
        <Divider />
        <Row title={t('settings.addAccount')} tone="link" onPress={() => router.push('/add-account')} testID="settings-add-account" />
      </Section>
      <LanguageChoices title={t('settings.language')} />
      {pipShown ? (
        <Section title={t('settings.calls')}>
          <ToggleRow
            title={t('settings.pictureInPicture')}
            detail={t('settings.pictureInPictureHint')}
            value={pipAllowed}
            onChange={setPictureInPictureAllowed}
            testID="settings-picture-in-picture"
          />
        </Section>
      ) : null}
      {method ? (
        <Section title={t('settings.security')}>
          <ToggleRow
            title={t('settings.appLock')}
            detail={t('settings.appLockHint', { method: label })}
            value={lock.enabled}
            onChange={(next) => void setLockEnabled(next, t('lock.prompt'), t('settings.cancel'))}
            testID="settings-app-lock"
          />
        </Section>
      ) : null}
      <Button kind="danger" label={t('settings.signOut')} busy={busy} onPress={confirmSignOut} testID="settings-sign-out" />
      <Text variant="footnote" tone="inkFaint" style={styles.version}>
        {t('settings.version', { version, build })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxxl, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { textAlign: 'center' },
});
