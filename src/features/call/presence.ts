import { callNative } from './native';

export function inPictureInPicture(): boolean {
  return callNative()?.isInPictureInPicture() ?? false;
}

export function userInApp(state: string | null | undefined): boolean {
  return state !== 'background' && state !== 'inactive' && !inPictureInPicture();
}
