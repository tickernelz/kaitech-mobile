import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export function fitWithin(width: number, height: number, longest: number): { width: number; height: number } | null {
  if (width <= 0 || height <= 0 || Math.max(width, height) <= longest) return null;
  const scale = longest / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function shrinkToJpeg(uri: string, width: number, height: number, longest: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const size = fitWithin(width, height, longest);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}
