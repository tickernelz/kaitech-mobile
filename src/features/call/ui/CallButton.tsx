import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { useRouter } from 'expo-router';
import { space, useTheme } from '../../../theme';
import { Icon } from '../../../ui/icons';
import { startCall } from '../call';

export function CallButton({ channelId, channelName }: { channelId: number; channelName: string }) {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const router = useRouter();
  const start = () => {
    router.push({ pathname: '/call/[id]', params: { id: String(channelId) } });
    void startCall({ channelId, channelName });
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('start')} onPress={start} hitSlop={8} style={styles.button} testID="call-start">
      <Icon name="phone" color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
});
