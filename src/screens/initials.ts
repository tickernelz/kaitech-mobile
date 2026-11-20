export function initials(name: string): string {
  const parts = name.split(/\s+/).map((word) => word.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'K';
}
