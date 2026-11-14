import { z } from "zod";

export const Role = z.enum(["owner", "admin", "manager", "acquisitions", "analyst", "viewer"]);
export type Role = z.infer<typeof Role>;

export const Permission = z.enum([
  "org.manage",
  "billing.manage",
  "members.manage",
  "integrations.manage",
  "leads.read",
  "leads.write",
  "leads.delete",
  "conversations.read",
  "conversations.send",
  "properties.read",
  "properties.research",
  "underwriting.read",
  "underwriting.run",
  "offers.approve",
  "workflows.read",
  "workflows.manage",
  "agents.manage",
  "audit.read",
  "compliance.manage",
]);
export type Permission = z.infer<typeof Permission>;

const ALL = Permission.options;
const READ_ONLY: Permission[] = [
  "leads.read",
  "conversations.read",
  "properties.read",
  "underwriting.read",
  "workflows.read",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(ALL),
  admin: new Set(ALL.filter((p) => p !== "billing.manage")),
  manager: new Set<Permission>([
    ...READ_ONLY,
    "leads.write",
    "leads.delete",
    "conversations.send",
    "properties.research",
    "underwriting.run",
    "offers.approve",
    "workflows.manage",
    "audit.read",
    "compliance.manage",
  ]),
  acquisitions: new Set<Permission>([
    ...READ_ONLY,
    "leads.write",
    "conversations.send",
    "properties.research",
    "underwriting.run",
  ]),
  analyst: new Set<Permission>([...READ_ONLY, "properties.research", "underwriting.run"]),
  viewer: new Set<Permission>(READ_ONLY),
};

export type ActorType = "user" | "agent" | "system";

export interface Actor {
  type: ActorType;
  id: string;
  /** Human-readable name for audit display. */
  display?: string;
}

/** Request-scoped tenant context. Every data access and workflow step requires one. */
export interface TenantContext {
  organizationId: string;
  actor: Actor;
  /** Effective permissions. For agents this is the agent's scoped grant, never a user's full role. */
  permissions: ReadonlySet<Permission>;
  requestId?: string;
}

export function contextForRole(organizationId: string, actor: Actor, role: Role): TenantContext {
  return { organizationId, actor, permissions: ROLE_PERMISSIONS[role] };
}

export function can(ctx: TenantContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}
