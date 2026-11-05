"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const MODULES = [
  { href: "/instagram", n: "IG", label: "Instagram · OOTTO", ready: true },
  { href: "/content", n: 1, label: "Content OS", ready: true },
  { href: "/crm", n: 2, label: "CRM العملاء", ready: true },
  { href: "/quotes", n: "Q", label: "عروض الأسعار 🔒", ready: true },
  { href: "/builder", n: 3, label: "App Builder", ready: false },
  { href: "/video-studio", n: 4, label: "Video Studio", ready: false },
  { href: "/client-hunter", n: 5, label: "Client Hunter", ready: false },
  { href: "/brain", n: 6, label: "Second Brain", ready: false },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className={path === "/" ? "active" : ""}>
        <span className="num">⌂</span> الرئيسية
      </Link>
      {MODULES.map((m) => (
        <Link key={m.href} href={m.href} className={path.startsWith(m.href) ? "active" : ""}>
          <span className="num">{m.n}</span> {m.label}
          {!m.ready && <span className="soon">قريباً</span>}
        </Link>
      ))}
      <Link href="/login" className={path === "/login" ? "active" : ""}>
        <span className="num">🔑</span> الدخول والصلاحيات
      </Link>
    </nav>
  );
}
