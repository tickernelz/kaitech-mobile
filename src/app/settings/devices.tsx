import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { devices, revokeAllDevices, revokeDevice, type Device } from '../../features/account/security';
import { parseServerDate } from '../../features/discovery/dates';
import { useIdentity } from '../../features/account/useIdentity';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { useFormatters } from '../../i18n';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';

export default function DeviceSettings() {
  const { t } = useTranslation();
  const { active } = useSession();
  const { date } = useFormatters();
  const errorText = useErrorText();
  const identity = useIdentity();
  const list = useResource('account.devices', devices, 30_000);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!active) return null;

  const guard = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await work();
      await list.refresh();
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const revoke = (device: Device) =>
    Alert.alert('', t('security.devices.revokeConfirm', { name: titleOf(device) }), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('security.devices.revoke'), style: 'destructive', onPress: () => void guard(() => identity.run(() => revokeDevice(active, device.id), () => true)) },
    ]);

  const revokeAll = () =>
    Alert.alert('', t('security.devices.revokeAllConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('security.devices.revokeAll'), style: 'destructive', onPress: () => void guard(() => identity.run(() => revokeAllDevices(active), () => true)) },
    ]);

  return (
    <SettingsPage title={t('security.devices.title')} testID="settings-devices-screen">
      {list.data?.length ? (
        <Section>
          {list.data.map((device) => {
            const last = parseServerDate(device.last);
            return (
              <Row
                key={device.id}
                leading={<RowIcon name={device.type === 'mobile' ? 'phone' : 'table'} />}
                title={device.current ? t('security.devices.current', { name: titleOf(device) }) : titleOf(device)}
                detail={[device.place || device.ip, last ? date(last) : ''].filter(Boolean).join(' · ')}
                onPress={device.current ? undefined : () => revoke(device)}
                testID={`device-${device.id}`}
              />
            );
          })}
        </Section>
      ) : (
        <StateView loading={list.loading} error={list.error} empty={{ title: t('security.devices.none'), icon: 'phone' }} onRetry={() => void list.refresh()} testID="devices" />
      )}
      {list.data && list.data.some((device) => !device.current) ? (
        <Button kind="danger" label={t('security.devices.revokeAll')} busy={busy} onPress={revokeAll} testID="devices-revoke-all" />
      ) : null}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="devices-error">
          {failed}
        </Text>
      ) : null}
      {identity.sheet}
    </SettingsPage>
  );
}

function titleOf(device: Device): string {
  return [device.platform, device.browser].filter(Boolean).join(' · ') || device.ip;
}
