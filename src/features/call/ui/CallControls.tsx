import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon, type IconName } from '../../../ui/icons';
import type { CallPerson } from '../call';
import type { CallAction } from '../controls';

export type ControlState = {
  muted: boolean;
  cameraOn: boolean;
  speaker: boolean;
  sharing: boolean;
  recording: { on: boolean; busy: boolean } | null;
};

type Look = { icon: IconName; label: string; active?: boolean; danger?: boolean; busy?: boolean };

function useLook() {
  const { t } = useTranslation('call');
  return (action: CallAction, state: ControlState): Look => {
    switch (action) {
      case 'mute':
        return { icon: state.muted ? 'micOff' : 'mic', label: state.muted ? t('unmute') : t('mute'), active: state.muted };
      case 'camera':
        return { icon: state.cameraOn ? 'video' : 'videoOff', label: state.cameraOn ? t('cameraTurnOff') : t('cameraOn'), active: !state.cameraOn };
      case 'flip':
        return { icon: 'cameraFlip', label: t('flip') };
      case 'speaker':
        return { icon: 'speaker', label: state.speaker ? t('earpiece') : t('speaker'), active: state.speaker };
      case 'share':
        return { icon: 'screenShare', label: state.sharing ? t('stopSharing') : t('shareScreen'), danger: state.sharing };
      case 'record':
        return { icon: 'record', label: state.recording?.on ? t('stopRecording') : t('startRecording'), active: state.recording?.on, busy: state.recording?.busy };
      case 'people':
        return { icon: 'people', label: t('people') };
      case 'pip':
        return { icon: 'pip', label: t('pictureInPicture') };
      case 'more':
        return { icon: 'more', label: t('more') };
      case 'close':
        return { icon: 'close', label: t('close') };
      case 'hangup':
        return { icon: 'phoneEnd', label: t('hangUp'), danger: true };
    }
  };
}

export function RoundButton({
  icon,
  label,
  onPress,
  onStage,
  active,
  danger,
  busy,
  size = 52,
  testID,
}: Look & { onPress: () => void; onStage: boolean; size?: number; testID?: string }) {
  const { colors } = useTheme();
  const fill = danger ? colors.danger : active ? (onStage ? colors.onStage : colors.primary) : 'transparent';
  const ink = danger ? colors.onPrimary : active ? (onStage ? colors.stage : colors.onPrimary) : onStage ? colors.onStage : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: Boolean(busy), selected: active }}
      disabled={busy}
      hitSlop={4}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.round, { width: size, height: size, backgroundColor: fill, opacity: pressed ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={ink} /> : <Icon name={icon} size={24} color={ink} variant={active ? 'fill' : 'line'} />}
    </Pressable>
  );
}

export function CallPill({
  actions,
  state,
  onStage,
  vertical,
  shown,
  motion,
  onAction,
  onTouch,
}: {
  actions: CallAction[];
  state: ControlState;
  onStage: boolean;
  vertical: boolean;
  shown: boolean;
  motion: AnimatedStyle<ViewStyle>;
  onAction: (action: CallAction) => void;
  onTouch: () => void;
}) {
  const { colors } = useTheme();
  const look = useLook();
  return (
    <Animated.View
      pointerEvents={shown ? 'box-none' : 'none'}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!shown}
      style={motion}>
      <View
        onTouchStart={onTouch}
        style={[styles.pill, vertical ? styles.pillColumn : styles.pillRow, { backgroundColor: onStage ? colors.stageScrim : colors.surface2 }]}
        testID="call-controls">
        {actions.map((action) => (
          <View key={action} style={action === 'hangup' ? (vertical ? styles.endColumn : styles.endRow) : null}>
            <RoundButton {...look(action, state)} onStage={onStage} onPress={() => onAction(action)} testID={`call-${action}`} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

export function MoreSheet({
  view,
  actions,
  state,
  people,
  onAction,
  onClose,
}: {
  view: 'more' | 'people' | null;
  actions: CallAction[];
  state: ControlState;
  people: CallPerson[];
  onAction: (action: CallAction) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const look = useLook();
  return (
    <Modal visible={view !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.scrim }]} testID="call-sheet-backdrop" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md }]} testID={`call-sheet-${view ?? 'closed'}`}>
        <View style={[styles.grabber, { backgroundColor: colors.lineStrong }]} />
        {view === 'people' ? (
          <ScrollView style={styles.peopleList}>
            <Text variant="headline" accessibilityRole="header" style={styles.sheetTitle}>
              {t('people')}
            </Text>
            {people.map((person) => (
              <View key={person.sid} style={styles.sheetRow}>
                <Icon name={person.micOn ? 'mic' : 'micOff'} size={20} color={person.speaking ? colors.primary : colors.inkSoft} />
                <Text variant="body" numberOfLines={1} style={styles.flex}>
                  {person.local ? t('you') : person.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          actions.map((action) => {
            const item = look(action, state);
            return (
              <Pressable
                key={action}
                accessibilityRole="button"
                accessibilityState={{ busy: Boolean(item.busy), selected: item.active }}
                disabled={item.busy}
                onPress={() => onAction(action)}
                testID={`call-sheet-${action}`}
                style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: colors.surface2 }]}>
                <Icon name={item.icon} size={24} color={item.active ? colors.primary : colors.ink} variant={item.active ? 'fill' : 'line'} />
                <Text variant="body" style={styles.flex}>
                  {item.label}
                </Text>
                {item.busy ? <ActivityIndicator color={colors.inkSoft} /> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.pill, padding: space.sm, gap: space.sm, alignItems: 'center' },
  pillRow: { flexDirection: 'row' },
  pillColumn: { flexDirection: 'column' },
  endRow: { marginLeft: space.sm },
  endColumn: { marginTop: space.sm },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.sm, maxHeight: '70%' },
  grabber: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginBottom: space.sm },
  sheetTitle: { paddingHorizontal: space.xl, paddingVertical: space.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 52, paddingHorizontal: space.xl },
  peopleList: { flexGrow: 0 },
});
