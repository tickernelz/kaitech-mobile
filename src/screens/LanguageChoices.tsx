import { useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { resolveLanguage, type LanguagePreference } from '../i18n/language';
import { useLanguage } from '../i18n';
import { Check, Divider, Row, Section } from '../ui/List';

export function LanguageChoices({ title }: { title?: string }) {
  const { t } = useTranslation();
  const { preference, setPreference } = useLanguage();
  const device = resolveLanguage(getLocales()[0]?.languageTag);
  const choices: { value: LanguagePreference; title: string; detail?: string }[] = [
    { value: 'system', title: t('settings.languageSystem'), detail: t('settings.languageSystemHint', { language: t(`language.${device}`) }) },
    { value: 'en', title: t('language.en') },
    { value: 'id', title: t('language.id') },
  ];
  return (
    <Section title={title}>
      {choices.map((choice, index) => (
        <LanguageRow key={choice.value} {...choice} first={index === 0} selected={preference === choice.value} onSelect={setPreference} />
      ))}
    </Section>
  );
}

function LanguageRow({
  value,
  title,
  detail,
  first,
  selected,
  onSelect,
}: {
  value: LanguagePreference;
  title: string;
  detail?: string;
  first: boolean;
  selected: boolean;
  onSelect: (value: LanguagePreference) => void;
}) {
  return (
    <>
      {first ? null : <Divider />}
      <Row
        title={title}
        detail={detail}
        selected={selected}
        onPress={() => onSelect(value)}
        trailing={<Check visible={selected} />}
        testID={`language-${value}`}
      />
    </>
  );
}
