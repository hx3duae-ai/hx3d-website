import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { registerUser, authenticate, addAddress, listAddresses, deleteOwnedAddress } from '@/lib/accounts';
import { addressSchema } from '@/lib/validation';
const db = new PrismaClient();
const run = process.env.DATABASE_URL ? describe : describe.skip;
const addr = addressSchema.parse({ fullName: 'Test Person', phone: '0501234567', emirate: 'Ajman', area: 'Al Rashidiya', street: 'Street 5', building: 'Bldg 3', kind: 'home' });
run('accounts (real database)', () => {
  afterAll(async () => { await db.user.deleteMany({ where: { email: { endsWith: '@acct.test.hx' } } }); await db.$disconnect(); });

  it('registers a CUSTOMER with a hashed password, never the plain text', async () => {
    const r = await registerUser(db, { name: 'Ali', email: 'Ali@Acct.test.hx', password: 'correct-horse-1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user.role).toBe('CUSTOMER');
    expect(r.user.email).toBe('ali@acct.test.hx');
    expect(r.user.passwordHash).not.toContain('correct-horse');
    expect(r.user.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects a duplicate email, case-insensitively', async () => {
    const r = await registerUser(db, { name: 'Ali 2', email: 'ALI@acct.test.hx', password: 'another-pass-22' });
    expect(r).toEqual({ ok: false, reason: 'exists' });
  });

  it('authenticates the right password only', async () => {
    expect(await authenticate(db, 'ali@acct.test.hx', 'correct-horse-1')).not.toBeNull();
    expect(await authenticate(db, 'ali@acct.test.hx', 'wrong-password-x')).toBeNull();
    expect(await authenticate(db, 'nobody@acct.test.hx', 'correct-horse-1')).toBeNull();
  });

  it('a disabled account cannot sign in even with the right password', async () => {
    await db.user.update({ where: { email: 'ali@acct.test.hx' }, data: { disabledAt: new Date() } });
    expect(await authenticate(db, 'ali@acct.test.hx', 'correct-horse-1')).toBeNull();
    await db.user.update({ where: { email: 'ali@acct.test.hx' }, data: { disabledAt: null } });
  });

  it('a customer cannot delete another customer\'s address', async () => {
    const a = await registerUser(db, { name: 'Owner', email: 'owner@acct.test.hx', password: 'owner-password-1' });
    const b = await registerUser(db, { name: 'Intruder', email: 'intruder@acct.test.hx', password: 'intruder-pass-1' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    const created = await addAddress(db, a.user.id, addr);
    expect((await listAddresses(db, a.user.id)).length).toBe(1);
    expect(await listAddresses(db, b.user.id)).toEqual([]);
    expect(await deleteOwnedAddress(db, b.user.id, created.id)).toBe(0); // attack fails
    expect(await db.address.count({ where: { id: created.id } })).toBe(1);
    expect(await deleteOwnedAddress(db, a.user.id, created.id)).toBe(1); // owner succeeds
  });
});
