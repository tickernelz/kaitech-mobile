import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { discussSettings, readMe, setChannelNotifications, writeMe, type ChannelNotifications } from '../../features/account/odoo';
import { pictureInPictureSupported } from '../../features/call/call';
import { setPictureInPictureAllowed, usePictureInPictureAllowed } from '../../features/call/pipSetting';
import { useErrorText } from '../../features/discovery/ui';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { Check, Row, Section, ToggleRow } from '../../ui/List';
import { Text } from '../../ui/Text';

const channelChoices: ChannelNotifications[] = ['all', 'mentions', 'no_notif'];
const deliveryChoices = ['inbox', 'email'] as const;

export default function NotificationSettings() {
  const { t } = useTranslation();
  const { active } = useSession();
  const errorText = useErrorText();
  const pipAllowed = usePictureInPictureAllowed();
  const pipShown = Platform.OS === 'ios' || pictureInPictureSupported();
  const me = useResource('account.me', readMe, 60_000);
  const discuss = useResource('account.discuss', discussSettings, 60_000);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<unknown>, after: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await work();
      await after();
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title={t('settings.notifications')} testID="settings-notifications-screen">
      <Section>
        <Row leading={<RowIcon name="bell" />} title={t('settings.systemNotifications')} onPress={() => void Linking.openSettings()} testID="settings-system-notifications" />
      </Section>
      {active && me.data ? (
        <Section title={t('notifications.delivery')}>
          {deliveryChoices.map((value) => (
            <Row
              key={value}
              title={t(`notifications.deliveryChoice.${value}`)}
              trailing={<Check visible={me.data?.notificationType === value} />}
              selected={me.data?.notificationType === value}
              onPress={() => void run(() => writeMe(active, { notification_type: value }), me.refresh)}
              testID={`notifications-delivery-${value}`}
            />
          ))}
        </Section>
      ) : null}
      {active && discuss.data ? (
        <Section title={t('notifications.channels')}>
          {channelChoices.map((value) => (
            <Row
              key={value}
              title={t(`notifications.channelChoice.${value}`)}
              trailing={<Check visible={discuss.data?.channelNotifications === value} />}
              selected={discuss.data?.channelNotifications === value}
              onPress={() => {
                const settings = discuss.data;
                if (settings) void run(() => setChannelNotifications(active, settings.id, value), discuss.refresh);
              }}
              testID={`notifications-channels-${value}`}
            />
          ))}
        </Section>
      ) : null}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="notifications-error">
          {failed}
        </Text>
      ) : null}
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
    </SettingsPage>
  );
}
