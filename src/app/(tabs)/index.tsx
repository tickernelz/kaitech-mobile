import { useTranslation } from 'react-i18next';
import { TabScreen } from '../../screens/TabScreen';

export default function Chat() {
  const { t } = useTranslation();
  return <TabScreen title={t('tabs.chat')} testID="tab-chat" />;
}
