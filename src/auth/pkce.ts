import * as Crypto from 'expo-crypto';

export type Pkce = { verifier: string; challenge: string; state: string };

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += alphabet[(chunk >> (18 - 6 * j)) & 63];
  }
  return out;
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkce(): Promise<Pkce> {
  const verifier = base64Url(Crypto.getRandomBytes(32));
  return { verifier, challenge: await challengeFor(verifier), state: base64Url(Crypto.getRandomBytes(24)) };
}
