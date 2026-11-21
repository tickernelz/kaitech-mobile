import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { space, useTheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { useRouter } from 'expo-router';
import { startCall } from '../call';

function CallButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.button} testID={testID}>
      <Icon name={icon} color={colors.primary} />
    </Pressable>
  );
}

export function CallButtons({ channelId, channelName }: { channelId: number; channelName: string }) {
  const { t } = useTranslation('call');
  const router = useRouter();
  const open = (video: boolean) => {
    router.push({ pathname: '/call/[id]', params: { id: String(channelId) } });
    void startCall({ channelId, channelName, video });
  };
  return (
    <>
      <CallButton icon="phone" label={t('startVoice')} onPress={() => open(false)} testID="call-voice" />
      <CallButton icon="video" label={t('startVideo')} onPress={() => open(true)} testID="call-video" />
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
});
