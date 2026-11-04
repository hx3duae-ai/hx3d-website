import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { listCustomers, customerStats } from '@/lib/admin';
import { registerUser } from '@/lib/accounts';
const db = new PrismaClient();
const run = process.env.DATABASE_URL ? describe : describe.skip;
run('admin data (real database)', () => {
  afterAll(async () => { await db.user.deleteMany({ where: { email: { endsWith: '@admin.test.hx' } } }); await db.$disconnect(); });

  it('lists only customers, never staff or admins', async () => {
    await registerUser(db, { name: 'Nour Buyer', email: 'nour@admin.test.hx', password: 'nour-password-1' });
    await db.user.create({ data: { email: 'staff@admin.test.hx', name: 'Staff', passwordHash: 'x', role: 'STAFF' } });
    const rows = await listCustomers(db, { q: 'admin.test.hx' });
    expect(rows.map((r) => r.email)).toContain('nour@admin.test.hx');
    expect(rows.map((r) => r.email)).not.toContain('staff@admin.test.hx');
  });

  it('never returns password hashes or other secret fields', async () => {
    const rows = await listCustomers(db, { q: 'nour@admin' });
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0])).not.toContain('passwordHash');
    expect(Object.keys(rows[0])).not.toContain('role');
  });

  it('searches case-insensitively by name and by phone', async () => {
    await db.user.update({ where: { email: 'nour@admin.test.hx' }, data: { phone: '+971501234999' } });
    expect((await listCustomers(db, { q: 'nour buyer' })).length).toBe(1);
    expect((await listCustomers(db, { q: '501234999' })).length).toBe(1);
    expect((await listCustomers(db, { q: 'no-such-person-xyz' })).length).toBe(0);
  });

  it('counts customers and recent sign-ups honestly', async () => {
    const s = await customerStats(db);
    expect(s.total).toBeGreaterThanOrEqual(1);
    const future = await customerStats(db, new Date(Date.now() + 30 * 24 * 3600 * 1000));
    expect(future.recent).toBe(0); // a month later, nothing is within the last 7 days
  });
});
