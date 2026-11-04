import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from '../db';
import { currentUser } from '../auth';
import { effectivePermissions, type Permission } from './permissions';

export async function permissionsOf(user: { id: string; role: 'ADMIN' | 'STAFF' | 'CUSTOMER' } | null) {
  if (!user) return new Set<Permission>();
  const grants = await prisma.userPermission.findMany({ where: { userId: user.id }, select: { permission: true } });
  return effectivePermissions(user, grants.map((g) => g.permission));
}
/** For pages: redirects to login, or returns null when the user lacks the permission (page shows "forbidden"). */
export async function pageGuard(lang: string, p: Permission) {
  const user = await currentUser(); if (!user) redirect(`/${lang}/login`);
  const perms = await permissionsOf(user);
  return perms.has(p) ? { user, perms } : null;
}
/** For server actions and route handlers: throws, never redirects. */
export async function requirePermission(p: Permission) {
  const user = await currentUser(); const perms = await permissionsOf(user);
  if (!user || !perms.has(p)) throw new Error('forbidden');
  return { user, perms };
}
