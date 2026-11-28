import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { signOut, useSession } from '../../auth/session';
import { useCan } from '../../auth/useAccess';
import { Avatar } from '../../features/chat/ui/Avatar';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/icons';
import { Divider, Row, Section } from '../../ui/List';
import { confirm, notify } from '../../ui/dialog';

type Entry = { icon: IconName; title: string; href: Href; testID: string };

export default function Settings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const [busy, setBusy] = useState(false);
  const manages = useCan('users.manage');
  if (!active) return null;
  const more = <Icon name="forward" size={20} color={colors.inkFaint} />;
  const entries: Entry[] = [
    ...(manages ? [{ icon: 'people' as const, title: t('users.title'), href: '/settings/users' as const, testID: 'settings-users' }] : []),
    { icon: 'people', title: t('account.title'), href: '/settings/account', testID: 'settings-account' },
    { icon: 'image', title: t('settings.appearance'), href: '/settings/appearance', testID: 'settings-appearance' },
    { icon: 'bell', title: t('settings.notifications'), href: '/settings/notifications', testID: 'settings-notifications' },
    { icon: 'people', title: t('settings.accountsAndServer'), href: '/settings/accounts', testID: 'settings-accounts' },
    { icon: 'lock', title: t('settings.security'), href: '/settings/security', testID: 'settings-security' },
    { icon: 'chat', title: t('settings.language'), href: '/settings/language', testID: 'settings-language' },
    { icon: 'bulb', title: t('settings.about'), href: '/settings/about', testID: 'settings-about' },
  ];

  const confirmSignOut = async () => {
    const go = await confirm({
      title: t('settings.signOutTitle', { name: active.name }),
      body: t('settings.signOutBody'),
      cancel: t('settings.cancel'),
      confirm: t('settings.signOut'),
      danger: true,
      icon: 'leave',
      testID: 'sign-out-dialog',
    });
    if (!go) return;
    setBusy(true);
    void signOut(active.id)
      .then((result) => {
        if (result === 'local') notify(t('settings.signOutOffline'));
      })
      .finally(() => setBusy(false));
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
