import { Stack } from 'expo-router';
import { useTheme } from '../../theme';
import { DialogLayer } from '../../ui/Dialog';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      <DialogLayer />
    </>
  );
}
