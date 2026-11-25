import { getCameraPermissionsAsync, launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerOptions } from 'expo-image-picker';
import { bearer, bearerFile } from '../../api/odoo';
import { load, update, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { accountKnown, renameAccount } from '../../auth/session';
import { takeAppearance } from '../appearance/appearance';
import { shrinkToJpeg } from '../media/shrink';
import { photoFrom, type Photo } from '../people/photo';
import { notePhoto } from '../people/photos';
import { cleanStatus, statusFrom } from '../people/status';
import { askPermission } from '../../ui/permission';

export type Profile = { userId: number; partnerId: number; name: string; login: string; photo: Photo | null; status: string | null };

export type ProfileChanges = { name?: string; status?: string };

const path = 'profile';
const photoSide = 1024;
export const nameLimit = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function profileFrom(body: unknown): Profile | null {
  if (!isRecord(body) || typeof body.user_id !== 'number' || typeof body.partner_id !== 'number' || typeof body.name !== 'string') return null;
  return {
    userId: body.user_id,
    partnerId: body.partner_id,
    name: body.name,
    login: typeof body.login === 'string' ? body.login : '',
    photo: photoFrom(body.photo) ?? null,
    status: statusFrom(body.status) ?? null,
  };
}

export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function taken(account: Account, body: unknown): Profile {
  const profile = profileFrom(body);
  if (!profile) throw new Error('profile_invalid');
  if (!accountKnown(account.id)) return profile;
  notePhoto(account.id, profile.partnerId, profile.photo);
  renameAccount(account.id, profile.name);
  if (isRecord(body) && 'appearance' in body) takeAppearance(account.id, body.appearance);
  update<Profile>(`${account.id}:${path}`, () => profile);
  return profile;
}

async function fetchProfile(account: Account): Promise<Profile> {
  return taken(account, await bearer<unknown>(account, '/kaitech_mobile/profile'));
}

export function useProfile() {
  return useResource<Profile>(path, fetchProfile, 60_000);
}

export function refreshProfile(account: Account): Promise<void> {
  return load(`${account.id}:${path}`, () => fetchProfile(account));
}

export function profileBody(changes: ProfileChanges): Record<string, string | null> {
  const body: Record<string, string | null> = {};
  if (changes.name !== undefined) body.name = cleanName(changes.name);
  if (changes.status !== undefined) body.status = cleanStatus(changes.status) || null;
  return body;
}

export async function saveProfile(account: Account, changes: ProfileChanges): Promise<Profile> {
  return taken(account, await bearer<unknown>(account, '/kaitech_mobile/profile', { method: 'POST', body: profileBody(changes) }));
}

export async function removeProfilePhoto(account: Account): Promise<Profile> {
  return taken(account, await bearer<unknown>(account, '/kaitech_mobile/profile/photo', { method: 'DELETE' }));
}

export async function uploadProfilePhoto(account: Account, uri: string): Promise<Profile> {
  return taken(account, await bearerFile<unknown>(account, '/kaitech_mobile/profile/photo', uri, 'image/jpeg'));
}

export type PhotoSource = 'library' | 'camera';

const cropOptions: ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], shape: 'oval', quality: 1 };

export async function pickProfilePhoto(source: PhotoSource): Promise<string | null> {
  if (source === 'camera' && !(await askPermission('camera', getCameraPermissionsAsync, requestCameraPermissionsAsync))) return null;
  const picked = source === 'camera' ? await launchCameraAsync(cropOptions) : await launchImageLibraryAsync(cropOptions);
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  return shrinkToJpeg(asset.uri, asset.width, asset.height, photoSide);
}
