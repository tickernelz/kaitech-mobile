import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { invalidate } from '../../api/resource';
import { useSession } from '../../auth/session';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Divider, Row } from '../../ui/List';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { SearchField } from '../../ui/SearchField';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Chip, StateView, useErrorText } from '../discovery/ui';
import { signOff } from './api';
import { useFinal } from './FinalPanel';

export function SignScreen({ programme, meeting }: { programme: number; meeting: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const final = useFinal(programme, meeting);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const view = final.data;
  const said = query.trim().toLowerCase();
  const people = (view?.profiles ?? []).filter((profile) => !said || `${profile.name} ${profile.organization}`.toLowerCase().includes(said));
  const person = view?.profiles.find((profile) => profile.profileId === chosen) ?? null;

  const sign = async () => {
    if (!active || !view || !person) return;
    setBusy(true);
    setFailure(null);
    try {
      await signOff(active, view.documentId, person.profileId, role.trim());
      invalidate(`${active.id}:mom.`);
      router.back();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={styles.sheet}
      testID="mom-sign"
      footer={
        <>
          {failure ? (
            <Text variant="callout" tone="dangerInk" accessibilityRole="alert">
              {errorText(failure)}
            </Text>
          ) : null}
          <Button
            label={person ? t('mom.final.confirm', { name: person.name }) : t('mom.final.sign')}
            disabled={!person}
            busy={busy}
            onPress={() => void sign()}
            testID="sign-confirm"
          />
        </>
      }>
      <Header title={t('mom.final.signTitle')} />
      <Text tone="inkSoft">{t('mom.final.signBody')}</Text>
      {view ? (
        <>
          <SearchField label={t('mom.final.search')} value={query} onChangeText={setQuery} testID="sign-search" autoCorrect={false} />
          <FlatList
            style={styles.fill}
            data={people}
            keyExtractor={(profile) => String(profile.profileId)}
            ItemSeparatorComponent={Divider}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Row
                title={item.name}
                detail={[item.role, item.organization].filter(Boolean).join(' · ')}
                selected={item.profileId === chosen}
                onPress={() => {
                  setChosen(item.profileId);
                  setRole(item.role ?? '');
                }}
                trailing={
                  <View style={styles.trailing}>
                    {item.authority ? null : <Chip label={t('mom.final.noAuthority')} />}
                    <Check visible={item.profileId === chosen} />
                  </View>
                }
                testID={`signer-${item.profileId}`}
              />
            )}
          />
          {person ? <TextField label={t('mom.final.role')} value={role} onChangeText={setRole} testID="sign-role" /> : null}
        </>
      ) : (
        <StateView loading={final.loading || !final.error} error={final.error} onRetry={() => void final.refresh()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { maxWidth: 600 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
});
