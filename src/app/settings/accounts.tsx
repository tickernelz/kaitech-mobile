import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { switchAccount, useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { SettingsPage } from '../../screens/SettingsPage';
import { Check, Divider, Row, Section } from '../../ui/List';

function host(origin: string): string {
  return origin.replace(/^https:\/\//, '');
}

export default function AccountSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accounts, active } = useSession();
  const { date } = useFormatters();
  if (!active) return null;
  const others = accounts.filter((account) => account.id !== active.id);
  return (
    <SettingsPage title={t('settings.accountsAndServer')} testID="settings-accounts-screen">
      <Section title={t('settings.account')}>
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
            <Row title={account.name} detail={`${account.login} · ${host(account.origin)}`} onPress={() => switchAccount(account.id)} trailing={<Check visible={false} />} />
          </View>
        ))}
        <Divider />
        <Row title={t('settings.addAccount')} tone="link" onPress={() => router.push('/add-account')} testID="settings-add-account" />
      </Section>
    </SettingsPage>
  );
}
