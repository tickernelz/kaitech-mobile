import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../../../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet, SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { getChat, useChat } from '../../chat';
import { hasFeature } from '../../features';
import type { Person } from '../../messageActions';
import { createChannel, searchPeople, startChat } from '../../newConversation';
import { failureText } from '../actions/failure';
import { PersonChips, PersonSearch } from '../actions/PersonSearch';
import { touchTarget } from '../../../../ui/touch';

const kinds = ['chat', 'channel'] as const;
type Kind = (typeof kinds)[number];

export function NewConversationSheet({ onClose, onOpen }: { onClose: () => void; onOpen: (id: number) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const features = useChat((state) => state.features);
  const [kind, setKind] = useState<Kind>('chat');
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [announcement, setAnnouncement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAnnounce = hasFeature(features, 'announcement');
  const ready = kind === 'chat' ? people.length > 0 : name.trim().length > 0;
  const submit = async () => {
    setBusy(true);
    setError(null);
    if (kind === 'chat') {
      const result = await startChat(people.map((person) => person.id), getChat().partnerId);
      setBusy(false);
      if (result.ok) onOpen(result.value);
      else setError(failureText(t, result));
      return;
    }
    const result = await createChannel({ name: name.trim(), groupId: features.internalGroupId, partnerIds: people.map((person) => person.id), announcement: canAnnounce && announcement });
    setBusy(false);
    if (!result.ok) {
      setError(failureText(t, result));
      return;
    }
    onOpen(result.value.id);
  };
  return (
    <Sheet
      title={t('newChat.title')}
      onClose={onClose}
      testID="new-sheet"
      footer={
        <>
          {error ? (
            <Text variant="footnote" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button
            label={kind === 'channel' ? t('newChat.createChannel') : people.length > 1 ? t('newChat.createGroup') : t('newChat.startChat')}
            disabled={!ready}
            busy={busy}
            onPress={() => void submit()}
            testID="new-create"
          />
        </>
      }>
      <View style={styles.tabs} accessibilityRole="tablist">
        {kinds.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === value }}
            onPress={() => setKind(value)}
            style={[styles.tab, { borderColor: kind === value ? colors.focus : colors.line, backgroundColor: kind === value ? colors.select : 'transparent' }]}
            testID={`new-kind-${value}`}>
            <Text variant="callout" tone={kind === value ? 'selectInk' : 'ink'}>
              {t(`newChat.kind.${value}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {kind === 'channel' ? <TextField label={t('newChat.name')} value={name} onChangeText={setName} testID="new-name" /> : null}
      {kind === 'channel' && canAnnounce ? (
        <SheetItem icon="flag" label={t('newChat.announcement')} detail={t('newChat.announcementHint')} selected={announcement} onPress={() => setAnnouncement((value) => !value)} testID="new-announcement" />
      ) : null}
      <Text variant="label" tone="inkSoft">
        {kind === 'chat' ? t('newChat.with') : t('newChat.members')}
      </Text>
      <PersonChips people={people} onRemove={(person) => setPeople((current) => current.filter((item) => item.id !== person.id))} testID="new-people" />
      <PersonSearch placeholder={t('newChat.search')} search={searchPeople} exclude={[getChat().partnerId, ...people.map((person) => person.id)]} onPick={(person) => setPeople((current) => [...current, person])} testID="new-search" />
      {kind === 'chat' && people.length > 1 ? (
        <Text variant="footnote" tone="inkSoft">
          {t('newChat.groupHint')}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.xs, paddingBottom: space.sm },
  tab: { flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: stroke.thin },
});
