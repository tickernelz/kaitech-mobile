import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { TFunction } from 'i18next';
import { Alert, Linking } from 'react-native';
import { stageFile } from '../files';

export const attachSources = ['camera', 'photos', 'files'] as const;
export type AttachSource = (typeof attachSources)[number];
export type Picked = { uri: string; name: string; mimetype: string; size: number; voice: false; durationMs: null };

type Chosen = { uri: string; name: string; mimeType: string; size?: number | null };

export function askForSettings(t: TFunction<'chat'>, what: 'camera' | 'microphone') {
  Alert.alert(t(`permissions.${what}Title`), t(`permissions.${what}Body`), [
    { text: t('permissions.cancel'), style: 'cancel' },
    { text: t('permissions.openSettings'), onPress: () => void Linking.openSettings() },
  ]);
}

export function tooBig(size: number, maxBytes: number | null): boolean {
  return maxBytes !== null && size > maxBytes;
}

const mediaName = (asset: ImagePicker.ImagePickerAsset, index: number, prefix: string) =>
  asset.fileName ?? `${prefix}-${Date.now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
const mediaType = (asset: ImagePicker.ImagePickerAsset) => asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

async function choose(source: AttachSource, t: TFunction<'chat'>): Promise<Chosen[]> {
  if (source === 'files') {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    return result.canceled ? [] : result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size }));
  }
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      askForSettings(t, 'camera');
      return [];
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    return result.canceled ? [] : result.assets.map((asset, index) => ({ uri: asset.uri, name: mediaName(asset, index, 'camera'), mimeType: mediaType(asset), size: asset.fileSize }));
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8 });
  return result.canceled ? [] : result.assets.map((asset, index) => ({ uri: asset.uri, name: mediaName(asset, index, 'media'), mimeType: mediaType(asset), size: asset.fileSize }));
}

export async function pickAttachments(source: AttachSource, t: TFunction<'chat'>, maxBytes: number | null, size: (bytes: number) => string): Promise<Picked[]> {
  const staged: Picked[] = [];
  const refused: string[] = [];
  for (const item of await choose(source, t)) {
    if (item.size && tooBig(item.size, maxBytes)) {
      refused.push(item.name);
      continue;
    }
    try {
      const copy = await stageFile(item.uri, item.name);
      if (tooBig(copy.size, maxBytes)) {
        refused.push(item.name);
        continue;
      }
      staged.push({ uri: copy.uri, name: item.name, mimetype: item.mimeType, size: copy.size, voice: false, durationMs: null });
    } catch {
      Alert.alert('', t('composer.fileFailed', { name: item.name }));
    }
  }
  if (refused.length && maxBytes !== null) Alert.alert('', t('composer.tooBig', { count: refused.length, names: refused.join(', '), limit: size(maxBytes) }));
  return staged;
}
