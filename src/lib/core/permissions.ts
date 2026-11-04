/**
 * Permission Management. Roles give defaults; extra permissions are granted per user (UserPermission).
 * Systems are separated: messaging (social.*) and advertising (marketing.*) never imply each other,
 * and NAJM AI has no marketing permission at all.
 */
import type { Role } from '../rbac';

export const PERMISSIONS = [
  'command.view',          // HX Command Center
  'system.view',           // integrations / jobs / health (read)
  'integrations.manage',   // enable/disable, change mode
  'integrations.live',     // approve LIVE mode (real customers / real money)
  'secrets.manage',        // write-only secret entry
  'jobs.manage',           // retry / cancel jobs
  'notifications.manage',
  'audit.view',
  'permissions.manage',
  'files.manage',          // upload files, create/revoke download links
  'najm.view', 'najm.manage', 'najm.handoff',            // NAJM AI (phase 3)
  'social.view', 'social.manage', 'social.send',         // Social Automation (phase 4)
  'marketing.view', 'marketing.draft', 'marketing.spend',// Marketing Center (phase 5); spend = owner only
  'reels.view', 'reels.manage',                          // Viral Reels Studio (phase 6)
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const isPermission = (p: string): p is Permission => (PERMISSIONS as readonly string[]).includes(p);

/** Permissions that can never be given by a grant: only the ADMIN role holds them. */
export const ADMIN_ONLY: readonly Permission[] = ['integrations.live', 'secrets.manage', 'permissions.manage', 'marketing.spend'];

const ROLE_DEFAULTS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  STAFF: ['command.view', 'system.view', 'notifications.manage', 'najm.view', 'najm.handoff', 'social.view', 'reels.view'],
  CUSTOMER: [],
};

export function effectivePermissions(user: { role: Role } | null | undefined, grants: readonly string[] = []): Set<Permission> {
  if (!user) return new Set();
  const s = new Set<Permission>(ROLE_DEFAULTS[user.role]);
  if (user.role !== 'CUSTOMER') for (const g of grants) if (isPermission(g) && !ADMIN_ONLY.includes(g)) s.add(g); // customers never get staff permissions
  return s;
}
export const can = (perms: Set<Permission>, p: Permission) => perms.has(p);
/** A grant is allowed only to staff, and never for admin-only permissions. */
export function canGrant(target: { role: Role }, p: string): p is Permission {
  return isPermission(p) && !ADMIN_ONLY.includes(p) && target.role === 'STAFF';
}
