export type DirectoryRole = 'Coworker' | 'Lead' | 'Team';

export type DirectoryPerson = { partnerId: number; name: string; role: DirectoryRole; programme: string };

const directoryRoles: readonly DirectoryRole[] = ['Coworker', 'Lead', 'Team'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function directoryFrom(body: unknown): DirectoryPerson[] {
  if (!isRecord(body) || !Array.isArray(body.people)) throw new Error('directory_invalid');
  const seen = new Set<string>();
  return body.people.flatMap((row): DirectoryPerson[] => {
    if (!isRecord(row) || typeof row.partner_id !== 'number' || row.partner_id <= 0 || typeof row.name !== 'string') return [];
    const role = directoryRoles.find((candidate) => candidate === row.role) ?? 'Team';
    const programme = typeof row.programme === 'string' ? row.programme : '';
    const key = `${row.partner_id}|${programme}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ partnerId: row.partner_id, name: row.name, role, programme }];
  });
}

export function openedChatId(body: unknown): number {
  const id = isRecord(body) ? body.id : null;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new Error('chat_open_invalid');
  return id;
}
