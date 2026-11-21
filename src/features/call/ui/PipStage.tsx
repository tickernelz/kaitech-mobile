import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { space } from '../../../theme';
import { Text } from '../../../ui/Text';
import { loadLiveKit, liveKit } from '../livekit';
import { videoTrack, type CallState } from '../call';
import { CallTile } from './CallTile';

export function PipStage({ call, status }: { call: CallState; status: string | null }) {
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(liveKit() !== null);

  useEffect(() => {
    if (ready) return;
    void loadLiveKit().then(() => setReady(true));
  }, [ready]);

  const person = call.focus ? call.people.find((item) => item.sid === call.focus?.sid) ?? null : null;
  const screen = ready && person && call.focus?.source === 'screen' ? videoTrack(person.sid, 'screen') : null;
  const VideoTrack = ready ? liveKit()?.VideoTrack : undefined;

  return (
    <View style={styles.fill} testID="call-pip">
      {status || !person ? (
        <View style={styles.center}>
          <Text variant="footnote" numberOfLines={2} style={styles.status} testID="call-pip-status">
            {status ?? (call.channelName || call.callerName)}
          </Text>
        </View>
      ) : screen && VideoTrack ? (
        <VideoTrack trackRef={screen as never} style={StyleSheet.absoluteFill} objectFit="contain" />
      ) : (
        <CallTile person={person} width={width} height={height} rounded={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.sm },
  status: { color: '#FFFFFF', textAlign: 'center' },
});
