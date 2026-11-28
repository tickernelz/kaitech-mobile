import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { StateView } from '../discovery/ui';
import { ChoiceRow } from './followupParts';
import { Line, SmallButton } from './parts';
import { recordPage, type RecordKind } from './records';
import { Refresh } from '../../ui/Refresh';

const pageSize = 40;
const settleMs = 300;

const icons = { recordings: 'wave', minutes: 'minutes', removals: 'trash' } as const;

export function RecordsScreen({ kind }: { kind: RecordKind }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [state, setState] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setLimit(pageSize);
    }, settleMs);
    return () => clearTimeout(timer);
  }, [typed]);
  const page = useResource(`mom.records.${kind}.${limit}.${state}.${search}`, (account) => recordPage(account, kind, search, limit, state));
  const states = page.data?.states ?? [];
  const lines = page.data?.lines ?? [];

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`mom-records-${kind}`}>
      <Header title={t(`mom.records.${kind}`)} subtitle={page.data ? t('mom.records.count', { count: page.data.total }) : undefined} />
      <FlatList
        data={lines}
        keyExtractor={(line) => String(line.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<Refresh onRefresh={page.refresh} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <TextField label={t('mom.records.search')} value={typed} onChangeText={setTyped} returnKeyType="search" autoCorrect={false} testID="mom-records-search" />
            {states.length ? (
              <ChoiceRow
                options={[{ value: '', label: t('mom.followups.status.all') }, ...states.map((one) => ({ value: one.key, label: one.label }))]}
                value={state}
                onChange={(next) => {
                  setState(next);
                  setLimit(pageSize);
                }}
                testID="mom-records-state"
              />
            ) : null}
          </View>
        }
        ListHeaderComponentStyle={styles.search}
        renderItem={({ item }) => (
          <Line
            icon={icons[kind]}
            title={item.title || t('mom.records.untitled')}
            detail={[item.state, item.detail].filter(Boolean).join(' · ')}
            label={[item.title, item.state, item.detail].filter(Boolean).join(', ')}
            onPress={item.meetingId && kind !== 'removals' ? () => router.push({ pathname: '/mom/[meeting]', params: { meeting: String(item.meetingId) } }) : undefined}
            testID={`mom-record-${item.id}`}
          />
        )}
        ListEmptyComponent={
          <StateView
            loading={page.loading && !page.data}
            error={page.data ? undefined : page.error}
            empty={{ title: t('mom.records.none'), icon: icons[kind] }}
            onRetry={() => void page.refresh()}
            testID="mom-records"
          />
        }
        ListFooterComponent={
          page.data && page.data.total > lines.length ? (
            <View style={styles.more}>
              <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} testID="mom-records-more" />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xs, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  search: { paddingBottom: space.md },
  head: { gap: space.sm },
  more: { paddingTop: space.md },
});
