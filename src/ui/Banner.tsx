import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { Notice } from '../api/network';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';
import { Pressable } from './Pressable';
import { Text } from './Text';

const tones = { warn: { band: 'warnBand', ink: 'warnInk' }, info: { band: 'infoBand', ink: 'infoInk' } } as const;

export function Banner({
  tone,
  icon,
  text,
  action,
  testID,
}: {
  tone: keyof typeof tones;
  icon: IconName;
  text: string;
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
}) {
  const { colors } = useTheme();
  const { band, ink } = tones[tone];
  return (
    <View style={[styles.banner, { backgroundColor: colors[band] }]} accessibilityLiveRegion="polite" testID={testID}>
      <Icon name={icon} size={20} color={colors[ink]} />
      <Text variant="footnote" tone={ink} style={styles.text}>
        {text}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={4} style={styles.action} testID={action.testID}>
          <Text variant="footnote" tone={ink} style={styles.strong}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ConnectionBanner({ notice, onRetry, testID }: { notice: Notice; onRetry: () => void; testID: string }) {
  const { t } = useTranslation();
  if (notice === 'offline') return <Banner tone="warn" icon="cloudOff" text={t('network.offlineCached')} testID={`${testID}-offline`} />;
  if (notice === 'failed') {
    return (
      <Banner
        tone="warn"
        icon="cloudOff"
        text={t('network.refreshFailed')}
        action={{ label: t('discovery.retry'), onPress: onRetry, testID: `${testID}-retry` }}
        testID={`${testID}-failed`}
      />
    );
  }
  return null;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  text: { flex: 1 },
  action: { borderRadius: radius.pill, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  strong: { fontWeight: '600' },
});
