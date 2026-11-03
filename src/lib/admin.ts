import type { PrismaClient, Prisma } from '@prisma/client';

type Db = PrismaClient;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Explicit select: password hashes and session data never leave the database layer. */
const customerSelect = {
  id: true, name: true, email: true, phone: true, createdAt: true, disabledAt: true,
  _count: { select: { addresses: true } },
} satisfies Prisma.UserSelect;

export async function listCustomers(db: Db, opts: { q?: string; take?: number } = {}) {
  const q = (opts.q ?? '').trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(q ? { OR: [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ] } : {}),
  };
  return db.user.findMany({ where, select: customerSelect, orderBy: { createdAt: 'desc' }, take: opts.take ?? 50 });
}

export async function customerStats(db: Db, now = new Date()) {
  const [total, recent] = await Promise.all([
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: new Date(now.getTime() - WEEK) } } }),
  ]);
  return { total, recent };
}
