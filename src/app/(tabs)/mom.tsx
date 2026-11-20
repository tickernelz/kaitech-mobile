import { useTranslation } from 'react-i18next';
import { TabScreen } from '../../screens/TabScreen';

export default function Mom() {
  const { t } = useTranslation();
  return <TabScreen title={t('tabs.mom')} testID="tab-mom" />;
}
