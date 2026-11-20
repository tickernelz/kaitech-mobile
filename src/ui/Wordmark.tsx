import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { wordmarkBar, wordmarkBox, wordmarkPath } from './wordmarkPath';

export function Wordmark({ width, label }: { width: number; label: string }) {
  const { colors, scheme } = useTheme();
  const height = (width * wordmarkBox.height) / wordmarkBox.width;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${wordmarkBox.x} ${wordmarkBox.y} ${wordmarkBox.width} ${wordmarkBox.height}`}
      accessibilityRole="image"
      accessibilityLabel={label}>
      <Defs>
        <LinearGradient id="wordmarkBar" x1="905" y1="413" x2="1053" y2="370" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={scheme === 'dark' ? '#B18BD3' : '#441D65'} />
          <Stop offset="1" stopColor="#FF5A5A" />
        </LinearGradient>
      </Defs>
      <Path d={wordmarkPath} fill={colors.wordmark} />
      <Rect {...wordmarkBar} fill="url(#wordmarkBar)" />
    </Svg>
  );
}
