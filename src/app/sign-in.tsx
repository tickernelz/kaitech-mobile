import { useLocalSearchParams, useRouter } from 'expo-router';
import { SignInForm } from '../screens/SignInForm';

export default function SignIn() {
  const router = useRouter();
  const { custom } = useLocalSearchParams<{ custom?: string }>();
  return <SignInForm custom={custom === '1'} onDone={() => undefined} onBack={() => router.back()} />;
}
