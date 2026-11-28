import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetItem } from './Sheet';
import { SearchField } from './SearchField';

const shownWithoutQuery = 60;

export function ChoiceSheet({
  title,
  options,
  value,
  onPick,
  onClose,
  searchable,
  testID,
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hits = words.length ? options.filter((option) => words.every((word) => `${option.label} ${option.value}`.toLowerCase().includes(word))) : options;
    if (words.length || hits.length <= shownWithoutQuery) return hits;
    const current = hits.find((option) => option.value === value);
    const head = hits.slice(0, shownWithoutQuery);
    return current && !head.includes(current) ? [current, ...head] : head;
  }, [options, query, value]);
  return (
    <Sheet title={title} onClose={onClose} testID={testID}>
      {searchable ? <SearchField label={t('choice.search')} value={query} onChangeText={setQuery} autoCorrect={false} testID={`${testID}-search`} /> : null}
      {shown.map((option) => (
        <SheetItem
          key={option.value}
          icon={option.value === value ? 'check' : 'minus'}
          label={option.label}
          onPress={() => onPick(option.value)}
          testID={`${testID}-${option.value}`}
        />
      ))}
    </Sheet>
  );
}
