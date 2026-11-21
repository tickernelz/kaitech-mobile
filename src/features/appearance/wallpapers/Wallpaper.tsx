import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useTheme, type Scheme } from '../../../theme';
import { glyphBox, glyphs, tiles, type Tile } from './motifs';
import { wallpaperById, type Field, type Look, type WallpaperId } from './presets';

const fieldId = 'wallpaperField';
const patternId = 'wallpaperPattern';

export function wallpaperLook(id: WallpaperId, scheme: Scheme): Look {
  return wallpaperById(id)[scheme];
}

function gridPath({ width, height, grid }: Tile): string {
  if (!grid) return '';
  const lines: string[] = [];
  for (let x = grid.step / 2; x < width; x += grid.step) lines.push(`M${x} 0V${height}`);
  for (let y = grid.step / 2; y < height; y += grid.step) lines.push(`M0 ${y}H${width}`);
  return lines.join('');
}

function FieldPaint({ field }: { field: Field }) {
  if (field.kind === 'solid') return null;
  return (
    <LinearGradient id={fieldId} x1={`${field.from[0] * 100}%`} y1={`${field.from[1] * 100}%`} x2={`${field.to[0] * 100}%`} y2={`${field.to[1] * 100}%`}>
      {field.stops.map(([offset, color]) => (
        <Stop key={offset} offset={offset} stopColor={color} />
      ))}
    </LinearGradient>
  );
}

function TilePattern({ pattern }: { pattern: NonNullable<Look['pattern']> }) {
  const tile = tiles[pattern.name];
  const accent = pattern.accent ?? pattern.color;
  return (
    <Pattern id={patternId} patternUnits="userSpaceOnUse" x={0} y={0} width={tile.width} height={tile.height}>
      <G opacity={pattern.opacity}>
        {tile.grid ? <Path d={gridPath(tile)} stroke={pattern.color} strokeWidth={tile.grid.stroke} fill="none" /> : null}
        {tile.marks.map((mark, index) => {
          const glyph = glyphs[mark.glyph];
          const scale = mark.size / glyphBox;
          const paint = mark.accent ? accent : pattern.color;
          return (
            <G key={index} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotate}) scale(${scale}) translate(${-glyphBox / 2} ${-glyphBox / 2})`}>
              <Path
                d={glyph.d}
                fill={'fill' in glyph ? paint : 'none'}
                stroke={'fill' in glyph ? 'none' : paint}
                strokeWidth={tile.stroke / scale}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          );
        })}
      </G>
    </Pattern>
  );
}

export const Wallpaper = memo(function Wallpaper({ id, scheme, style }: { id: WallpaperId; scheme?: Scheme; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const look = wallpaperLook(id, scheme ?? theme.scheme);
  const { field, pattern, scrim } = look;
  const base = field.kind === 'solid' ? field.color : field.stops[0][1];
  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: base }, style]} testID={`wallpaper-${id}`}>
      <Svg width="100%" height="100%">
        <Defs>
          <FieldPaint field={field} />
          {pattern ? <TilePattern pattern={pattern} /> : null}
        </Defs>
        <Rect width="100%" height="100%" fill={field.kind === 'solid' ? field.color : `url(#${fieldId})`} />
        {pattern ? <Rect width="100%" height="100%" fill={`url(#${patternId})`} /> : null}
        {scrim ? <Rect width="100%" height="100%" fill={scrim.color} opacity={scrim.opacity} /> : null}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
});
