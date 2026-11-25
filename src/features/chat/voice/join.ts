import { requireOptionalNativeModule } from 'expo';

type NativeVoice = { join(parts: string[], target: string): Promise<{ uri: string; durationMs: number }> };

export async function joinParts(parts: string[], target: string): Promise<string> {
  if (parts.length === 1) return parts[0];
  const native = requireOptionalNativeModule<NativeVoice>('KaitechVoice');
  if (!native) throw new Error('voiceJoinUnavailable');
  return (await native.join(parts, target)).uri;
}
