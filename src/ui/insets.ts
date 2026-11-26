import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomInset(gap: number, keyboardVisible = false) {
  const { bottom } = useSafeAreaInsets();
  return (keyboardVisible ? 0 : bottom) + gap;
}

export function useTopInset(gap: number) {
  return useSafeAreaInsets().top + gap;
}
