import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { hasRole, type Role } from './rbac';
import { hashPassword, verifyPassword } from './password';
export { hashPassword, verifyPassword };

const COOKIE = 'hx_session';
const TTL_MS = 1000 * 60 * 60 * 24 * 14;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');


export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { tokenHash: sha(token), userId, expiresAt: new Date(Date.now() + TTL_MS) } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000 });
}
export async function destroySession() {
  const c = await cookies(); const t = c.get(COOKIE)?.value;
  if (t) await prisma.session.deleteMany({ where: { tokenHash: sha(t) } });
  c.delete(COOKIE);
}
export async function currentUser() {
  const t = (await cookies()).get(COOKIE)?.value; if (!t) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha(t) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.disabledAt) return null;
  return s.user;
}
export async function requireRole(role: Role) {
  const u = await currentUser();
  if (!u || !hasRole(u.role, role)) throw new Response('Forbidden', { status: 403 });
  return u;
}
