'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { isLocale } from '@/lib/i18n';
import { requirePermission } from '@/lib/core/guard';
import { INTEGRATIONS, isIntegrationKey, setEnabled, setKillSwitch, setMode, integrationKeys } from '@/lib/core/integrations';
import { putSecret, deleteSecret } from '@/lib/core/secrets';
import { runHealthChecks } from '@/lib/core/health';
import { retryDead, cancel } from '@/lib/core/jobs';
import { resolve } from '@/lib/core/notifications';
import { canGrant } from '@/lib/core/permissions';

const done = (lang: string, sub = 'system') => { if (isLocale(lang)) { revalidatePath(`/${lang}/admin/${sub}`); revalidatePath(`/${lang}/admin/command`); } };
const knownSecret = (n: string) => integrationKeys.some((k) => INTEGRATIONS[k].secrets.some((s) => s.name === n && !s.envOnly));

export async function setModeAction(lang: string, fd: FormData) {
  const p = z.object({ key: z.string(), mode: z.enum(['disabled', 'dry_run', 'test', 'live']) }).safeParse(Object.fromEntries(fd));
  if (!p.success || !isIntegrationKey(p.data.key)) return;
  const { user } = await requirePermission(p.data.mode === 'live' ? 'integrations.live' : 'integrations.manage');
  await setMode(prisma, p.data.key, p.data.mode, user.id);
  await audit(p.data.mode === 'live' ? 'integration.live_approved' : 'integration.mode', { actorId: user.id, entity: 'Integration', entityId: p.data.key, meta: { mode: p.data.mode } });
  done(lang);
}
export async function setEnabledAction(lang: string, fd: FormData) {
  const key = String(fd.get('key')); const on = fd.get('enabled') === '1'; if (!isIntegrationKey(key)) return;
  const { user } = await requirePermission('integrations.manage');
  await setEnabled(prisma, key, on);
  await audit(on ? 'integration.enable' : 'integration.disable', { actorId: user.id, entity: 'Integration', entityId: key });
  done(lang);
}
export async function killSwitchAction(lang: string, fd: FormData) {
  const on = fd.get('on') === '1';
  const { user } = await requirePermission('integrations.manage');
  await setKillSwitch(prisma, on);
  await audit(on ? 'core.kill_switch.engage' : 'core.kill_switch.release', { actorId: user.id, entity: 'Integration', entityId: 'core.kill_switch' });
  done(lang);
}
export async function putSecretAction(lang: string, fd: FormData) {
  const name = String(fd.get('name') ?? ''); const value = String(fd.get('value') ?? '');
  if (!knownSecret(name) || !value.trim()) return;
  const { user } = await requirePermission('secrets.manage');
  const r = await putSecret(prisma, name, value.trim(), user.id);
  await audit('secret.set', { actorId: user.id, entity: 'Secret', entityId: name, meta: { fingerprint: r.fingerprint } }); // never the value
  done(lang);
}
export async function deleteSecretAction(lang: string, fd: FormData) {
  const name = String(fd.get('name') ?? ''); if (!knownSecret(name)) return;
  const { user } = await requirePermission('secrets.manage');
  await deleteSecret(prisma, name);
  await audit('secret.delete', { actorId: user.id, entity: 'Secret', entityId: name });
  done(lang);
}
export async function healthCheckAction(lang: string) {
  const { user } = await requirePermission('system.view');
  await runHealthChecks(prisma, integrationKeys);
  await audit('integration.health_check', { actorId: user.id, entity: 'Integration' });
  done(lang);
}
export async function retryJobAction(lang: string, fd: FormData) {
  const id = String(fd.get('id') ?? ''); const { user } = await requirePermission('jobs.manage');
  await retryDead(prisma, id); await audit('job.retry', { actorId: user.id, entity: 'Job', entityId: id }); done(lang, 'system/jobs');
}
export async function cancelJobAction(lang: string, fd: FormData) {
  const id = String(fd.get('id') ?? ''); const { user } = await requirePermission('jobs.manage');
  await cancel(prisma, id); await audit('job.cancel', { actorId: user.id, entity: 'Job', entityId: id }); done(lang, 'system/jobs');
}
export async function resolveNotificationAction(lang: string, fd: FormData) {
  const id = String(fd.get('id') ?? ''); const { user } = await requirePermission('notifications.manage');
  await resolve(prisma, id, user.id); await audit('notification.resolve', { actorId: user.id, entity: 'Notification', entityId: id }); done(lang, 'system/notifications');
}
export async function permissionAction(lang: string, fd: FormData) {
  const userId = String(fd.get('userId') ?? ''); const perm = String(fd.get('permission') ?? ''); const grant = fd.get('op') === 'grant';
  const { user } = await requirePermission('permissions.manage');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target || !canGrant(target, perm)) return;
  if (grant) await prisma.userPermission.upsert({ where: { userId_permission: { userId, permission: perm } }, create: { userId, permission: perm, grantedBy: user.id }, update: {} });
  else await prisma.userPermission.deleteMany({ where: { userId, permission: perm } });
  await audit(grant ? 'permission.grant' : 'permission.revoke', { actorId: user.id, entity: 'User', entityId: userId, meta: { permission: perm } });
  done(lang, 'system/permissions');
}
