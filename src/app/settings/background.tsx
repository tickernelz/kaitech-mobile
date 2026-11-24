import { useLocalSearchParams } from 'expo-router';
import { memo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useSession } from '../../auth/session';
import { BackgroundPaint } from '../../features/appearance/ChatBackground';
import { backgroundFor, changeAppearance, plainColors, presetBackground, useChatAppearance, type Background, type Scope } from '../../features/appearance/appearance';
import { pickDevicePhoto, setDim, useDevicePhoto, useDim } from '../../features/appearance/devicePhoto';
import { Wallpaper, wallpapers } from '../../features/appearance/wallpapers';
import { SettingsPage } from '../../screens/SettingsPage';
import { radius, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import { Slider } from '../../ui/Slider';
import { Text } from '../../ui/Text';

function same(a: Background | null, b: Background | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return 'value' in a && 'value' in b ? a.value === b.value : true;
}

const Tile = memo(function Tile({
  label,
  selected,
  onPress,
  testID,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[styles.tile, { borderColor: selected ? colors.primary : colors.line, borderWidth: selected ? 3 : StyleSheet.hairlineWidth, backgroundColor: colors.surface2 }]}>
      {children}
      {selected ? (
        <View style={[styles.tick, { backgroundColor: colors.primary }]}>
          <Icon name="check" size={16} color={colors.onPrimary} />
        </View>
      ) : null}
    </Pressable>
  );
});

function IconFace({ name }: { name: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={styles.iconFace}>
      <Icon name={name} size={28} color={colors.inkSoft} />
    </View>
  );
}

export default function BackgroundSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const params = useLocalSearchParams<{ channel?: string }>();
  const channelId = Number(params.channel) > 0 ? Number(params.channel) : null;
  const scope: Scope = channelId ?? 'all';
  const accountId = active?.id ?? null;
  const appearance = useChatAppearance(accountId);
  const devicePhoto = useDevicePhoto(accountId, scope);
  const dim = useDim(accountId);
  const [failed, setFailed] = useState(false);
  if (!active) return null;
  const shown = channelId ? backgroundFor(appearance, channelId) : { background: appearance.background, scope: 'all' as const };
  const chosen = channelId ? (appearance.conversations[String(channelId)] ?? null) : appearance.background;

  const choose = (background: Background | null) => {
    const patch = channelId ? { conversations: { [String(channelId)]: background } } : background ? { background } : null;
    if (!patch) return;
    void changeAppearance(active, patch).then((code) => setFailed(code !== null));
  };
  const chooseDevice = () =>
    void pickDevicePhoto(active.id, scope)
      .then((picked) => picked && choose({ kind: 'device' }))
      .catch(() => setFailed(true));

  return (
    <SettingsPage title={channelId ? t('appearance.conversationBackground') : t('appearance.background')} testID="settings-background-screen">
      <View style={[styles.preview, { borderColor: colors.line }]} testID="background-preview">
        <BackgroundPaint background={shown.background} scope={shown.scope} accountId={accountId} />
        <View style={[styles.bubble, styles.theirs, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text variant="callout">{t('appearance.sampleTheirs')}</Text>
        </View>
        <View style={[styles.bubble, styles.mine, { backgroundColor: colors.select, borderColor: colors.select }]}>
          <Text variant="callout" tone="selectInk">
            {t('appearance.sampleMine')}
          </Text>
        </View>
      </View>
      <View style={styles.dim}>
        <Icon name="eye" size={20} color={colors.inkSoft} />
        <View style={styles.flex}>
          <Slider value={dim} max={0.8} label={t('appearance.dim')} onChange={(next) => setDim(active.id, next)} testID="background-dim-slider" />
        </View>
      </View>
      <View style={styles.grid}>
        {channelId ? (
          <Tile label={t('appearance.followDefault')} selected={chosen === null} onPress={() => choose(null)} testID="background-follow">
            <IconFace name="retry" />
          </Tile>
        ) : null}
        {wallpapers.map((wallpaper) => {
          const background = presetBackground(wallpaper.id);
          const selected = same(chosen, background) || (!channelId && wallpaper.id === 'doodle' && chosen?.kind === 'default');
          return (
            <Tile key={wallpaper.id} label={t(wallpaper.nameKey)} selected={selected} onPress={() => choose(background)} testID={`background-preset-${wallpaper.id}`}>
              <Wallpaper id={wallpaper.id} />
            </Tile>
          );
        })}
        {plainColors.map((value) => (
          <Tile key={value} label={t('appearance.color', { value })} selected={same(chosen, { kind: 'color', value })} onPress={() => choose({ kind: 'color', value })} testID={`background-color-${value}`}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: value }]} />
          </Tile>
        ))}
        <Tile label={t('appearance.devicePhoto')} selected={chosen?.kind === 'device'} onPress={chooseDevice} testID="background-device">
          {devicePhoto ? <Image source={{ uri: devicePhoto }} resizeMethod="resize" style={StyleSheet.absoluteFill} /> : <IconFace name="image" />}
        </Tile>
      </View>
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
          {t('appearance.failed')}
        </Text>
      ) : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { height: 200, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: space.md, gap: space.sm, justifyContent: 'center' },
  bubble: { maxWidth: '75%', borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingVertical: space.sm },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.sm },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.sm },
  dim: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: 96, height: 128, borderRadius: radius.md, overflow: 'hidden' },
  tick: { position: 'absolute', right: space.xs, top: space.xs, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconFace: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
