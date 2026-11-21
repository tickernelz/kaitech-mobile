import { useTranslation } from 'react-i18next';
import { LanguageChoices } from '../../screens/LanguageChoices';
import { SettingsPage } from '../../screens/SettingsPage';

export default function LanguageSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPage title={t('settings.language')} testID="settings-language-screen">
      <LanguageChoices />
    </SettingsPage>
  );
}
