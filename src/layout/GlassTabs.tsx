import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';
import { DynamicColorIOS, type ImageSourcePropType } from 'react-native';
import { colorsFor } from '../theme/tokens';
import { badgeText, routes, tabs, type TabName } from './tabs';
import { useTabCounts } from './useTabCounts';

const glyphs: Record<TabName, { default: ImageSourcePropType; selected: ImageSourcePropType }> = {
  chat: { default: require('../../assets/tabs/chat-line.png'), selected: require('../../assets/tabs/chat-fill.png') },
  discovery: { default: require('../../assets/tabs/discovery-line.png'), selected: require('../../assets/tabs/discovery-fill.png') },
  mom: { default: require('../../assets/tabs/mom-line.png'), selected: require('../../assets/tabs/mom-fill.png') },
  activity: { default: require('../../assets/tabs/activity-line.png'), selected: require('../../assets/tabs/activity-fill.png') },
};

const brand = DynamicColorIOS({ light: colorsFor('light').primary, dark: colorsFor('dark').primary });

export function GlassTabs() {
  const { t } = useTranslation();
  const counts = useTabCounts();
  return (
    <NativeTabs tintColor={brand}>
      {tabs.map((name) => (
        <NativeTabs.Trigger key={name} name={routes[name].name} testID={`tab-button-${name}`}>
          <NativeTabs.Trigger.Icon src={glyphs[name]} renderingMode="template" />
          <NativeTabs.Trigger.Label>{t(`tabs.${name}`)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Badge hidden={!counts[name]}>{badgeText(counts[name])}</NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
