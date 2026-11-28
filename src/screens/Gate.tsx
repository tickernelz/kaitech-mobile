import { useRouter, type Href } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { can } from '../auth/access';
import { useAccess, useCan } from '../auth/useAccess';
import { space, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { Text } from '../ui/Text';

export function Gate({ kind }: { kind: 'team' | 'admin' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const access = useAccess();
  const toHome = can(access, 'client.home');
  const home: Href = toHome ? '/home' : '/';
  const leave = () => {
    if (kind === 'admin' && router.canGoBack()) router.back();
    else router.replace(home);
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`gate-${kind}`}>
      <View style={styles.body}>
        <Icon name="lock" size={48} color={colors.inkFaint} />
        <Text variant="headline" accessibilityRole="header" style={styles.center} testID={`gate-${kind}-title`}>
          {t(`gate.${kind}.title`)}
        </Text>
        <Text variant="callout" tone="inkSoft" style={styles.center}>
          {t(`gate.${kind}.body`)}
        </Text>
        <Button kind="secondary" label={kind === 'admin' ? t('gate.back') : toHome ? t('gate.toHome') : t('gate.toChat')} onPress={leave} testID={`gate-${kind}-leave`} />
      </View>
    </SafeAreaView>
  );
}

export function TeamOnly({ children }: { children: ReactNode }) {
  return useCan('team') ? children : <Gate kind="team" />;
}

export function teamOnly<P extends object>(Screen: ComponentType<P>) {
  return function TeamScreen(props: P) {
    return (
      <TeamOnly>
        <Screen {...props} />
      </TeamOnly>
    );
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  center: { textAlign: 'center' },
});
