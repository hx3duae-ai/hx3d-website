import Planned from "@/components/Planned";
export default function Page() {
  return (
    <Planned
      n={6}
      title="Second Brain"
      pitch="اسأل «وش آخر طلبات العملاء؟» ويجاوب من بياناتك فقط — بدون إنترنت."
      plan={[
        "فهرسة data/ (العملاء، الأفكار، سجل النشاط) + ملاحظات واجتماعات تضيفها أنت",
        "Embeddings محلية عبر Transformers.js (multilingual-e5-small) — تشتغل على جهازك بدون API",
        "بحث دلالي + أسئلة منظمة (آخر الطلبات، مبيعات شهر معيّن) تنجاوب مباشرة من الأرقام",
        "كل جواب يعرض مصادره من بياناتك",
      ]}
      links={["CRM", "Content OS", "كل الوحدات عبر سجل النشاط"]}
    />
  );
}
