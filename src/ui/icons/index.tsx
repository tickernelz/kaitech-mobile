import { useMemo, useId } from 'react';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { plan, type IconName, type IconVariant, type Paint } from './glyphs';

export { iconNames, type IconName, type IconVariant } from './glyphs';

function paint(p: Paint, color: string, key: number) {
  return (
    <Path
      key={key}
      d={p.d}
      fill={p.fill ? color : 'none'}
      stroke={p.stroke ? color : 'none'}
      strokeWidth={p.width}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeMiterlimit={4}
    />
  );
}

export function Icon({ name, color, size = 24, variant = 'line' }: { name: IconName; color: string; size?: number; variant?: IconVariant }) {
  const maskId = `icon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { rotate, masked, cutouts, over } = useMemo(() => plan(name, variant, size), [name, variant, size]);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} importantForAccessibility="no-hide-descendants" testID={`icon-${name}`}>
      {cutouts.length ? (
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
            <Rect width={24} height={24} fill="#FFFFFF" />
            {cutouts.map((p, i) => paint(p, '#000000', i))}
          </Mask>
        </Defs>
      ) : null}
      <G transform={rotate ? `rotate(${rotate} 12 12)` : undefined}>
        <G mask={cutouts.length ? `url(#${maskId})` : undefined}>{masked.map((p, i) => paint(p, color, i))}</G>
        {over.map((p, i) => paint(p, color, i))}
      </G>
    </Svg>
  );
}
