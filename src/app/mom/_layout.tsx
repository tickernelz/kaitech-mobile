import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function MomLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="[meeting]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="record" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="sign" options={{ presentation: 'modal' }} />
      <Stack.Screen name="remove" options={{ presentation: 'modal' }} />
      <Stack.Screen name="list/[kind]" />
      <Stack.Screen name="followups" />
      <Stack.Screen name="followup/[id]" />
      <Stack.Screen name="followup/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="followup/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
