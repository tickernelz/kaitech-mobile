import { useRouter } from 'expo-router';
import { SignInForm } from '../screens/SignInForm';

export default function SignIn() {
  const router = useRouter();
  return <SignInForm onDone={() => undefined} onBack={() => router.back()} />;
}
