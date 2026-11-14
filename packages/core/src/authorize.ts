import { NorthstarError } from "./errors.js";
import { can, type Permission, type TenantContext } from "./tenancy.js";

export function authorize(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx, permission)) {
    throw new NorthstarError("FORBIDDEN", `Actor ${ctx.actor.type}:${ctx.actor.id} lacks permission ${permission}`, {
      details: { permission, actor: ctx.actor, organizationId: ctx.organizationId },
    });
  }
}

/** Guards against cross-tenant access in application code (defense in depth alongside Postgres RLS). */
export function assertSameTenant(ctx: TenantContext, resourceOrganizationId: string): void {
  if (ctx.organizationId !== resourceOrganizationId) {
    // Report NOT_FOUND rather than FORBIDDEN so resource existence is not leaked across tenants.
    throw new NorthstarError("NOT_FOUND", "Resource not found");
  }
}
