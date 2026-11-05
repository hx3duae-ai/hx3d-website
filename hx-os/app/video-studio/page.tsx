import Planned from "@/components/Planned";
export default function Page() {
  return (
    <Planned
      n={4}
      title="Google Flow Video Studio"
      pitch="اكتب برومبت مثل «3D printed product on pedestal, cinematic» وتطلع 3 فيديوهات."
      plan={[
        "محسّن برومبت: يضيف إضاءة، حركة كاميرا، وعدسة مناسبة لمنتجات الطباعة 3D",
        "3 نسخ بنفس الطلب عبر Google Veo (Gemini API) — Flow نفسه ما له API عام، فنستخدم نفس النموذج",
        "FFmpeg: قص 9:16، إضافة شعار HX3D وموسيقى، وتصدير جاهز للريلز",
        "زر «أرسل للـ Content OS» يربط الفيديو بفكرة اليوم",
      ]}
      links={["Content OS"]}
    />
  );
}
