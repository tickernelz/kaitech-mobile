export function initials(name: string): string {
  const parts = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part));
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'K';
}
