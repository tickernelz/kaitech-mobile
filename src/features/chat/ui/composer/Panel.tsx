import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn, useReducedMotion, withTiming } from 'react-native-reanimated';
import { radius, space, useTheme } from '../../../../theme';
import { duration } from '../../../../theme/motion';
import { Icon, iconNames, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { stickerShelf, type StickerShelf } from '../../composerExtras';
import type { Result } from '../../messageActions';
import type { GifMedia, Sticker } from '../../types';
import { EmojiTab } from './panel/EmojiTab';
import { GifTab } from './panel/GifTab';
import { StickerTab } from './panel/StickerTab';
import { lastPanelTab, panelTabs, rememberPanelTab, handleOutcome, type PanelTab } from './panel/logic';

const tabGlyphs: Record<PanelTab, string> = { emoji: 'emoji', sticker: 'sticker', gif: 'gif' };
function tabEnter() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 8 }] },
    animations: { opacity: withTiming(1, { duration: duration.quick }), transform: [{ translateX: withTiming(0, { duration: duration.quick }) }] },
  };
}

export function ComposerPanel({
  origin,
  full,
  searching,
  onEmoji,
  onBackspace,
  onSticker,
  onGif,
  onSearching,
  onSize,
}: {
  origin: string;
  full: boolean;
  searching: boolean;
  onEmoji: (emoji: string) => void;
  onBackspace: () => void;
  onSticker: (sticker: Sticker) => void;
  onGif: (gif: GifMedia) => void;
  onSearching: (searching: boolean) => void;
  onSize: (next: 'full' | 'half' | 'close') => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<PanelTab>(lastPanelTab);
  const [gifQuery, setGifQuery] = useState('');
  const [shelf, setShelf] = useState<Result<StickerShelf> | null>(null);
  const [shelfVersion, setShelfVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void stickerShelf().then((result) => live && setShelf(result));
    return () => {
      live = false;
    };
  }, [shelfVersion]);
  const choose = useCallback((next: PanelTab) => {
    setTab(next);
    rememberPanelTab(next);
  }, []);
  const [drag, setDrag] = useState<{ y: number; at: number } | null>(null);
  const release = (y: number) => {
    if (!drag) return;
    const dy = y - drag.y;
    const vy = dy / Math.max(1, Date.now() - drag.at);
    setDrag(null);
    const outcome = Math.abs(dy) < 4 ? (full ? 'half' : 'full') : handleOutcome(dy, vy, full);
    if (outcome !== 'stay') onSize(outcome);
  };
  const handle = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (event: GestureResponderEvent) => setDrag({ y: event.nativeEvent.pageY, at: Date.now() }),
    onResponderRelease: (event: GestureResponderEvent) => release(event.nativeEvent.pageY),
    onResponderTerminate: () => setDrag(null),
  };
  const stickers = shelf?.ok ? shelf.value.packs.flatMap((pack) => pack.stickers) : [];
  return (
    <View style={[styles.panel, { backgroundColor: colors.canvas }]} testID="composer-panel">
      {searching ? null : (
        <View
          {...handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('panel.handle')}
          accessibilityValue={{ text: full ? t('panel.full') : t('panel.half') }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => onSize(event.nativeEvent.actionName === 'increment' ? 'full' : full ? 'half' : 'close')}
          style={styles.handleArea}
          testID="panel-handle">
          <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
        </View>
      )}
      <Animated.View key={tab} entering={reduce ? FadeIn.duration(duration.quick) : tabEnter} style={styles.content}>
        {tab === 'emoji' ? (
          <EmojiTab
            onPick={onEmoji}
            onBackspace={onBackspace}
            onSearching={onSearching}
            stickers={stickers}
            origin={origin}
            onSticker={onSticker}
            onSearchGif={(query) => {
              setGifQuery(query);
              choose('gif');
            }}
          />
        ) : tab === 'sticker' ? (
          <StickerTab shelf={shelf} origin={origin} onPick={onSticker} onSearching={onSearching} onShelfChanged={() => setShelfVersion((value) => value + 1)} />
        ) : (
          <GifTab initialQuery={gifQuery} onPick={onGif} onSearching={onSearching} />
        )}
      </Animated.View>
      {searching ? null : (
        <View style={[styles.tabs, { borderTopColor: colors.line }]} accessibilityRole="tablist">
          {panelTabs.map((key) => {
            const selected = key === tab;
            const glyph = tabGlyphs[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={t(`panel.${key}`)}
                accessibilityState={{ selected }}
                onPress={() => choose(key)}
                style={[styles.tab, selected && { backgroundColor: colors.select }]}
                testID={`panel-tab-${key}`}>
                {(iconNames as string[]).includes(glyph) ? (
                  <Icon name={glyph as IconName} variant={selected ? 'fill' : 'line'} color={selected ? colors.selectInk : colors.inkSoft} />
                ) : (
                  <Text variant="footnote" style={[styles.gifTab, { color: selected ? colors.selectInk : colors.inkSoft }]}>
                    GIF
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  handleArea: { height: 16, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 32, height: 4, borderRadius: radius.pill },
  content: { flex: 1, paddingHorizontal: space.sm, gap: space.xs },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
  tab: { minWidth: 64, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  gifTab: { fontWeight: '700', letterSpacing: 0.5 },
});
