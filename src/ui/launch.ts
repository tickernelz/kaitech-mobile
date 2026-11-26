import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

let drawn = false;

export function holdSplash() {
  void SplashScreen.preventAutoHideAsync();
  SplashScreen.setOptions({ duration: Platform.OS === 'android' ? 0 : 240, fade: true });
}

export function firstScreenDrawn() {
  if (drawn) return;
  drawn = true;
  SplashScreen.hide();
}

export function splashGone(): boolean {
  return drawn;
}
