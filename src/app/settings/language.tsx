import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { choices, readMe, writeMe } from '../../features/account/odoo';
import { useErrorText } from '../../features/discovery/ui';
import { LanguageChoices } from '../../screens/LanguageChoices';
import { SettingsPage } from '../../screens/SettingsPage';
import { Check, Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';

export default function LanguageSettings() {
  const { t } = useTranslation();
  const { active } = useSession();
  const errorText = useErrorText();
  const me = useResource('account.me', readMe, 60_000);
  const options = useResource('account.choices', choices, 3_600_000);
  const [failed, setFailed] = useState<string | null>(null);
  const pick = async (lang: string) => {
    if (!active) return;
    setFailed(null);
    try {
      await writeMe(active, { lang });
      await me.refresh();
    } catch (error) {
      setFailed(errorText(error));
    }
  };
  return (
    <SettingsPage title={t('settings.language')} testID="settings-language-screen">
      <LanguageChoices title={t('account.appLanguage')} />
      {me.data && options.data?.languages.length ? (
        <Section title={t('account.language')}>
          {options.data.languages.map((option) => (
            <Row
              key={option.value}
              title={option.label}
              trailing={<Check visible={me.data?.lang === option.value} />}
              selected={me.data?.lang === option.value}
              onPress={() => void pick(option.value)}
              testID={`account-language-${option.value}`}
            />
          ))}
        </Section>
      ) : null}
      {me.data && options.data?.languages.length ? (
        <Text variant="footnote" tone="inkSoft">
          {t('account.languageHint')}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
          {failed}
        </Text>
      ) : null}
    </SettingsPage>
  );
}
