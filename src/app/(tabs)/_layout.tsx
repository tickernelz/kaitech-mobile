import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.primary} labelStyle={{ color: colors.inkSoft }}>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>{t('tabs.chat')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="chat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discovery">
        <NativeTabs.Trigger.Label>{t('tabs.discovery')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkle.magnifyingglass" md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mom">
        <NativeTabs.Trigger.Label>{t('tabs.mom')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform" md="mic" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>{t('tabs.activity')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} md="notifications" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
