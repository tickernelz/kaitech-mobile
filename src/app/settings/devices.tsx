import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResource } from '../../api/resource';
import { markExpired, useSession } from '../../auth/session';
import { appDevices, devices, revokeAllDevices, revokeAppDevice, revokeDevice, type AppDevice, type Device } from '../../features/account/security';
import { useIdentity } from '../../features/account/useIdentity';
import { parseServerDate } from '../../features/discovery/dates';
import { StateView, useErrorText } from '../../features/discovery/ui';
import { useFormatters } from '../../i18n';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { confirm } from '../../ui/dialog';

const previewCount = 10;
const pageCount = 20;

export default function DeviceSettings() {
  const { t } = useTranslation();
  const { active } = useSession();
  const { date } = useFormatters();
  const errorText = useErrorText();
  const identity = useIdentity();
  const apps = useResource('account.appDevices', appDevices, 30_000);
  const browsers = useResource('account.devices', devices, 30_000);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [appCount, setAppCount] = useState(previewCount);
  const [browserCount, setBrowserCount] = useState(previewCount);
  if (!active) return null;

  const guard = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await work();
      await Promise.all([apps.refresh(), browsers.refresh()]);
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const revoke = (body: string, testID: string) => confirm({ body, cancel: t('settings.cancel'), confirm: t('security.devices.revoke'), danger: true, icon: 'leave', testID });

  const revokeApp = async (device: AppDevice) => {
    if (await revoke(t('security.devices.revokeAppConfirm', { name: device.name || device.platform }), 'device-revoke-app-dialog')) await guard(() => revokeAppDevice(active, device.id));
  };

  const revokeBrowser = async (device: Device) => {
    if (await revoke(t('security.devices.revokeConfirm', { name: titleOf(device) }), 'device-revoke-dialog')) await guard(() => identity.run(() => revokeDevice(active, device.id), () => true));
  };

  const revokeAll = async () => {
    const go = await confirm({
      title: t('security.devices.revokeAll'),
      body: t('security.devices.revokeAllConfirm'),
      cancel: t('settings.cancel'),
      confirm: t('security.devices.revokeAll'),
      danger: true,
      icon: 'leave',
      testID: 'devices-revoke-all-dialog',
    });
    if (!go) return;
    await guard(async () => {
      const done = await identity.run(() => revokeAllDevices(active), () => true);
      if (done) markExpired(active.id);
    });
  };

  const others = (apps.data ?? []).filter((device) => !device.current);
  const shownApps = (apps.data ?? []).slice(0, appCount);
  const shownBrowsers = (browsers.data ?? []).slice(0, browserCount);
  const moreApps = (apps.data?.length ?? 0) - shownApps.length;
  const moreBrowsers = (browsers.data?.length ?? 0) - shownBrowsers.length;
  return (
    <SettingsPage title={t('security.devices.title')} testID="settings-devices-screen">
      <Button kind="danger" label={t('security.devices.revokeAll')} busy={busy} onPress={revokeAll} testID="devices-revoke-all" />
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="devices-error">
          {failed}
        </Text>
      ) : null}
      <Section title={t('security.devices.apps')}>
        {apps.data?.length ? (
          shownApps.map((device) => {
            const last = parseServerDate(device.lastUsedAt) ?? parseServerDate(device.signedInAt);
            const name = device.name || device.platform;
            return (
              <Row
                key={device.id}
                leading={<RowIcon name="phone" />}
                title={device.current ? t('security.devices.current', { name }) : name}
                detail={last ? date(last) : undefined}
                onPress={device.current ? undefined : () => revokeApp(device)}
                testID={`app-device-${device.id}`}
              />
            );
          })
        ) : (
          <StateView loading={apps.loading} error={apps.error} empty={{ title: t('security.devices.none'), icon: 'phone' }} onRetry={() => void apps.refresh()} testID="app-devices" />
        )}
        {moreApps > 0 ? <Row title={t('security.devices.showMore', { count: Math.min(moreApps, pageCount) })} tone="link" onPress={() => setAppCount((count) => count + pageCount)} testID="app-devices-more" /> : null}
      </Section>
      {others.length ? (
        <Text variant="footnote" tone="inkSoft">
          {t('security.devices.appsHint')}
        </Text>
      ) : null}
      <Section title={t('security.devices.browsers')}>
        {browsers.data?.length ? (
          shownBrowsers.map((device) => {
            const last = parseServerDate(device.last);
            return (
              <Row
                key={device.id}
                leading={<RowIcon name={device.type === 'mobile' ? 'phone' : 'table'} />}
                title={device.current ? t('security.devices.current', { name: titleOf(device) }) : titleOf(device)}
                detail={[device.place || device.ip, last ? date(last) : ''].filter(Boolean).join(' \u00b7 ')}
                onPress={device.current ? undefined : () => revokeBrowser(device)}
                testID={`device-${device.id}`}
              />
            );
          })
        ) : (
          <StateView loading={browsers.loading} error={browsers.error} empty={{ title: t('security.devices.none'), icon: 'table' }} onRetry={() => void browsers.refresh()} testID="devices" />
        )}
        {moreBrowsers > 0 ? <Row title={t('security.devices.showMore', { count: Math.min(moreBrowsers, pageCount) })} tone="link" onPress={() => setBrowserCount((count) => count + pageCount)} testID="devices-more" /> : null}
      </Section>
      <Text variant="footnote" tone="inkSoft">
        {t('security.devices.browsersHint')}
      </Text>
      {identity.sheet}
    </SettingsPage>
  );
}

function titleOf(device: Device): string {
  return [device.platform, device.browser].filter(Boolean).join(' \u00b7 ') || device.ip;
}
