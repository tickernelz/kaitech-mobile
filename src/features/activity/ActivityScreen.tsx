import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { HeaderActions } from '../../screens/HeaderActions';
import { TopAppBar, useScrolledUnder } from '../../ui/AppBar';
import { useTheme } from '../../theme';
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
  const bar = useScrolledUnder();
  const header = (
    <Segmented
      testID="activity-source"
      value={source}
      onChange={setSource}
      options={[
        { value: 'odoo', label: t('activities.mine') },
        { value: 'discovery', label: t('activities.discovery') },
      ]}
    />
  );
  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-activity">
      <TopAppBar title={t('tabs.activity')} scrolled={bar.scrolled} actions={<HeaderActions />} />
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
});
