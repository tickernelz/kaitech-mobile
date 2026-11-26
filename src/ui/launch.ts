import * as SplashScreen from 'expo-splash-screen';

let drawn = false;

export function holdSplash() {
  void SplashScreen.preventAutoHideAsync();
  SplashScreen.setOptions({ duration: 240, fade: true });
}

export function firstScreenDrawn() {
  if (drawn) return;
  drawn = true;
  SplashScreen.hide();
}

export function splashGone(): boolean {
  return drawn;
}
