import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { signOut, useSession } from '../../auth/session';
import { Avatar } from '../../features/chat/ui/Avatar';
import { useLockLabel } from '../../lock/useLockLabel';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/icons';
import { Divider, Row, Section } from '../../ui/List';

type Entry = { icon: IconName; title: string; href: Href; testID: string };

export default function Settings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const { method } = useLockLabel();
  const [busy, setBusy] = useState(false);
  if (!active) return null;
  const more = <Icon name="forward" size={20} color={colors.inkFaint} />;
  const entries: Entry[] = [
    { icon: 'image', title: t('settings.appearance'), href: '/settings/appearance', testID: 'settings-appearance' },
    { icon: 'bell', title: t('settings.notifications'), href: '/settings/notifications', testID: 'settings-notifications' },
    { icon: 'people', title: t('settings.accountsAndServer'), href: '/settings/accounts', testID: 'settings-accounts' },
    ...(method ? [{ icon: 'eye' as const, title: t('settings.security'), href: '/settings/security' as const, testID: 'settings-security' }] : []),
    { icon: 'chat', title: t('settings.language'), href: '/settings/language', testID: 'settings-language' },
    { icon: 'bulb', title: t('settings.about'), href: '/settings/about', testID: 'settings-about' },
  ];

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
    <SettingsPage root title={t('settings.title')} testID="settings">
      <Section>
        <Row
          leading={<Avatar name={active.name} seed={active.partnerId} partnerId={active.partnerId} size={56} />}
          title={active.name}
          detail={active.login}
          trailing={more}
          onPress={() => router.push('/settings/profile')}
          testID="settings-profile"
        />
      </Section>
      <Section>
        {entries.map((entry, index) => (
          <View key={entry.testID}>
            {index ? <Divider /> : null}
            <Row leading={<RowIcon name={entry.icon} />} title={entry.title} trailing={more} onPress={() => router.push(entry.href)} testID={entry.testID} />
          </View>
        ))}
      </Section>
      <Button kind="danger" label={t('settings.signOut')} busy={busy} onPress={confirmSignOut} testID="settings-sign-out" />
    </SettingsPage>
  );
}
