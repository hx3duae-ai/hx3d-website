import type { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './password';
import type { AddressInput } from './validation';

type Db = PrismaClient;

export async function registerUser(db: Db, i: { name: string; email: string; password: string; phone?: string }) {
  const email = i.email.trim().toLowerCase();
  try {
    const user = await db.user.create({
      data: { email, name: i.name.trim(), phone: i.phone?.trim() || null, passwordHash: await hashPassword(i.password), role: 'CUSTOMER' },
    });
    return { ok: true as const, user };
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return { ok: false as const, reason: 'exists' as const };
    throw e;
  }
}

let dummyHash: Promise<string> | null = null;
/** Returns the user on success, or null. Runs a hash check even for unknown emails to avoid timing hints. */
export async function authenticate(db: Db, email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    dummyHash ??= hashPassword('placeholder-password-never-used');
    await verifyPassword(await dummyHash, password);
    return null;
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || user.disabledAt) return null;
  return user;
}

export const listAddresses = (db: Db, userId: string) => db.address.findMany({ where: { userId }, orderBy: { id: 'desc' } });
export const addAddress = (db: Db, userId: string, d: AddressInput) =>
  db.address.create({ data: { userId, ...d, apartment: d.apartment || null, mapUrl: d.mapUrl || null, notes: d.notes || null } });
/** Ownership is enforced in the query itself: another customer's id matches nothing. */
export const deleteOwnedAddress = async (db: Db, userId: string, id: string) =>
  (await db.address.deleteMany({ where: { id, userId } })).count;
