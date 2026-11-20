import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { update, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { Panes } from '../../layout/Panes';
import { useWindowClass } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row } from '../../ui/List';
import { card as readCard, openCards, type Card } from './api';
import { DecisionCard } from './DecisionCard';
import { Header } from './Header';
import { openConversation } from './store';
import { StateView } from './ui';

function CardDetail({ id, programme, conversation }: { id: number; programme?: number; conversation?: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useSession();
  const shown = useResource(`discovery.card.${id}`, (account) => readCard(account, id), 10_000);
  if (!shown.data) {
    return <StateView loading={!shown.error} error={shown.error} onRetry={() => void shown.refresh()} testID="card" />;
  }
  return (
    <ScrollView contentContainerStyle={styles.content} testID="card-detail">
      <DecisionCard
        card={shown.data}
        onAnswered={(next) => {
          if (shown.key) update<Card>(shown.key, () => next);
        }}
      />
      {programme && conversation ? (
        <Button
          kind="plain"
          label={t('discovery.card.openThread')}
          onPress={() => {
            if (active) openConversation(active.id, programme, conversation);
            router.push({ pathname: '/program/[id]/coworker', params: { id: String(programme), card: String(id) } });
          }}
          testID="card-open-thread"
        />
      ) : null}
    </ScrollView>
  );
}

export function CardScreen({ id, programme, conversation }: { id: number; programme?: number; conversation?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { windowClass } = useWindowClass();
  const [selected, setSelected] = useState(id);
  const others = useResource(
    programme && windowClass === 'expanded' ? `discovery.openCards.${programme}` : null,
    (account) => openCards(account, programme ?? 0),
  );
  const list = (
    <FlatList
      data={others.data ?? []}
      keyExtractor={(row) => String(row.id)}
      renderItem={({ item }) => (
        <Row title={item.title} detail={item.stage} selected={item.id === selected} onPress={() => setSelected(item.id)} testID={`open-card-${item.id}`} />
      )}
      ListEmptyComponent={<StateView loading={others.loading} error={others.error} />}
    />
  );
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="card-screen">
      <Header title={t('discovery.card.title')} />
      <View style={styles.fill}>
        <Panes list={windowClass === 'expanded' ? list : <CardDetail id={selected} programme={programme} conversation={conversation} />} detail={<CardDetail key={selected} id={selected} programme={programme} conversation={selected === id ? conversation : undefined} />} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
});
