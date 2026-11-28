import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useResource } from '../../api/resource';
import { useCan } from '../../auth/useAccess';
import { readMe } from '../../features/account/odoo';
import { setLockEnabled, useLock } from '../../lock/lock';
import { useLockLabel } from '../../lock/useLockLabel';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import { Row, Section, ToggleRow } from '../../ui/List';

export default function SecuritySettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const lock = useLock();
  const { method, label } = useLockLabel();
  const me = useResource('account.me', readMe, 60_000);
  const team = useCan('team');
  const more = <Icon name="forward" size={20} color={colors.inkFaint} />;
  const rows: { icon: IconName; title: string; detail?: string; href: Href; testID: string }[] = [
    ...(team ? [{ icon: 'lock' as const, title: t('security.password.title'), href: '/settings/password' as const, testID: 'security-password' }] : []),
    {
      icon: 'check',
      title: t('security.totp.title'),
      detail: me.data ? (me.data.totpEnabled ? t('security.totp.on') : t('security.totp.off')) : undefined,
      href: '/settings/two-step',
      testID: 'security-totp',
    },
    { icon: 'sign', title: t('security.passkeys.title'), href: '/settings/passkeys', testID: 'security-passkeys' },
    ...(team ? [{ icon: 'hash' as const, title: t('security.apiKeys.title'), href: '/settings/api-keys' as const, testID: 'security-api-keys' }] : []),
    { icon: 'phone', title: t('security.devices.title'), href: '/settings/devices', testID: 'security-devices' },
  ];
  return (
    <SettingsPage title={t('settings.security')} testID="settings-security-screen">
      {method ? (
        <Section title={t('security.thisPhone')}>
          <ToggleRow
            title={t('settings.appLock')}
            detail={t('settings.appLockHint', { method: label })}
            value={lock.enabled}
            onChange={(next) => void setLockEnabled(next, t('lock.prompt'), t('settings.cancel'))}
            testID="settings-app-lock"
          />
        </Section>
      ) : null}
      <Section title={t('security.account')}>
        {rows.map((row) => (
          <Row key={row.testID} leading={<RowIcon name={row.icon} />} title={row.title} detail={row.detail} trailing={more} onPress={() => router.push(row.href)} testID={row.testID} />
        ))}
      </Section>
    </SettingsPage>
  );
}
