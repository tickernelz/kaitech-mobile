import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import { loadLiveKit, liveKit } from '../livekit';
import { videoTrack, type CallPerson } from '../call';
import { CallTile } from './CallTile';
import { pipVideo, type PipSize } from './pipVideo';

const stripTile = { width: 112, height: 84 };

export function ScreenStage({
  presenter,
  people,
  side,
  onStop,
  pip,
}: {
  presenter: CallPerson;
  people: CallPerson[];
  side: boolean;
  onStop: () => void;
  pip: { sid: string; source: 'camera' | 'screen'; size: PipSize } | null;
}) {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const [ready, setReady] = useState(liveKit() !== null);

  useEffect(() => {
    if (ready) return;
    void loadLiveKit().then(() => setReady(true));
  }, [ready]);

  const track = ready && !presenter.local ? videoTrack(presenter.sid, 'screen') : null;
  const VideoTrack = ready ? liveKit()?.VideoTrack : undefined;

  return (
    <View style={[styles.fill, side ? styles.row : null]}>
      <View style={[styles.screen, { backgroundColor: presenter.local ? colors.surface2 : colors.stage }]} testID="call-screen-share">
        {presenter.local ? (
          <View style={styles.center}>
            <Icon name="screenShare" size={40} color={colors.primary} />
            <Text variant="body" style={styles.note} testID="call-screen-share-own">
              {t('youAreSharing')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onStop} style={[styles.stop, { backgroundColor: colors.danger }]} testID="call-screen-share-stop">
              <Text variant="callout" style={{ color: colors.onPrimary }}>
                {t('stopSharing')}
              </Text>
            </Pressable>
          </View>
        ) : track && VideoTrack ? (
          <VideoTrack trackRef={track as never} style={StyleSheet.absoluteFill} objectFit="contain" iosPIP={pipVideo(pip?.source === 'screen' && pip.sid === presenter.sid ? pip.size : null)} />
        ) : (
          <View style={styles.center}>
            <Icon name="screenShare" size={40} color={colors.inkFaint} />
          </View>
        )}
        {presenter.local ? null : (
          <View style={[styles.label, { backgroundColor: colors.stageScrim }]}>
            <Text variant="footnote" numberOfLines={1} style={{ color: colors.onStage }}>
              {t('screenOf', { name: presenter.name })}
            </Text>
          </View>
        )}
      </View>
      {people.length ? (
        <ScrollView horizontal={!side} style={side ? styles.sideStrip : styles.strip} contentContainerStyle={styles.stripInner} testID="call-screen-share-people">
          {people.map((person) => (
            <CallTile key={person.sid} person={person} width={stripTile.width} height={stripTile.height} rounded pip={pip?.source === 'camera' && pip.sid === person.sid ? pip.size : null} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: space.sm },
  row: { flexDirection: 'row' },
  screen: { flex: 1, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  note: { textAlign: 'center' },
  stop: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 24, minHeight: 44, justifyContent: 'center' },
  label: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  strip: { flexGrow: 0 },
  sideStrip: { flexGrow: 0, width: 120 },
  stripInner: { gap: space.sm },
});
