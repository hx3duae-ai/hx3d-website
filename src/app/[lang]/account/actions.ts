'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, destroySession, currentUser } from '@/lib/auth';
import { registerUser, authenticate, addAddress, deleteOwnedAddress } from '@/lib/accounts';
import { addressSchema, loginSchema, registerSchema } from '@/lib/validation';
import { loginLimiter } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { isLocale } from '@/lib/i18n';

export type FormState = { error?: string; ok?: boolean };

async function clientIp() {
  return ((await headers()).get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}
const form = (fd: FormData) => Object.fromEntries(fd) as Record<string, unknown>;

export async function registerAction(lang: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isLocale(lang)) return { error: 'invalid' };
  const parsed = registerSchema.safeParse(form(fd));
  if (!parsed.success) return { error: 'invalid' };
  const r = await registerUser(prisma, parsed.data);
  if (!r.ok) return { error: r.reason };
  await createSession(r.user.id);
  await audit('user.register', { actorId: r.user.id, entity: 'User', entityId: r.user.id });
  redirect(`/${lang}/account`);
}

export async function loginAction(lang: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isLocale(lang)) return { error: 'invalid' };
  const parsed = loginSchema.safeParse(form(fd));
  if (!parsed.success) return { error: 'invalid' };
  const key = `${await clientIp()}|${parsed.data.email}`;
  if (loginLimiter.blocked(key)) return { error: 'rate' };
  const user = await authenticate(prisma, parsed.data.email, parsed.data.password);
  if (!user) { loginLimiter.fail(key); return { error: 'wrong' }; }
  loginLimiter.clear(key);
  await createSession(user.id);
  await audit('user.login', { actorId: user.id, entity: 'User', entityId: user.id });
  redirect(`/${lang}/account`);
}

export async function logoutAction(lang: string): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await currentUser();
  await destroySession();
  if (u) await audit('user.logout', { actorId: u.id, entity: 'User', entityId: u.id });
  redirect(`/${lang}`);
}

export async function addAddressAction(lang: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: 'auth' };
  const parsed = addressSchema.safeParse(form(fd));
  if (!parsed.success) return { error: 'invalid' };
  const a = await addAddress(prisma, user.id, parsed.data);
  await audit('address.create', { actorId: user.id, entity: 'Address', entityId: a.id });
  revalidatePath(`/${lang}/account`);
  return { ok: true };
}

export async function deleteAddressAction(lang: string, fd: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect(`/${lang}/login`);
  const id = z.string().min(1).max(64).safeParse(fd.get('id'));
  if (!id.success) return;
  const n = await deleteOwnedAddress(prisma, user.id, id.data);
  if (n > 0) await audit('address.delete', { actorId: user.id, entity: 'Address', entityId: id.data });
  revalidatePath(`/${lang}/account`);
}
