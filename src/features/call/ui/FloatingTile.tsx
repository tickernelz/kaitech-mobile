import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, type GestureResponderEvent } from 'react-native';
import type { CallPerson } from '../call';
import { CallTile } from './CallTile';
import type { PipSize } from './pipVideo';

export const floatingTile = { width: 96, height: 128, corner: 12 } as const;

const tapSlop = 6;

type Corner = { right: boolean; bottom: boolean };

export function FloatingTile({
  person,
  area,
  top,
  bottom,
  side,
  pip,
  onSwap,
}: {
  person: CallPerson;
  area: { width: number; height: number };
  top: number;
  bottom: number;
  side: number;
  pip: PipSize | null;
  onSwap: () => void;
}) {
  const { t } = useTranslation('call');
  const [corner, setCorner] = useState<Corner>({ right: true, bottom: true });
  const [drag] = useState(() => new Animated.ValueXY());
  const start = useRef({ x: 0, y: 0 });

  const begin = (event: GestureResponderEvent) => {
    start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  };
  const move = (event: GestureResponderEvent) => {
    drag.setValue({ x: event.nativeEvent.pageX - start.current.x, y: event.nativeEvent.pageY - start.current.y });
  };
  const end = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    drag.setValue({ x: 0, y: 0 });
    if (Math.abs(pageX - start.current.x) < tapSlop && Math.abs(pageY - start.current.y) < tapSlop) {
      onSwap();
      return;
    }
    setCorner({ right: pageX > area.width / 2, bottom: pageY > area.height / 2 });
  };

  return (
    <Animated.View
      onStartShouldSetResponder={() => true}
      onResponderGrant={begin}
      onResponderMove={move}
      onResponderRelease={end}
      onResponderTerminate={() => drag.setValue({ x: 0, y: 0 })}
      accessible
      accessibilityRole="button"
      accessibilityLabel={person.local ? t('you') : person.name}
      onAccessibilityTap={onSwap}
      style={[
        styles.float,
        corner.right ? { right: side } : { left: side },
        corner.bottom ? { bottom } : { top },
        { transform: drag.getTranslateTransform() },
      ]}
      testID="call-self-tile">
      <CallTile person={person} width={floatingTile.width} height={floatingTile.height} corner={floatingTile.corner} bare pip={pip} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  float: { position: 'absolute', width: floatingTile.width, height: floatingTile.height, borderRadius: floatingTile.corner, elevation: 6 },
});
