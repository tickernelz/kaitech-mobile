import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { route, serverLanguage } from '../../api/odoo';
import { askPermission } from '../../ui/permission';
import type { Point } from './geo';
import { run, type Result } from './messageActions';

export type Found = Point & { name: string; address: string };
export type Fix = Point & { accuracy: number | null; at: number };

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function foundFrom(value: unknown): Found | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') return null;
  return { latitude: raw.latitude, longitude: raw.longitude, name: text(raw.name), address: text(raw.address) };
}

export function searchPlaces(query: string): Promise<Result<Found[]>> {
  return run(async (account) => {
    const raw = await route<{ results?: unknown[] }>(account, '/kaitech_chat/map/search', { query: query.trim().slice(0, 200), locale: serverLanguage() });
    return (raw?.results ?? []).map(foundFrom).filter((item): item is Found => item !== null);
  });
}

export function placeName(point: Point): Promise<Result<{ name: string; address: string }>> {
  return run(async (account) => {
    const raw = await route<{ name?: unknown; address?: unknown }>(account, '/kaitech_chat/map/reverse', { latitude: point.latitude, longitude: point.longitude, locale: serverLanguage() });
    return { name: text(raw?.name), address: text(raw?.address) };
  });
}

export function allowLocation(): Promise<boolean> {
  return askPermission('location', Location.getForegroundPermissionsAsync, Location.requestForegroundPermissionsAsync);
}

export async function locationOn(): Promise<boolean> {
  return Location.hasServicesEnabledAsync().catch(() => false);
}

export function openLocationSettings() {
  if (Platform.OS === 'android') void Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
  else void Linking.openSettings();
}

export function fixOf(position: Location.LocationObject): Fix {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null, at: position.timestamp };
}

export async function lastFix(): Promise<Fix | null> {
  const known = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 200 }).catch(() => null);
  return known ? fixOf(known) : null;
}

export function watchFix(onFix: (fix: Fix) => void, onError: () => void): () => void {
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;
  void Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 }, (position) => onFix(fixOf(position)), () => onError())
    .then((created) => {
      if (stopped) created.remove();
      else subscription = created;
    })
    .catch(() => onError());
  return () => {
    stopped = true;
    subscription?.remove();
  };
}
