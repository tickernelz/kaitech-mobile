import { useTranslation } from 'react-i18next';
import { TabScreen } from '../../screens/TabScreen';

export default function Discovery() {
  const { t } = useTranslation();
  return <TabScreen title={t('tabs.discovery')} testID="tab-discovery" />;
}
