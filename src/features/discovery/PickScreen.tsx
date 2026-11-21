import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { useTheme } from '../../theme';
import { Check, Divider, Row } from '../../ui/List';
import { Header } from './Header';
import { useCurrentProgramme } from './Home';
import { rememberProgramme } from './store';
import { Chip, StateView } from './ui';

export function PickScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const { list, current } = useCurrentProgramme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="programme-pick">
      <Header title={t('discovery.pick.title')} />
      <FlatList
        style={styles.list}
        data={list.data ?? []}
        keyExtractor={(row) => String(row.id)}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <Row
            title={item.name}
            detail={[item.client, item.state_label].filter(Boolean).join(' · ')}
            selected={item.id === current?.id}
            trailing={
              <>
                {item.waiting ? <Chip tone="warn" label={t('discovery.pick.waiting', { count: item.waiting })} /> : null}
                <Check visible={item.id === current?.id} />
              </>
            }
            onPress={() => {
              if (active) rememberProgramme(active.id, item.id);
              router.back();
            }}
            testID={`programme-${item.id}`}
          />
        )}
        ListEmptyComponent={
          <StateView
            loading={list.loading}
            error={list.error}
            empty={{ title: t('discovery.home.noneTitle'), icon: 'compass' }}
            onRetry={() => void list.refresh()}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
