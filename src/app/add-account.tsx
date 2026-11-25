import { useRouter } from 'expo-router';
import { SignInForm } from '../screens/SignInForm';
import { DialogLayer } from '../ui/Dialog';

export default function AddAccount() {
  const router = useRouter();
  return (
    <>
      <SignInForm onDone={() => router.dismissTo('/')} onBack={() => router.back()} />
      <DialogLayer />
    </>
  );
}
