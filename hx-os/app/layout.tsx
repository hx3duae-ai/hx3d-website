import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "HX OS",
  description: "نظام إدارة HX 3D UAE — محتوى، عملاء، وأتمتة بدون موظفين",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <b>HX</b> OS
              <small>HX 3D UAE · دبي</small>
            </div>
            <Nav />
            <div className="foot">يعمل محلياً · بياناتك في مجلد data/</div>
          </aside>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
