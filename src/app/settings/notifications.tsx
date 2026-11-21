import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { pictureInPictureSupported } from '../../features/call/call';
import { setPictureInPictureAllowed, usePictureInPictureAllowed } from '../../features/call/pipSetting';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { Row, Section, ToggleRow } from '../../ui/List';

export default function NotificationSettings() {
  const { t } = useTranslation();
  const pipAllowed = usePictureInPictureAllowed();
  const pipShown = Platform.OS === 'ios' || pictureInPictureSupported();
  return (
    <SettingsPage title={t('settings.notifications')} testID="settings-notifications-screen">
      <Section>
        <Row leading={<RowIcon name="bell" />} title={t('settings.systemNotifications')} onPress={() => void Linking.openSettings()} testID="settings-system-notifications" />
      </Section>
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
