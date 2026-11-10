/**
 * Role-based access control. The database (RLS) is the enforcement layer; this matrix mirrors it so
 * the UI and API can hide or reject actions early with a clear message. Keep in sync with
 * packages/db/migrations (app.can_write, app.can_delete, audit and membership policies); the test suite
 * asserts the shared cases.
 */
export const ROLES = ['owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  acquisitions: 'Acquisitions',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export const PERMISSIONS = {
  'records.read': ['owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer'],
  'records.write': ['owner', 'admin', 'manager', 'acquisitions', 'analyst'],
  'records.delete': ['owner', 'admin', 'manager'],
  'underwriting.run': ['owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer'],
  'underwriting.save': ['owner', 'admin', 'manager', 'acquisitions', 'analyst'],
  'underwriting.finalize': ['owner', 'admin', 'manager'],
  'members.read': ['owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer'],
  'members.manage': ['owner', 'admin'],
  'members.grant_owner': ['owner'],
  'audit.read': ['owner', 'admin'],
  'org.settings': ['owner', 'admin'],
  'billing.manage': ['owner'],
  'suppressions.create': ['owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Your role does not allow: ${permission}`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}
