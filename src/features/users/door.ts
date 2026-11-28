import { roleOf, type Role } from '../../auth/access';

export type Person = {
  id: number;
  name: string;
  login: string;
  email: string | null;
  role: Role;
  capabilities: string[];
  active: boolean;
  programmes: number;
};

export type Change = {
  at: string;
  actor: string | null;
  change: 'role' | 'capability' | 'invite' | 'deactivate' | 'reactivate' | 'token_revoked';
  fromRole: Role | null;
  toRole: Role | null;
  capability: string | null;
  via: string;
};

export type May = { setRole: Role[]; capabilities: boolean; deactivate: boolean; reactivate: boolean };

export type Programme = { id: number; name: string };

export type Detail = Person & { programmeList: Programme[]; history: Change[]; may: May };

export type Overview = { total: number; people: Person[]; actorRole: Role | null };

export type Filter = 'all' | Role | 'inactive';

export const filters: readonly Filter[] = ['all', 'superadmin', 'admin', 'internal', 'external', 'inactive'];

export type CapabilityName = 'architect' | 'programmes_all' | 'wa_owner' | 'lesson_curator' | 'support_manager' | 'controller' | 'process_owner' | 'sponsor';

export const capabilitiesFor: Record<'external' | 'internal', readonly CapabilityName[]> = {
  external: ['controller', 'process_owner', 'sponsor'],
  internal: ['architect', 'programmes_all', 'wa_owner', 'lesson_curator', 'support_manager'],
};

const changes: readonly Change['change'][] = ['role', 'capability', 'invite', 'deactivate', 'reactivate', 'token_revoked'];

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function personFrom(value: unknown): Person | null {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.name !== 'string') return null;
  const role = roleOf(value.role);
  if (!role) return null;
  return {
    id: value.id,
    name: value.name,
    login: typeof value.login === 'string' ? value.login : '',
    email: typeof value.email === 'string' && value.email ? value.email : null,
    role,
    capabilities: strings(value.capabilities),
    active: value.active !== false,
    programmes: typeof value.programmes === 'number' ? value.programmes : 0,
  };
}

function changeFrom(value: unknown): Change | null {
  if (!isRecord(value)) return null;
  const change = changes.find((kind) => kind === value.change);
  if (!change || typeof value.at !== 'string') return null;
  return {
    at: value.at,
    actor: typeof value.actor === 'string' ? value.actor : null,
    change,
    fromRole: roleOf(value.from_role),
    toRole: roleOf(value.to_role),
    capability: typeof value.capability === 'string' ? value.capability : null,
    via: typeof value.via === 'string' ? value.via : '',
  };
}

export function overviewFrom(value: unknown): Overview {
  if (!isRecord(value) || !Array.isArray(value.people)) throw new Error('overview_invalid');
  return {
    total: typeof value.total === 'number' ? value.total : 0,
    people: value.people.map(personFrom).filter((person): person is Person => person !== null),
    actorRole: roleOf(value.actor_role),
  };
}

function programmeFrom(value: unknown): Programme | null {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.name !== 'string') return null;
  return { id: value.id, name: value.name };
}

export function detailFrom(value: unknown): Detail {
  const person = personFrom(value);
  if (!person || !isRecord(value)) throw new Error('detail_invalid');
  const may = isRecord(value.may) ? value.may : {};
  return {
    ...person,
    programmeList: Array.isArray(value.programme_list) ? value.programme_list.map(programmeFrom).filter((programme): programme is Programme => programme !== null) : [],
    history: Array.isArray(value.history) ? value.history.map(changeFrom).filter((change): change is Change => change !== null) : [],
    may: {
      setRole: strings(may.set_role).map(roleOf).filter((role): role is Role => role !== null),
      capabilities: may.capabilities === true,
      deactivate: may.deactivate === true,
      reactivate: may.reactivate === true,
    },
  };
}

export function filterQuery(filter: Filter): { role: Role | false; active: boolean } {
  if (filter === 'inactive') return { role: false, active: false };
  return { role: filter === 'all' ? false : filter, active: true };
}

export function lastRoleChange(detail: Detail): Change | null {
  return detail.history.find((change) => change.change === 'role') ?? null;
}

export function capabilityKind(role: Role): 'external' | 'internal' {
  return role === 'external' ? 'external' : 'internal';
}

export function needsSuperadmin(actor: Role | null, role: Role): boolean {
  return actor !== 'superadmin' && (role === 'admin' || role === 'superadmin');
}
