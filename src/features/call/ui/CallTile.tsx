import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Avatar } from '../../chat/ui/Avatar';
import { Icon } from '../../chat/ui/icons';
import { loadLiveKit, liveKit } from '../livekit';
import { videoTrack, type CallPerson } from '../call';
import { pipVideo, type PipSize } from './pipVideo';

const minAvatar = 16;

export function CallTile({ person, width, height, rounded, pip }: { person: CallPerson; width: number; height: number; rounded: boolean; pip?: PipSize | null }) {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const [ready, setReady] = useState(liveKit() !== null);

  useEffect(() => {
    if (ready) return;
    void loadLiveKit().then(() => setReady(true));
  }, [ready]);

  const track = ready && person.cameraOn ? videoTrack(person.sid) : null;
  const VideoTrack = ready ? liveKit()?.VideoTrack : undefined;
  const frame = { width, height, borderRadius: rounded ? 18 : 0 };

  return (
    <View style={[styles.frame, frame, { backgroundColor: colors.surface2, borderColor: person.speaking ? colors.primary : 'transparent' }]} testID={`call-tile-${person.sid}`}>
      {track && VideoTrack ? (
        <VideoTrack trackRef={track as never} style={StyleSheet.absoluteFill} objectFit="cover" mirror={person.local} iosPIP={pipVideo(pip)} />
      ) : (
        <View style={styles.center}>
          <Avatar name={person.name} seed={person.partnerId ?? person.sid.length} size={Math.max(minAvatar, Math.min(width, height) * 0.42)} />
        </View>
      )}
      <View style={styles.label}>
        <Text variant="footnote" numberOfLines={1} style={styles.name}>
          {person.local ? t('you') : person.name}
        </Text>
        {person.micOn ? null : <Icon name="muted" size={14} color={colors.inkFaint} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: 2, justifyContent: 'flex-end' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, backgroundColor: 'rgba(0,0,0,0.28)' },
  name: { color: '#FFFFFF', flexShrink: 1 },
});
