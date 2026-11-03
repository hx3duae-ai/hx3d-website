import { describe, it, expect } from 'vitest';
import { registerSchema, addressSchema, loginSchema } from '@/lib/validation';
import { createLimiter } from '@/lib/ratelimit';
const good = { fullName: 'Sara Ali', phone: '+971 50 123 4567', emirate: 'Dubai', area: 'Jumeirah', street: 'Al Wasl Road', building: 'Villa 12', kind: 'home' };
describe('registerSchema', () => {
  it('normalises email and accepts a 10+ char password', () => {
    const r = registerSchema.parse({ name: 'Sara', email: '  Sara@Example.COM ', password: '1234567890' });
    expect(r.email).toBe('sara@example.com');
    expect(r.phone).toBe('');
  });
  it('rejects short passwords and bad emails', () => {
    expect(registerSchema.safeParse({ name: 'Sara', email: 'a@b.ae', password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'Sara', email: 'not-an-email', password: '1234567890' }).success).toBe(false);
  });
});
describe('addressSchema', () => {
  it('accepts a complete address and defaults optional fields to empty', () => {
    const r = addressSchema.parse(good);
    expect(r.apartment).toBe(''); expect(r.mapUrl).toBe(''); expect(r.notes).toBe('');
  });
  it('rejects an emirate outside the seven UAE emirates', () => {
    expect(addressSchema.safeParse({ ...good, emirate: 'Riyadh' }).success).toBe(false);
  });
  it('rejects a non-https map link (no javascript: or http: URLs)', () => {
    expect(addressSchema.safeParse({ ...good, mapUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...good, mapUrl: 'http://maps.example' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...good, mapUrl: 'https://maps.app.goo.gl/abc' }).success).toBe(true);
  });
  it('rejects phone numbers with letters', () => {
    expect(addressSchema.safeParse({ ...good, phone: '05x-123' }).success).toBe(false);
  });
});
describe('loginSchema', () => { it('requires a password', () => expect(loginSchema.safeParse({ email: 'a@b.ae', password: '' }).success).toBe(false)); });
describe('login limiter', () => {
  it('blocks after the max failures and resets on success', () => {
    const l = createLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) l.fail('k');
    expect(l.blocked('k')).toBe(true);
    expect(l.blocked('other')).toBe(false);
    l.clear('k'); expect(l.blocked('k')).toBe(false);
  });
});
