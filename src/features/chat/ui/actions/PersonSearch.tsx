import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from '../../../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../../../theme';
import { Icon } from '../../../../ui/icons';
import { Text } from '../../../../ui/Text';
import type { Person, Result } from '../../messageActions';
import { chipBand, chipHeight, chipRowGap, chipSlop, touchTarget } from '../../../../ui/touch';

export function PersonChips({ people, onRemove, testID }: { people: Person[]; onRemove?: (person: Person) => void; testID?: string }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  if (!people.length) return null;
  return (
    <View style={styles.chips} testID={testID}>
      {people.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          accessibilityLabel={onRemove ? t('pick.remove', { name: person.name }) : person.name}
          disabled={!onRemove}
          onPress={() => onRemove?.(person)}
          hitSlop={chipSlop}
          style={[styles.chip, { borderColor: colors.line, backgroundColor: colors.surface2 }]}>
          <Text variant="footnote" numberOfLines={1}>
            {person.name}
          </Text>
          {onRemove ? <Icon name="close" size={16} color={colors.inkSoft} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function PersonSearch({
  placeholder,
  search,
  onPick,
  exclude = [],
  local,
  testID,
}: {
  placeholder: string;
  search?: (query: string) => Promise<Result<Person[]>>;
  onPick: (person: Person) => void;
  exclude?: number[];
  local?: Person[];
  testID?: string;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Person[]>([]);
  const text = query.trim();
  const localFound = useMemo(() => {
    const needle = text.toLowerCase();
    return local && needle ? local.filter((person) => person.name.toLowerCase().includes(needle)).slice(0, 20) : [];
  }, [local, text]);
  useEffect(() => {
    if (local || !text || !search) return;
    let live = true;
    const timer = setTimeout(() => {
      void search(text).then((result) => {
        if (live) setFound(result.ok ? result.value : []);
      });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [local, text, search]);
  const shown = (local ? localFound : text ? found : []).filter((person) => !exclude.includes(person.id));
  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={placeholder}
        style={[styles.input, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID={testID}
      />
      {shown.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          onPress={() => {
            onPick(person);
            setQuery('');
          }}
          style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surface2 }]}
          testID={testID ? `${testID}-${person.id}` : undefined}>
          <Text variant="callout" numberOfLines={1}>
            {person.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: space.md, fontSize: 16 },
  result: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xs, rowGap: chipRowGap, ...chipBand },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: chipHeight, minWidth: touchTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: stroke.thin, maxWidth: '100%' },
});
