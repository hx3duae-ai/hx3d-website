'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { createLink, revokeLink, hashToken } from '@/lib/files/links';
import { isLocale } from '@/lib/i18n';
import { normalizeKeyword } from '@/lib/files/validate';

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

/**
 * Resolves a draft that the router could not decide:
 * - needs_choice: the admin picks one of the candidate files.
 * - needs_mapping: the admin attaches a general file to this reel (the reel's media id is stored on the file).
 * Either way the draft becomes pending, and still needs the normal approval before anything is sent.
 */
export async function resolveDraftAction(lang: string, _prev: { error?: string; ok?: boolean }, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  if (!isLocale(lang)) return { error: 'invalid' };
  const u = await staff(); if (!u) return { error: 'auth' };
  const draftId = String(fd.get('draftId') ?? ''), fileId = String(fd.get('fileId') ?? '');
  const d = await prisma.replyDraft.findUnique({ where: { id: draftId } });
  if (!d || (d.status !== 'needs_choice' && d.status !== 'needs_mapping')) return { error: 'notpending' };
  const f = await prisma.deliverableFile.findUnique({ where: { id: fileId } });
  if (!f || !f.active) return { error: 'notfound' };
  if (normalizeKeyword(f.keyword) !== normalizeKeyword(d.keyword)) return { error: 'keyword' };
  if (d.status === 'needs_choice') {
    const ids: string[] = d.candidateIds ? JSON.parse(d.candidateIds) : [];
    if (!ids.includes(f.id)) return { error: 'notcandidate' };
  } else {
    if (f.mediaId !== null) return { error: 'alreadymapped' };
    if (!d.mediaId) return { error: 'nomedia' };
    try { await prisma.deliverableFile.update({ where: { id: f.id }, data: { mediaId: d.mediaId } }); }
    catch (e) { if ((e as { code?: string }).code === 'P2002') return { error: 'conflict' }; throw e; }
    await audit('outbox.map_reel', { actorId: u.id, entity: 'DeliverableFile', entityId: f.id, meta: { mediaId: d.mediaId } });
  }
  const text = f.kind === 'link' ? `أهلاً، تفضّل (${f.title}): ${f.url}` : `أهلاً، تفضّل الملف (${f.title}): {LINK}`;
  await prisma.replyDraft.update({ where: { id: d.id }, data: { status: 'pending', fileId: f.id, draftText: text, candidateIds: null } });
  revalidatePath(`/${lang}/admin/outbox`);
  return { ok: true };
}
