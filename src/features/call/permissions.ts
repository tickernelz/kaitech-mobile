import * as Audio from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { askPermission } from '../../ui/permission';

export async function ensureMicrophone(): Promise<boolean> {
  try {
    return await askPermission('microphone', Audio.getRecordingPermissionsAsync, Audio.requestRecordingPermissionsAsync, { settings: false });
  } catch {
    return false;
  }
}

export async function ensureCamera(): Promise<boolean> {
  try {
    return await askPermission('camera', ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync, { settings: false });
  } catch {
    return false;
  }
}
