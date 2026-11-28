export type Role = 'external' | 'internal' | 'admin' | 'superadmin';

export type Capability =
  | 'team'
  | 'client.home'
  | 'users.manage'
  | 'users.manage_admins'
  | 'mom.admin'
  | 'mcp.full_access'
  | 'settings'
  | 'programmes.all'
  | 'wa.owner'
  | 'support.manage'
  | 'demo.manage';

export type Access = { role: Role | null; capabilities: string[] };

export const roles: readonly Role[] = ['external', 'internal', 'admin', 'superadmin'];

export const legacyAccess: Access = { role: null, capabilities: ['team'] };

export function roleOf(value: unknown): Role | null {
  return roles.find((role) => role === value) ?? null;
}

export function accessFrom(body: unknown): Access | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const { role, capabilities } = body as Record<string, unknown>;
  if (!Array.isArray(capabilities)) return null;
  return { role: roleOf(role), capabilities: capabilities.filter((item): item is string => typeof item === 'string').sort() };
}

export function sameAccess(a: Access | undefined, b: Access | undefined): boolean {
  if (!a || !b) return a === b;
  return a.role === b.role && a.capabilities.length === b.capabilities.length && a.capabilities.every((item, index) => item === b.capabilities[index]);
}

export function can(access: Access, capability: Capability): boolean {
  return access.capabilities.includes(capability);
}

export function isClient(access: Access): boolean {
  return !can(access, 'team');
}
