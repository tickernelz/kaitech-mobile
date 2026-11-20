import { useRouter } from 'expo-router';
import { SignInForm } from '../screens/SignInForm';

export default function AddAccount() {
  const router = useRouter();
  return <SignInForm onDone={() => router.dismissTo('/chat')} onBack={() => router.back()} />;
}
