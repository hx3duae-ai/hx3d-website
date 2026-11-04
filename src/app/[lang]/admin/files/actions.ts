'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { saveDeliverable, saveLink } from '@/lib/files/storage';
import { createLink, revokeLink } from '@/lib/files/links';
import { isLocale } from '@/lib/i18n';

export type LinkState = { url?: string; expiresAt?: string; error?: string };
const staff = async () => { const u = await currentUser(); return u && hasRole(u.role, 'STAFF') ? u : null; };

export async function uploadFileAction(lang: string, fd: FormData): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await staff(); if (!u) redirect(`/${lang}/login`);
  const file = fd.get('file');
  const title = String(fd.get('title') ?? ''), keyword = String(fd.get('keyword') ?? ''), description = String(fd.get('description') ?? '');
  if (!(file instanceof File) || !title.trim() || !keyword.trim()) redirect(`/${lang}/admin/files?msg=invalid`);
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const r = await saveDeliverable(prisma, buf, { originalName: (file as File).name, title, keyword, description });
  if (!r.ok) redirect(`/${lang}/admin/files?msg=${r.reason}`);
  await audit('file.upload', { actorId: u.id, entity: 'DeliverableFile', entityId: r.id });
  revalidatePath(`/${lang}/admin/files`);
  redirect(`/${lang}/admin/files?msg=uploaded`);
}

export async function createLinkAction(lang: string, _prev: LinkState, fd: FormData): Promise<LinkState> {
  if (!isLocale(lang)) return { error: 'invalid' };
  const u = await staff(); if (!u) return { error: 'auth' };
  const fileId = String(fd.get('fileId') ?? '');
  const f = await prisma.deliverableFile.findUnique({ where: { id: fileId } });
  if (!f || !f.active) return { error: 'notfound' };
  const ttlHours = Number(fd.get('ttlHours') ?? 48), maxDownloads = Number(fd.get('maxDownloads') ?? 1);
  const recipient = String(fd.get('recipient') ?? '');
  const link = await createLink(prisma, f.id, { ttlHours, maxDownloads, recipient });
  await audit('file.link.create', { actorId: u.id, entity: 'DeliverableFile', entityId: f.id, meta: { maxDownloads: link.maxDownloads, ttlHours } });
  const base = process.env.SITE_URL || 'http://localhost:3000';
  return { url: `${base}/api/files/${link.token}`, expiresAt: link.expiresAt.toISOString() };
}

export async function revokeLinkAction(lang: string, fd: FormData): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await staff(); if (!u) redirect(`/${lang}/login`);
  const id = String(fd.get('linkId') ?? '');
  await revokeLink(prisma, id);
  await audit('file.link.revoke', { actorId: u.id, entity: 'DownloadLink', entityId: id });
  revalidatePath(`/${lang}/admin/files`);
}

export async function addLinkAction(lang: string, fd: FormData): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await staff(); if (!u) redirect(`/${lang}/login`);
  const r = await saveLink(prisma, { title: String(fd.get('title') ?? ''), keyword: String(fd.get('keyword') ?? ''), url: String(fd.get('url') ?? '') });
  if (!r.ok) redirect(`/${lang}/admin/files?msg=${r.reason}`);
  await audit('file.link.add', { actorId: u.id, entity: 'DeliverableFile', entityId: r.id });
  revalidatePath(`/${lang}/admin/files`);
  redirect(`/${lang}/admin/files?msg=uploaded`);
}
