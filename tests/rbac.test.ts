import { describe, it, expect } from 'vitest';
import { hasRole, canAccessOwned } from '@/lib/rbac';
import { dirOf, dict } from '@/lib/i18n';
describe('rbac', () => {
  it('orders roles', () => {
    expect(hasRole('ADMIN', 'STAFF')).toBe(true);
    expect(hasRole('CUSTOMER', 'STAFF')).toBe(false);
    expect(hasRole(null, 'CUSTOMER')).toBe(false);
  });
  it('customers cannot read other customers records', () => {
    expect(canAccessOwned({ id: 'a', role: 'CUSTOMER' }, 'b')).toBe(false);
    expect(canAccessOwned({ id: 'a', role: 'CUSTOMER' }, 'a')).toBe(true);
    expect(canAccessOwned({ id: 's', role: 'STAFF' }, 'b')).toBe(true);
    expect(canAccessOwned(null, 'b')).toBe(false);
  });
});
describe('i18n', () => {
  it('rtl for arabic only', () => { expect(dirOf('ar')).toBe('rtl'); expect(dirOf('en')).toBe('ltr'); });
  it('same category count in both languages', () => expect(dict.ar.cats.length).toBe(dict.en.cats.length));
});
