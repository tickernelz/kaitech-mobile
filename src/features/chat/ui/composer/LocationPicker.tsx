import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, StyleSheet, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, stroke, useTheme } from '../../../../theme';
import { choose } from '../../../../ui/dialog';
import { Icon } from '../../../../ui/icons';
import { Overlay } from '../../../../ui/Overlay';
import { askPermission } from '../../../../ui/permission';
import { Pressable } from '../../../../ui/Pressable';
import { SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { distanceMeters, zoomForAccuracy, type Point } from '../../geo';
import { allowLocation, lastFix, locationOn, openLocationSettings, placeName, searchPlaces, watchFix, type Fix, type Found } from '../../places';
import { draftPlace, liveDurations } from '../../rich';
import type { Place } from '../../types';
import { TileMap } from '../TileMap';

const fallbackCenter: Point = { latitude: -6.2, longitude: 106.816666 };
const reverseDelay = 700;
const searchDelay = 400;

type Picked = Found | null;

export function LocationPicker({ onClose, onSend }: { onClose: () => void; onSend: (place: Place) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [servicesOn, setServicesOn] = useState(true);
  const [fix, setFix] = useState<Fix | null>(null);
  const [center, setCenter] = useState<Point>(fallbackCenter);
  const [zoom, setZoom] = useState(12);
  const [moved, setMoved] = useState(false);
  const [picked, setPicked] = useState<Picked>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ term: string; items: Found[]; failed: boolean } | null>(null);
  const term = query.trim();
  const searchingNow = term.length >= 2;
  const results = searchingNow ? (found?.term === term ? found.items : []) : null;
  const searching = searchingNow && found?.term !== term;
  const searchFailed = found?.term === term && found.failed;
  const [centered, setCentered] = useState(false);

  useEffect(() => {
    let live = true;
    let stopWatch = () => undefined as void;
    void (async () => {
      const ok = await allowLocation();
      if (!live) return;
      setAllowed(ok);
      if (!ok) return;
      setServicesOn(await locationOn());
      const known = await lastFix();
      if (live && known) setFix((current) => current ?? known);
      stopWatch = watchFix((next) => live && setFix(next), () => live && setServicesOn(false));
    })();
    return () => {
      live = false;
      stopWatch();
    };
  }, []);

  if (fix && !centered && !moved) {
    setCentered(true);
    setCenter({ latitude: fix.latitude, longitude: fix.longitude });
    setZoom(zoomForAccuracy(fix.accuracy));
  }

  useEffect(() => {
    if (!moved || picked) return;
    let live = true;
    const timer = setTimeout(() => {
      void placeName(center).then((result) => live && result.ok && setPicked({ ...center, ...result.value }));
    }, reverseDelay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [center, moved, picked]);

  useEffect(() => {
    if (!searchingNow) return;
    let live = true;
    const timer = setTimeout(() => {
      void searchPlaces(term).then((result) => live && setFound({ term, items: result.ok ? result.value : [], failed: !result.ok }));
    }, searchDelay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, searchingNow]);

  const move = (next: Point, nextZoom: number, byUser: boolean) => {
    setCenter(next);
    setZoom(nextZoom);
    if (byUser && (next.latitude !== center.latitude || next.longitude !== center.longitude)) {
      setMoved(true);
      setPicked(null);
    }
  };
  const goHome = () => {
    if (!fix) return;
    setCenter({ latitude: fix.latitude, longitude: fix.longitude });
    setZoom(zoomForAccuracy(fix.accuracy));
    setMoved(false);
    setPicked(null);
  };
  const choosePlace = (found: Found) => {
    setCenter({ latitude: found.latitude, longitude: found.longitude });
    setZoom(16);
    setMoved(true);
    setPicked(found);
    setQuery('');
  };
  const sendCurrent = () => fix && onSend(draftPlace(fix));
  const sendPicked = () => onSend(draftPlace({ ...center, name: picked?.name, address: picked?.address }));
  const shareLive = async () => {
    if (!fix) return;
    const minutes = await choose({
      title: t('location.liveTitle'),
      body: t('location.liveNote'),
      icon: 'compass',
      choices: liveDurations.map((value) => ({ key: String(value), label: t(`location.duration.${value}`) })),
      testID: 'live-duration',
    });
    if (!minutes) return;
    if (Platform.OS === 'android') await askPermission('notifications', Notifications.getPermissionsAsync, Notifications.requestPermissionsAsync, { settings: false }).catch(() => false);
    onSend(draftPlace(fix, Number(minutes)));
  };
  const near = fix && !moved ? true : fix ? distanceMeters(fix, center) < 15 : false;
  const accuracy = fix?.accuracy ? t('location.accuracy', { meters: Math.round(fix.accuracy) }) : t('location.locating');
  return (
    <Overlay visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={styles.fill}>
        <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]} edges={['top', 'bottom']} testID="location-picker">
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('composer.closeSheet')} onPress={onClose} hitSlop={8} style={styles.icon} testID="location-picker-close">
            <Icon name="back" color={colors.ink} />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('location.search')}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={t('location.search')}
            returnKeyType="search"
            style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
            testID="location-search"
          />
        </View>
        {results ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${index}-${item.latitude}-${item.longitude}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searching ? (
                <ActivityIndicator style={styles.pad} color={colors.primary} />
              ) : (
                <Text variant="callout" tone="inkSoft" style={styles.pad}>
                  {searchFailed ? t('location.searchFailed') : t('location.noResults', { query: term })}
                </Text>
              )
            }
            renderItem={({ item, index }) => <SheetItem icon="location" label={item.name || item.address} detail={item.name ? item.address : undefined} onPress={() => choosePlace(item)} testID={`location-result-${index}`} />}
          />
        ) : (
          <>
            <TileMap
              center={center}
              zoom={zoom}
              onMove={move}
              crosshair={moved}
              markers={fix ? [{ key: 'self', point: fix, kind: 'self' }] : []}
              label={t('location.mapLabel')}
              style={styles.fill}
              testID="location-map"
              overlay={
                fix ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('location.myLocation')} onPress={goHome} style={[styles.home, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="location-home">
                    <Icon name="location" size={20} color={near ? colors.infoInk : colors.ink} />
                  </Pressable>
                ) : null
              }
            />
            <View style={[styles.panel, { backgroundColor: colors.surface, borderTopColor: colors.line }]}>
              {allowed === false ? (
                <SheetItem icon="lock" label={t('location.blockedTitle')} detail={t('location.blockedBody')} onPress={openLocationSettings} testID="location-denied" />
              ) : !servicesOn ? (
                <SheetItem icon="alert" label={t('location.off')} detail={t('location.unavailable')} onPress={openLocationSettings} testID="location-off" />
              ) : (
                <>
                  <SheetItem icon="location" label={t('location.current')} detail={accuracy} disabled={!fix} onPress={sendCurrent} testID="location-send-current" />
                  <SheetItem icon="compass" label={t('location.live')} disabled={!fix} onPress={() => void shareLive()} testID="location-share-live" />
                </>
              )}
              {moved ? <SheetItem icon="pin" label={picked?.name || t('location.thisPlace')} detail={picked?.address || undefined} onPress={sendPicked} testID="location-send-picked" /> : null}
            </View>
          </>
        )}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  icon: { borderRadius: radius.pill, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, height: 44, borderRadius: radius.pill, paddingHorizontal: space.md, fontSize: 16 },
  panel: { borderTopWidth: stroke.hairline, paddingVertical: space.xs },
  home: { position: 'absolute', right: space.sm, bottom: space.xl, width: 44, height: 44, borderRadius: radius.pill, borderWidth: stroke.thin, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg },
});
