export function parseServerDate(value: string | false | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? '' : 'Z'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
