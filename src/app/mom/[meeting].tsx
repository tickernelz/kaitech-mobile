import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { idParam } from '../../features/discovery/params';
import { MeetingView } from '../../features/mom/MeetingView';
import { useTheme } from '../../theme';

export default function MeetingRoute() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ meeting: string }>();
  const meeting = idParam(params.meeting);
  if (!meeting) return null;
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]}>
      <MeetingView meeting={meeting} back />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
