import type { StudioStrings } from '@/components/studio/StudioPanel';
export const ST: Record<'ar' | 'en', StudioStrings> = {
  ar: {
    title: 'أدوات التعديل والتصدير', note: 'تعديلات على الجسم كوحدة واحدة. بعد كل تعديل أعد الفحص للتأكد من أن الملف ما زال سليماً. النصوص غير متوفرة بعد لأن الكتابة بالعربي تحتاج خطاً مخصصاً.',
    cut: 'تقطيع', axis: 'المحور', at: 'موضع القطع (مم)', keepLower: 'إبقاء الجزء السفلي', keepUpper: 'إبقاء الجزء العلوي', splitBoth: 'فصل إلى جزأين',
    shape: 'إضافة شكل', kind: { box: 'مكعب', sphere: 'كرة', cylinder: 'أسطوانة' }, size: 'الحجم (مم)', mode: 'الطريقة', union: 'دمج', subtract: 'طرح من المجسم', addShape: 'تطبيق الشكل',
    undo: 'تراجع', exportT: 'تصدير الملف', exportBtn: 'تنزيل', photosT: 'صور استوديو', photosBtn: 'تنزيل 4 صور (أمامي، يمين، أعلى، زاوية)',
    noModel: 'ارفع مجسماً أولاً لتفعيل الأدوات.', failed: 'تعذّر تنفيذ العملية على هذا المجسم. جرّب مجسماً مغلقاً أو أعد الرفع.',
  },
  en: {
    title: 'Edit & export tools', note: 'Edits apply to the model as one body. Re-run the checker after each edit to confirm the file is still valid. Text is not available yet: Arabic text needs a dedicated font.',
    cut: 'Cut', axis: 'Axis', at: 'Cut position (mm)', keepLower: 'Keep lower part', keepUpper: 'Keep upper part', splitBoth: 'Split into two',
    shape: 'Add shape', kind: { box: 'Box', sphere: 'Sphere', cylinder: 'Cylinder' }, size: 'Size (mm)', mode: 'Mode', union: 'Union', subtract: 'Subtract from model', addShape: 'Apply shape',
    undo: 'Undo', exportT: 'Export file', exportBtn: 'Download', photosT: 'Studio photos', photosBtn: 'Download 4 images (front, right, top, angle)',
    noModel: 'Upload a model first to enable these tools.', failed: 'This operation failed on this model. Try a closed model or upload it again.',
  },
};
