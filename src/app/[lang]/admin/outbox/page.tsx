import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import ApproveForm from './ApproveForm';
import { rejectDraftAction, revokeApprovedAction } from './actions';

export const dynamic = 'force-dynamic';
const L = {
  ar: { title: 'قائمة الردود', lead: 'هذي المسودات جاءت من تعليقات أو رسائل فيها كلمة مفتاحية. ما يُرسل أي شي قبل ما توافق عليه. بعد الموافقة تنسخ الرابط وترسله بنفسك من إنستقرام.',
    pending: 'بانتظار الموافقة', none: 'لا توجد مسودات الآن.', from: 'من', text: 'النص الوارد', keyword: 'الكلمة', draft: 'المسودة', reject: 'رفض', revoke: 'إلغاء الرابط',
    approve: 'موافقة وإنشاء الرابط', err: 'تعذّر، ربما تغيّرت الحالة.', once: 'انسخ الرابط الآن، لن يُعرض مرة ثانية.', copy: 'نسخ', copied: 'تم النسخ', done: 'تمت الموافقة', rejected: 'مرفوض', channelDm: 'رسالة خاصة', channelComment: 'تعليق' },
  en: { title: 'Reply queue', lead: 'These drafts come from comments or messages that contain a keyword. Nothing is sent until you approve. After approval, copy the link and send it yourself from Instagram.',
    pending: 'Awaiting approval', none: 'No drafts right now.', from: 'From', text: 'Incoming text', keyword: 'Keyword', draft: 'Draft', reject: 'Reject', revoke: 'Cancel link',
    approve: 'Approve and create link', err: 'Could not approve; the state may have changed.', once: 'Copy the link now. It will not be shown again.', copy: 'Copy', copied: 'Copied', done: 'Approved', rejected: 'Rejected', channelDm: 'Direct message', channelComment: 'Comment' },
};
export default async function Outbox({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = L[lang];
  const pending = await prisma.replyDraft.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 });
  const recent = await prisma.replyDraft.findMany({ where: { status: 'approved' }, orderBy: { decidedAt: 'desc' }, take: 20, include: { link: true } });
  const labels = { approve: t.approve, err: t.err, once: t.once, copy: t.copy, copied: t.copied };
  return (
    <>
      <h1>{t.title}</h1><p className="lead">{t.lead}</p>
      <section className="card">
        <h2>{t.pending} ({pending.length})</h2>
        {pending.length === 0 ? <p className="empty">{t.none}</p> : pending.map((d) => (
          <div key={d.id} className="filerow">
            <div><b>{d.channel === 'instagram_dm' ? t.channelDm : t.channelComment}</b> · {t.from}: <code dir="ltr">{d.senderRef}</code> · {t.keyword}: <code>{d.keyword}</code></div>
            <div dir="auto">{t.text}: {d.inboundText}</div>
            <div className="lead">{t.draft}: {d.draftText}</div>
            <ApproveForm lang={lang} draftId={d.id} labels={labels} />
            <form action={rejectDraftAction.bind(null, lang)}><input type="hidden" name="draftId" value={d.id} /><button className="lang" type="submit">{t.reject}</button></form>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>{t.done}</h2>
        {recent.map((d) => (
          <div key={d.id} className="filerow">
            <span dir="ltr">{d.senderRef} · {d.keyword} · {d.link ? `${d.link.downloads}/${d.link.maxDownloads}` : ''}</span>
            {d.link && !d.link.revokedAt && (<form action={revokeApprovedAction.bind(null, lang)}><input type="hidden" name="linkId" value={d.link.id} /><button className="lang" type="submit">{t.revoke}</button></form>)}
          </div>
        ))}
      </section>
    </>
  );
}
