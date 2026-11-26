import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSession } from '../../auth/session';
import { changeAppearance, themes, useChatAppearance } from '../../features/appearance/appearance';
import { RowIcon, SettingsPage } from '../../screens/SettingsPage';
import { useTheme } from '../../theme';
import { Icon } from '../../ui/icons';
import { Check, Divider, Row, Section, ToggleRow } from '../../ui/List';
import { setTapToRecord, useTapToRecord } from '../../features/chat/voice/tapSetting';
import { Text } from '../../ui/Text';

export default function AppearanceSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const appearance = useChatAppearance(active?.id ?? null);
  const [failed, setFailed] = useState(false);
  const tap = useTapToRecord();
  if (!active) return null;
  return (
    <SettingsPage title={t('settings.appearance')} testID="settings-appearance-screen">
      <Section title={t('appearance.theme.title')}>
        {themes.map((theme, index) => (
          <View key={theme}>
            {index ? <Divider /> : null}
            <Row
              title={t(`appearance.theme.${theme}`)}
              selected={appearance.theme === theme}
              trailing={<Check visible={appearance.theme === theme} />}
              onPress={() => void changeAppearance(active, { theme }).then((code) => setFailed(code !== null))}
              testID={`theme-${theme}`}
            />
          </View>
        ))}
      </Section>
      <Section>
        <Row
          leading={<RowIcon name="image" />}
          title={t('appearance.background')}
          trailing={<Icon name="forward" size={20} color={colors.inkFaint} />}
          onPress={() => router.push('/settings/background')}
          testID="settings-background"
        />
      </Section>
      <Section title={t('appearance.chat')}>
        <ToggleRow title={t('appearance.tapToRecord')} detail={t('appearance.tapToRecordHint')} value={tap} onChange={setTapToRecord} testID="settings-tap-to-record" />
      </Section>
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
          {t('appearance.failed')}
        </Text>
      ) : null}
    </SettingsPage>
  );
}
