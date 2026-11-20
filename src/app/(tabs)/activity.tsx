import { useTranslation } from 'react-i18next';
import { TabScreen } from '../../screens/TabScreen';

export default function Activity() {
  const { t } = useTranslation();
  return <TabScreen title={t('tabs.activity')} testID="tab-activity" />;
}
