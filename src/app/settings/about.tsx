import * as Application from 'expo-application';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SettingsPage } from '../../screens/SettingsPage';
import { space } from '../../theme';
import { Row, Section } from '../../ui/List';
import { Wordmark } from '../../ui/Wordmark';

export default function AboutSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPage title={t('settings.about')} testID="settings-about-screen">
      <View style={styles.mark}>
        <Wordmark width={160} label={t('app.name')} />
      </View>
      <Section>
        <Row title={t('settings.version', { version: Application.nativeApplicationVersion ?? '', build: Application.nativeBuildVersion ?? '' })} testID="settings-version" />
      </Section>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', paddingVertical: space.lg },
});
