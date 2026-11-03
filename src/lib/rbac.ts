export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';
const rank: Record<Role, number> = { CUSTOMER: 1, STAFF: 2, ADMIN: 3 };
export const hasRole = (actual: Role | undefined | null, required: Role) =>
  !!actual && rank[actual] >= rank[required];
/** A customer may only touch records they own; staff/admin may touch any. */
export const canAccessOwned = (user: { id: string; role: Role } | null, ownerId: string) =>
  !!user && (user.id === ownerId || hasRole(user.role, 'STAFF'));
