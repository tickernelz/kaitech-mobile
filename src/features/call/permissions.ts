import * as Audio from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';

export async function ensureMicrophone(): Promise<boolean> {
  try {
    const current = await Audio.getRecordingPermissionsAsync();
    if (current.granted) return true;
    const asked = await Audio.requestRecordingPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function ensureCamera(): Promise<boolean> {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) return true;
    const asked = await ImagePicker.requestCameraPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}
