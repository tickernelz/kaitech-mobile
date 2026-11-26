import { ActivityIndicator, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export function ProgressRing({ received, total, size = 36, color, track }: { received: number; total: number; size?: number; color: string; track: string }) {
  if (total <= 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={color} />
      </View>
    );
  }
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const share = Math.max(0, Math.min(1, received / total));
  const center = size / 2;
  return (
    <Svg width={size} height={size} accessible={false} testID="download-ring">
      <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${length * share} ${length}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}
