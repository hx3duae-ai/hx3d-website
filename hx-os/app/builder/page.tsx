import Planned from "@/components/Planned";
export default function Page() {
  return (
    <Planned
      n={3}
      title="App Builder"
      pitch="اكتب أي فكرة — Claude يبنيها كصفحة جديدة داخل HX OS."
      plan={[
        "مربع وصف للفكرة + أمثلة جاهزة (تتبع طلبات، نموذج طلب عرض سعر — بدون أي حاسبة أسعار: التسعير للمالك فقط)",
        "Claude API يولّد صفحة Next.js مستقلة داخل app/apps/<اسم>/ مع معاينة فورية",
        "كل تطبيق يقرأ/يكتب نفس مخزن البيانات المحلي (العملاء، الأفكار)",
        "سجل نسخ: تقدر ترجع لأي نسخة قبل التعديل",
      ]}
      links={["CRM", "Content OS", "Second Brain"]}
    />
  );
}
