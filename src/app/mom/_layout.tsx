import { Stack } from 'expo-router';
import { TeamOnly } from '../../screens/Gate';
import { useTheme } from '../../theme';

export default function MomLayout() {
  const { colors } = useTheme();
  return (
    <TeamOnly>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="[meeting]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="record" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="sign" options={{ presentation: 'modal' }} />
      <Stack.Screen name="remove" options={{ presentation: 'modal' }} />
      <Stack.Screen name="list/[kind]" />
      <Stack.Screen name="followups" />
      <Stack.Screen name="client-org" />
      <Stack.Screen name="history/[recording]" />
      <Stack.Screen name="departments" />
      <Stack.Screen name="admin/[part]" />
      <Stack.Screen name="minutes/[part]" />
      <Stack.Screen name="assist/[part]" />
      <Stack.Screen name="transcript/[recording]" />
      <Stack.Screen name="transcript/speakers" />
      <Stack.Screen name="transcript/doubts" />
      <Stack.Screen name="final/[tool]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="followup/[id]" />
      <Stack.Screen name="followup/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="followup/new" options={{ presentation: 'modal' }} />
    </Stack>
    </TeamOnly>
  );
}
