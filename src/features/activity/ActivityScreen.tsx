import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { HeaderActions } from '../../screens/HeaderActions';
import { TopAppBar, largeTitleOwnsActions, useCollapsingTitle } from '../../ui/AppBar';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { briefing } from '../discovery/api';
import { Segmented } from '../discovery/ui';
import { DiscoveryActivities } from './DiscoveryActivities';
import { OdooActivities } from './OdooActivities';
import { useActivityOverview } from './useActivityOverview';

type Source = 'odoo' | 'discovery';

export function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [source, setSource] = useState<Source>('odoo');
  const odoo = useActivityOverview();
  const discovery = useResource('activity.discovery', briefing, 30_000);
  const bar = useCollapsingTitle();
  const header = (
    <>
      <View style={styles.top}>
        <Text variant="display" accessibilityRole="header" style={styles.fill}>
          {t('tabs.activity')}
        </Text>
        {largeTitleOwnsActions ? <HeaderActions /> : null}
      </View>
      <Segmented
        testID="activity-source"
        value={source}
        onChange={setSource}
        options={[
          { value: 'odoo', label: t('activities.mine') },
          { value: 'discovery', label: t('activities.discovery') },
        ]}
      />
    </>
  );
  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-activity">
      <TopAppBar title={t('tabs.activity')} collapsed={bar.collapsed} actions={<HeaderActions />} />
      {source === 'odoo' ? (
        <OdooActivities items={odoo} header={header} onScroll={bar.onScroll} />
      ) : (
        <DiscoveryActivities items={discovery} header={header} onScroll={bar.onScroll} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
});
