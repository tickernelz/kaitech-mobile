import { AppState } from 'react-native';
import { callNative, onCallAction } from './native';

export function inPictureInPicture(): boolean {
  return callNative()?.isInPictureInPicture() ?? false;
}

export function userInApp(state: string | null | undefined): boolean {
  return state !== 'background' && state !== 'inactive' && !inPictureInPicture();
}

export function onPresenceChange(listener: (state: string | null | undefined) => void): () => void {
  const app = AppState.addEventListener('change', listener);
  const stop = onCallAction((action) => {
    if (action.type === 'pip' && !action.active && callNative()?.isResumed()) listener(AppState.currentState);
  });
  return () => {
    app.remove();
    stop();
  };
}
