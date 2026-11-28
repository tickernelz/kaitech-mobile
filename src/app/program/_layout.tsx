import { Stack } from 'expo-router';
import { TeamOnly } from '../../screens/Gate';
import { useTheme } from '../../theme';

export default function ProgramLayout() {
  const { colors } = useTheme();
  return (
    <TeamOnly>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </TeamOnly>
  );
}
