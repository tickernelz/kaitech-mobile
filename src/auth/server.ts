import { AppError } from './errors';

const hostPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$|^localhost$|^\d{1,3}(?:\.\d{1,3}){3}$/;

export function normalizeServer(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) throw new AppError('serverRequired');
  const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/?#]*)/.exec(raw);
  const scheme = match?.[1] ?? 'https';
  const authority = match?.[2] ?? '';
  if (scheme === 'http') throw new AppError('serverInsecure');
  if (scheme !== 'https' || authority.includes('@')) throw new AppError('serverInvalid');
  const [host, port, extra] = authority.split(':');
  if (extra !== undefined || !hostPattern.test(host)) throw new AppError('serverInvalid');
  if (port !== undefined && !/^\d{1,5}$/.test(port)) throw new AppError('serverInvalid');
  return port && port !== '443' ? `https://${host}:${port}` : `https://${host}`;
}

export function normalizeDatabase(input: string): string {
  const name = input.trim();
  if (!name) throw new AppError('databaseRequired');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(name)) throw new AppError('databaseInvalid');
  return name;
}
