// Builds the three HX 3D lead-magnet PDFs (A4, house style) with Playwright's Chromium.
// Usage:  node video-design/pdfs/source/build.cjs        → video-design/pdfs/*.pdf
// Fonts are local (hx-os/public/fonts), so it works offline. Style: .claude/skills/hx3d-brand-style.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const docs = require("./content.cjs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const FONTS = path.join(ROOT, "hx-os", "public", "fonts");
const OUT = path.resolve(__dirname, "..");
const font = (f) => `url("data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, f)).toString("base64")}")`;
// escape, then isolate number runs (ranges, %, °) left-to-right so "190–220" never flips inside Arabic text
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\d[\d.,]*(?:\s?[–-]\s?\d[\d.,]*)?/g, (m) => `<bdi dir="ltr">${m}</bdi>`);

const CSS = `
@font-face { font-family: Cairo; src: ${font("Cairo.ttf")}; font-weight: 200 1000; }
@font-face { font-family: Aref; src: ${font("ArefRuqaa-Bold.ttf")}; font-weight: 700; }
@page { size: A4; margin: 0; }
:root { --pink:#FF66B2; --ink:#111; --ink2:#4a4a4a; --paper:#fff; --grid:#f4f4f4; --line:#e2e2e2; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Cairo, sans-serif; color: var(--ink); direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; padding: 22mm 16mm 26mm;
  background-color: var(--grid); background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 9mm 9mm; }
.page::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 30mm rgba(0,0,0,.06); pointer-events: none; }
.bar { position: absolute; top: 0; right: 0; height: 2.6mm; background: var(--pink); }
.logo { position: absolute; top: 9mm; left: 16mm; font-weight: 900; font-size: 15pt; direction: ltr; }
.logo b { color: var(--pink); }
.pno { position: absolute; top: 9.5mm; right: 16mm; font-weight: 700; font-size: 10pt; color: var(--ink2); direction: ltr; }
.scrap { background: var(--paper); border-radius: 2mm; position: relative; box-shadow: 0 1mm 1mm rgba(0,0,0,.04), 0 4mm 9mm rgba(0,0,0,.08); }
.tape { position: absolute; top: -4mm; right: 14mm; width: 30mm; height: 8mm; background: rgba(255,102,178,.35); transform: rotate(-3deg); border-radius: .6mm; }
.hl { background: linear-gradient(transparent 14%, var(--pink) 14%, var(--pink) 90%, transparent 90%); padding: 0 .15em; border-radius: 1.2mm; }
.wavy { display: block; margin: 5mm 0 4mm; }
.cover .scrap { margin-top: 38mm; padding: 16mm 13mm 14mm; transform: rotate(-.6deg); }
.cover h1 { font-weight: 900; font-size: 44pt; line-height: 1.3; margin: 0; }
.cover .sub { font-weight: 700; font-size: 15pt; line-height: 1.6; color: var(--ink2); margin: 0; max-width: 140mm; }
.kw { display: inline-flex; gap: 3mm; align-items: center; margin-top: 9mm; font-weight: 700; font-size: 12pt; }
.kw span { background: var(--ink); color: var(--paper); border-radius: 1.5mm; padding: .5mm 3.5mm; font-weight: 900; }
.note { font-family: Aref, serif; font-size: 17pt; }
.chain { position: absolute; bottom: 14mm; right: 16mm; left: 16mm; display: flex; gap: 2.5mm; align-items: center; font-weight: 700; font-size: 11pt; flex-wrap: wrap; }
.chain span { background: var(--paper); border: .6mm solid var(--ink); border-radius: 99mm; padding: .6mm 4.5mm; }
.chain span.end { background: var(--pink); border-color: var(--pink); }
.chain i { font-style: normal; color: var(--pink); font-weight: 900; }
.doc { position: absolute; left: 22mm; bottom: 40mm; }
h2 { font-weight: 900; font-size: 22pt; margin: 6mm 0 6mm; }
.cards { display: grid; gap: 6mm; }
.card { padding: 6mm 7mm 6mm; break-inside: avoid; }
.chip { display: inline-flex; align-items: center; gap: 2.5mm; font-weight: 900; font-size: 10.5pt; }
.chip span { background: var(--ink); color: var(--paper); border-radius: 1.2mm; padding: 0 2.5mm; direction: ltr; }
.card h3 { font-weight: 900; font-size: 14.5pt; margin: 2.5mm 0 1.5mm; line-height: 1.45; }
.card .why { font-size: 10.5pt; color: var(--ink2); margin: 0 0 2.5mm; line-height: 1.6; }
.card ul { margin: 0; padding-right: 5mm; display: grid; gap: 1.2mm; font-size: 10.8pt; line-height: 1.6; }
.card li::marker { color: var(--pink); }
table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
th, td { padding: 2.6mm 3mm; border-bottom: .3mm solid var(--line); text-align: right; vertical-align: top; }
th { font-weight: 900; font-size: 12pt; }
th:nth-child(3) { background: #FFE0EF; }
td:first-child { font-weight: 700; color: var(--ink2); width: 34%; }
.tablecard { padding: 5mm 6mm; }
.checks { padding: 9mm 9mm; display: grid; gap: 4.5mm; }
.check { display: flex; gap: 4mm; align-items: center; font-weight: 700; font-size: 13pt; }
.box { flex: 0 0 auto; width: 8mm; height: 8mm; border: .7mm solid var(--ink); border-radius: 1.2mm; background: var(--paper); }
.check:nth-child(odd) .box { box-shadow: 1mm 1mm 0 var(--pink); }
.disclaimer { margin-top: 8mm; font-size: 9.5pt; color: var(--ink2); line-height: 1.6; }
.cta { margin-top: 8mm; padding: 6mm 7mm; display: flex; justify-content: space-between; align-items: center; gap: 4mm; }
.cta b { font-weight: 900; font-size: 14pt; }
.cta .h { direction: ltr; font-weight: 900; font-size: 13pt; }
`;

const wavy = `<svg class="wavy" width="190" height="20" viewBox="0 0 190 20"><path d="M4 10 Q 19 0 34 10 T 64 10 T 94 10 T 124 10 T 154 10 T 186 10" fill="none" stroke="#FF66B2" stroke-width="5" stroke-linecap="round"/></svg>`;
const docIcon = `<svg width="120" height="146" viewBox="0 0 150 180"><path d="M10 8 H100 L140 48 V172 H10 Z" fill="#fff" stroke="#111" stroke-width="7" stroke-linejoin="round"/><path d="M100 8 V48 H140" fill="#FF66B2" stroke="#111" stroke-width="7" stroke-linejoin="round"/><rect x="34" y="78" width="82" height="10" rx="5" fill="#111"/><rect x="34" y="102" width="82" height="10" rx="5" fill="#e2e2e2"/><rect x="34" y="126" width="56" height="10" rx="5" fill="#e2e2e2"/><text x="75" y="160" text-anchor="middle" font-family="Cairo" font-weight="900" font-size="26" fill="#FF66B2">PDF</text></svg>`;
const chrome = (n, total) => `<div class="bar" style="width:${(n / total) * 100}%"></div><div class="logo"><b>HX</b> 3D</div><div class="pno">${n} / ${total}</div>`;
const chain = `<div class="chain"><span>تقرأ</span><i>←</i><span>تطبّق</span><i>←</i><span class="end">طباعة ناجحة</span></div>`;

function card(s) {
  const [num, ...label] = s.chip.split(" ");
  return `<div class="scrap card"><div class="chip"><span>${esc(num)}</span>${esc(label.join(" "))}</div><h3>${esc(s.title)}</h3><p class="why">${esc(s.why)}</p><ul>${s.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`;
}

function html(d) {
  // page plan: cover · cards (2–3 per page, table first if any) · checklist
  const pages = [];
  const groups = [];
  if (d.table) groups.push({ table: d.table, cards: [] }); // the comparison table gets its own page
  for (let i = 0; i < d.sections.length; i += 3) groups.push(d.sections.slice(i, i + 3));
  const total = 1 + groups.length + 1;

  pages.push(`<section class="page cover">${chrome(1, total)}
    <div class="scrap"><div class="tape"></div>
      <h1>${esc(d.title)} <span class="hl">${esc(d.highlight)}</span></h1>${wavy}
      <p class="sub">${esc(d.subtitle)}</p>
      <div class="kw">هدية مجانية من HX 3D · الكلمة: <span>${esc(d.keyword)}</span></div>
    </div>
    <div class="doc">${docIcon}</div>
    <div class="note" style="position:absolute;bottom:44mm;right:20mm">احفظه وارجع له قبل كل طباعة</div>
    ${chain}</section>`);

  groups.forEach((g, i) => {
    const n = i + 2;
    const cards = Array.isArray(g) ? g : g.cards;
    const table = Array.isArray(g) ? "" : `<div class="scrap tablecard"><table><thead><tr>${g.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${g.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    pages.push(`<section class="page">${chrome(n, total)}<h2>${table ? "المقارنة" : i === (d.table ? 1 : 0) ? (d.table ? "متى تختار كل واحد" : d.slug === "printer-checklist" ? "قبل الشراء" : "المشاكل والحلول") : "تكملة"}</h2><div class="cards">${table}${cards.map(card).join("")}</div></section>`);
  });

  pages.push(`<section class="page">${chrome(total, total)}<h2>قائمة الفحص</h2>
    <div class="scrap checks"><div class="tape"></div>${d.checklist.map((c) => `<div class="check"><span class="box"></span>${esc(c)}</div>`).join("")}</div>
    <div class="scrap cta"><div><b>تحتاج قطعة مطبوعة بجودة عالية؟</b><div style="font-size:11pt;color:#4a4a4a">هدايا شركات · مجسمات معمارية · نماذج أولية — دبي</div></div><div class="h">@hx3d.uae</div></div>
    <p class="disclaimer">الأرقام في هذا الملف تقريبية وللإرشاد فقط. توصية الشركة المصنّعة للخيط والطابعة هي المرجع دائماً.</p>
    ${chain}</section>`);

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.title)} ${esc(d.highlight)}</title><style>${CSS}</style></head><body>${pages.join("")}</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const d of docs) {
    await page.setContent(html(d), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, `${d.slug}.pdf`);
    await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
    console.log("✓", path.relative(ROOT, out));
  }
  await browser.close();
})();
