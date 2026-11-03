import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
const db = new PrismaClient();
const run = process.env.DATABASE_URL ? describe : describe.skip;
run('database (needs DATABASE_URL)', () => {
  afterAll(async () => { await db.user.deleteMany({ where: { email: { endsWith: '@test.hx' } } }); await db.$disconnect(); });
  it('stores only the hash of a session token and cascades on user delete', async () => {
    const u = await db.user.create({ data: { email: 'a@test.hx', passwordHash: 'x' } });
    const hash = createHash('sha256').update('raw-token').digest('hex');
    await db.session.create({ data: { tokenHash: hash, userId: u.id, expiresAt: new Date(Date.now() + 1e6) } });
    expect(await db.session.findFirst({ where: { tokenHash: 'raw-token' } })).toBeNull();
    await db.user.delete({ where: { id: u.id } });
    expect(await db.session.count({ where: { tokenHash: hash } })).toBe(0);
  });
  it('rejects duplicate emails and defaults to CUSTOMER', async () => {
    const u = await db.user.create({ data: { email: 'b@test.hx', passwordHash: 'x' } });
    expect(u.role).toBe('CUSTOMER');
    await expect(db.user.create({ data: { email: 'b@test.hx', passwordHash: 'x' } })).rejects.toThrow();
  });
  it('webhook event id is unique (idempotency)', async () => {
    await db.webhookEvent.deleteMany({ where: { id: 'test-evt' } });
    await db.webhookEvent.create({ data: { id: 'test-evt', topic: 'orders/create' } });
    await expect(db.webhookEvent.create({ data: { id: 'test-evt', topic: 'orders/create' } })).rejects.toThrow();
    await db.webhookEvent.delete({ where: { id: 'test-evt' } });
  });
});
