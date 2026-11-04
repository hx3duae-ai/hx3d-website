'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { createLink, revokeLink, hashToken } from '@/lib/files/links';
import { isLocale } from '@/lib/i18n';

export type ApproveState = { url?: string; error?: string };
const staff = async () => { const u = await currentUser(); return u && hasRole(u.role, 'STAFF') ? u : null; };

/** Approving creates the one-time link and fills the draft. It does NOT send anything to Instagram. */
export async function approveDraftAction(lang: string, _prev: ApproveState, fd: FormData): Promise<ApproveState> {
  if (!isLocale(lang)) return { error: 'invalid' };
  const u = await staff(); if (!u) return { error: 'auth' };
  const id = String(fd.get('draftId') ?? '');
  const d = await prisma.replyDraft.findUnique({ where: { id } });
  if (!d || d.status !== 'pending' || !d.fileId) return { error: 'notpending' };
  const f = await prisma.deliverableFile.findUnique({ where: { id: d.fileId } });
  if (!f) return { error: 'notpending' };
  if (f.kind === 'link') {
    // Public link: nothing to create. The text was already complete when the draft was made.
    await prisma.replyDraft.update({ where: { id }, data: { status: 'approved', decidedAt: new Date(), decidedBy: u.id } });
    await audit('outbox.approve', { actorId: u.id, entity: 'ReplyDraft', entityId: id });
    return { url: f.url ?? '' };
  }
  const link = await createLink(prisma, d.fileId, { maxDownloads: 1, ttlHours: 48, recipient: `${d.channel} ${d.senderRef}` });
  const base = process.env.SITE_URL || 'http://localhost:3000';
  const url = `${base}/api/files/${link.token}`;
  const linkRow = await prisma.downloadLink.findUniqueOrThrow({ where: { tokenHash: hashToken(link.token) } });
  // The raw URL (with the token) is shown once and never stored. The draft keeps its {LINK} placeholder.
  await prisma.replyDraft.update({ where: { id }, data: { status: 'approved', linkId: linkRow.id, decidedAt: new Date(), decidedBy: u.id } });
  await audit('outbox.approve', { actorId: u.id, entity: 'ReplyDraft', entityId: id });
  // No revalidatePath here: it would unmount the row and hide the link before the admin can copy it.
  return { url };
}

export async function rejectDraftAction(lang: string, fd: FormData): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await staff(); if (!u) redirect(`/${lang}/login`);
  const id = String(fd.get('draftId') ?? '');
  await prisma.replyDraft.updateMany({ where: { id, status: 'pending' }, data: { status: 'rejected', decidedAt: new Date(), decidedBy: u.id } });
  await audit('outbox.reject', { actorId: u.id, entity: 'ReplyDraft', entityId: id });
  revalidatePath(`/${lang}/admin/outbox`);
}

export async function revokeApprovedAction(lang: string, fd: FormData): Promise<void> {
  if (!isLocale(lang)) return;
  const u = await staff(); if (!u) redirect(`/${lang}/login`);
  const linkId = String(fd.get('linkId') ?? '');
  await revokeLink(prisma, linkId);
  await audit('outbox.link.revoke', { actorId: u.id, entity: 'DownloadLink', entityId: linkId });
  revalidatePath(`/${lang}/admin/outbox`);
}
