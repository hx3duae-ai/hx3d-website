import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { ACCEPT_FILES } from '@/lib/files/ui';
import LinkForm from './LinkForm';
import { addLinkAction, revokeLinkAction, uploadFileAction } from './actions';

export const dynamic = 'force-dynamic';
const L = {
  ar: { linkKind: 'رابط عام', title: 'الملفات للتسليم', lead: 'ارفع ملفاً وأعطه كلمة مفتاحية. الرابط يُنشأ يدوياً لكل شخص، وله مدة صلاحية وعدد تنزيلات محدود. لا يُرسل أي ملف تلقائياً.',
    upTitle: 'رفع ملف', file: 'الملف (STL، 3MF، OBJ، GLB، PDF، PNG، JPG، WEBP، حتى 50 ميغابايت)', ftitle: 'العنوان', keyword: 'الكلمة المفتاحية (مثل: ملف)', desc: 'وصف (اختياري)', upload: 'رفع',
    addLink: 'إضافة رابط عام (ريل، صفحة متجر)', url: 'الرابط (https فقط)', addLinkBtn: 'إضافة الرابط',
    msgs: { url: 'الرابط غير صالح. يجب أن يبدأ بـ https://', uploaded: 'تم رفع الملف.', invalid: 'أكمل الحقول المطلوبة.', too_large: 'الملف أكبر من 50 ميغابايت.', type: 'نوع الملف غير مدعوم، أو لا يطابق امتداده.', empty: 'الملف فارغ.', keyword: 'الكلمة المفتاحية غير صالحة (حتى 40 حرفاً).', keyword_taken: 'هذه الكلمة المفتاحية مستخدمة لملف آخر.' },
    list: 'الملفات المرفوعة', none: 'لا توجد ملفات بعد.', downloads: 'التنزيلات', links: 'الروابط', create: 'إنشاء رابط', recipient: 'لمن (ملاحظة داخلية)', recipientPh: 'مثال: طلب إنستقرام #12', ttl: 'مدة الصلاحية (ساعة)', max: 'عدد التنزيلات', err: 'تعذّر إنشاء الرابط.', once: 'انسخ الرابط الآن. لن يُعرض مرة ثانية.', copy: 'نسخ', copied: 'تم النسخ', revoke: 'إلغاء', active: 'فعّال', expired: 'منتهٍ', revoked: 'ملغى', used: 'مستنفد',
    keywordHelp: 'الكلمة تُحفظ بدون حساسية لحالة الأحرف، والحروف العربية المتشابهة تُعامل كحرف واحد.' },
  en: { linkKind: 'Public link', title: 'Files for delivery', lead: 'Upload a file and give it a keyword. A link is created by hand for each person, with an expiry and a download limit. No file is sent automatically.',
    upTitle: 'Upload a file', file: 'File (STL, 3MF, OBJ, GLB, PDF, PNG, JPG, WEBP, up to 50 MB)', ftitle: 'Title', keyword: 'Keyword (e.g. ملف)', desc: 'Description (optional)', upload: 'Upload',
    addLink: 'Add a public link (reel, store page)', url: 'URL (https only)', addLinkBtn: 'Add link',
    msgs: { url: 'Invalid URL. It must start with https://', uploaded: 'File uploaded.', invalid: 'Fill in the required fields.', too_large: 'File is larger than 50 MB.', type: 'Unsupported file type, or it does not match its extension.', empty: 'The file is empty.', keyword: 'Invalid keyword (up to 40 characters).', keyword_taken: 'This keyword is already used by another file.' },
    list: 'Uploaded files', none: 'No files yet.', downloads: 'Downloads', links: 'Links', create: 'Create link', recipient: 'For whom (internal note)', recipientPh: 'e.g. Instagram order #12', ttl: 'Valid for (hours)', max: 'Max downloads', err: 'Could not create the link.', once: 'Copy the link now. It will not be shown again.', copy: 'Copy', copied: 'Copied', revoke: 'Revoke', active: 'Active', expired: 'Expired', revoked: 'Revoked', used: 'Used up',
    keywordHelp: 'Keywords are case-insensitive, and similar Arabic letters are treated as one.' },
};
export default async function Files({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const { msg } = await searchParams; const t = L[lang];
  const files = await prisma.deliverableFile.findMany({ orderBy: { createdAt: 'desc' }, include: { links: { orderBy: { createdAt: 'desc' }, take: 10 } }, take: 100 });
  const now = new Date();
  const status = (l: { revokedAt: Date | null; expiresAt: Date; downloads: number; maxDownloads: number }) =>
    l.revokedAt ? t.revoked : l.expiresAt <= now ? t.expired : l.downloads >= l.maxDownloads ? t.used : t.active;
  const linkLabels = { recipient: t.recipient, recipientPh: t.recipientPh, ttl: t.ttl, max: t.max, create: t.create, err: t.err, once: t.once, copy: t.copy, copied: t.copied };
  return (
    <>
      <h1>{t.title}</h1><p className="lead">{t.lead}</p>
      {msg && <p className={msg === 'uploaded' ? 'ok2' : 'er2'} role="status">{(t.msgs as Record<string, string>)[msg] ?? ''}</p>}
      <section className="card">
        <h2>{t.upTitle}</h2>
        <form action={uploadFileAction.bind(null, lang)} className="af" encType="multipart/form-data">
          <label className="fld"><span>{t.file}</span><input name="file" type="file" accept={ACCEPT_FILES} required /></label>
          <label className="fld"><span>{t.ftitle}</span><input name="title" required maxLength={120} /></label>
          <label className="fld"><span>{t.keyword}</span><input name="keyword" required maxLength={40} /></label>
          <p className="lead">{t.keywordHelp}</p>
          <label className="fld"><span>{t.desc}</span><input name="description" maxLength={500} /></label>
          <button className="btn primary" type="submit">{t.upload}</button>
        </form>
      </section>
      <section className="card">
        <h2>{t.addLink}</h2>
        <form action={addLinkAction.bind(null, lang)} className="af">
          <label className="fld"><span>{t.ftitle}</span><input name="title" required maxLength={120} /></label>
          <label className="fld"><span>{t.keyword}</span><input name="keyword" required maxLength={40} /></label>
          <label className="fld"><span>{t.url}</span><input name="url" type="url" required maxLength={500} dir="ltr" /></label>
          <button className="btn primary" type="submit">{t.addLinkBtn}</button>
        </form>
      </section>
      <section className="card">
        <h2>{t.list}</h2>
        {files.length === 0 ? <p className="empty">{t.none}</p> : files.map((f) => (
          <div key={f.id} className="filerow">
            <div><strong>{f.title}</strong> · <code dir="ltr">{f.keyword}</code> · <span dir="ltr">{f.kind === 'link' ? t.linkKind : `${((f.size ?? 0) / 1048576).toFixed(2)} MB · ${f.mime}`}</span></div>
            <div className="lead">{t.downloads}: {f.links.reduce((s, l) => s + l.downloads, 0)} · {t.links}: {f.links.length}</div>
            <LinkForm lang={lang} fileId={f.id} labels={linkLabels} />
            {f.links.length > 0 && (
              <ul className="addr">
                {f.links.map((l) => (
                  <li key={l.id}>
                    <span dir="ltr">{l.recipient ?? '—'} · {l.downloads}/{l.maxDownloads} · {l.expiresAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
                    <span> · {status(l)}</span>
                    {!l.revokedAt && l.expiresAt > now && (
                      <form action={revokeLinkAction.bind(null, lang)}><input type="hidden" name="linkId" value={l.id} /><button className="lang" type="submit">{t.revoke}</button></form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
