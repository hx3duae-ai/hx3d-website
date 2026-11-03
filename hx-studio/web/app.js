import * as THREE from "three";
import { OrbitControls } from "/web/vendor/OrbitControls.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstChild; };
let lang = localStorage.getItem("hx_lang") || "en";
const T = {
  nav_tools: ["Tools", "الأدوات"], nav_projects: ["Projects", "المشاريع"], nav_business: ["Business", "الأعمال"], nav_status: ["Status", "الحالة"],
  foot: ["HX 3D AI Studio · Bambu Lab P2S + AMS · estimates are not slicer values · nothing is test-printed until you print it", "HX 3D AI Studio · طابعة Bambu Lab P2S مع AMS · الأرقام تقديرية وليست من برنامج التقطيع · لا شيء مُختبَر بالطباعة قبل أن تطبعه"],
  tools_h: ["All tools", "جميع الأدوات"], tools_p: ["Every card is a working tool. Cards marked 'needs backend' tell you exactly what to configure.", "كل بطاقة أداة تعمل فعلًا. البطاقات المعلّمة «تحتاج خدمة» توضّح ما يجب إعداده."],
  generate: ["Generate", "إنشاء"], export: ["Validate & export", "فحص وتصدير"], download_zip: ["Download all (.zip)", "تنزيل الكل (.zip)"], open: ["Open", "فتح"], del: ["Delete", "حذف"],
  qc: ["Quality control", "فحص الجودة"], info: ["Details", "التفاصيل"], analysis: ["Print analysis", "تحليل الطباعة"], colors: ["Colours & filaments", "الألوان والخيوط"],
  upload_img: ["Image", "صورة"], upload_mesh: ["Mesh (STL/3MF/OBJ)", "مجسم (STL/3MF/OBJ)"], upload_font: ["Custom font (TTF, optional)", "خط مخصص (TTF اختياري)"],
  ready: ["ready", "جاهز"], needs: ["needs backend", "تحتاج خدمة"], wire: ["Wireframe", "شبكة"], reset: ["Reset view", "إعادة العرض"],
  parts: ["Parts", "الأجزاء"], stage: ["Stage", "المرحلة"], none: ["Nothing yet.", "لا شيء بعد."], keymap: ["Click a key to customise it", "اضغط على مفتاح لتخصيصه"],
  apply_key: ["Apply to key & rebuild", "تطبيق على المفتاح وإعادة البناء"], legend: ["Legend", "الرمز"], legend2: ["Second legend (e.g. Arabic)", "الرمز الثاني (مثل العربي)"], keycolor: ["Key colour", "لون المفتاح"],
};
const tr = (k) => (T[k] ? T[k][lang === "ar" ? 1 : 0] : k);
const L = (o) => (typeof o === "string" ? o : o[lang === "ar" ? 1 : 0]);

// ---------------------------------------------------------------- tool definitions (every tool maps to a real engine)
const num = (key, en, ar, def, extra = {}) => ({ key, t: "number", l: [en, ar], d: def, ...extra });
const sel = (key, en, ar, opts, def) => ({ key, t: "select", l: [en, ar], o: opts, d: def ?? opts[0] });
const txt = (key, en, ar, def = "", extra = {}) => ({ key, t: "text", l: [en, ar], d: def, ...extra });
const clr = (key, en, ar, def) => ({ key, t: "color", l: [en, ar], d: def });
const chk = (key, en, ar, def = false) => ({ key, t: "check", l: [en, ar], d: def });
const MAT = sel("material", "Material", "الخامة", ["PLA", "PETG", "ABS"]);
const TOOLS = [
  { id: "image_to_3d", ic: "🖼️", n: ["Image to 3D", "صورة إلى 3D"], p: ["One image → multicolour 2.5D relief (local). Volumetric via external backend.", "صورة واحدة ← مجسم نافر متعدد الألوان (محلي). التجسيم الكامل عبر خدمة خارجية."], img: true,
    f: [sel("backend", "Engine", "المحرك", ["local", "external"]), num("width_mm", "Width mm", "العرض مم", 60), num("colors", "Colours (max)", "عدد الألوان", 4), sel("mode", "Relief mode", "نمط النتوء", ["flat", "height"]), num("base_t", "Base thickness", "سماكة القاعدة", 1.6, { step: .1 }), num("relief_t", "Relief height", "ارتفاع النتوء", 2.4, { step: .1 })] },
  { id: "toy_robot", ic: "🤖", n: ["Toy designer", "مصمم الألعاب"], p: ["Articulated print-in-place robot, joints verified by swept collision (~1 min).", "روبوت مفصلي يُطبع جاهزًا، تُفحص حركة المفاصل (~دقيقة)."],
    f: [MAT, clr("colors.body", "Body", "الجسم", "#e8702a"), clr("colors.head", "Head", "الرأس", "#e8702a"), clr("colors.eyes", "Eyes", "العيون", "#111111"), clr("colors.arms", "Arms", "الأذرع", "#f2f2f2"), clr("colors.legs", "Legs", "الأرجل", "#6b7280")] },
  { id: "colormatch", ic: "🎨", n: ["Smart colour match", "مطابقة الألوان"], p: ["Match any project's colours to your filaments (ΔE2000) + AMS plan.", "طابق ألوان أي مشروع مع خيوطك (ΔE2000) وخطة AMS."], special: "colormatch" },
  { id: "mechanical", ic: "⚙️", n: ["Mechanical designer", "المصمم الميكانيكي"], p: ["Gears, print-in-place hinge, mounting plates with collision/motion checks.", "تروس ومفصلات ولوحات تثبيت مع فحص التصادم والحركة."], multi: [
    { id: "gears", n: ["Gear pair", "زوج تروس"], f: [MAT, num("z1", "Teeth gear 1", "أسنان 1", 16), num("z2", "Teeth gear 2", "أسنان 2", 32), num("module", "Module", "الموديول", 2, { step: .25 }), num("thickness", "Thickness", "السماكة", 6), num("bore", "Bore", "الثقب", 5), num("backlash", "Backlash", "الخلوص", .15, { step: .05 })] },
    { id: "hinge", n: ["Print-in-place hinge", "مفصلة"], f: [MAT, num("length", "Length", "الطول", 40), num("leaf_w", "Leaf width", "عرض الجناح", 20), num("knuckles", "Knuckles", "عدد العقد", 5), num("pin_d", "Pin Ø", "قطر المسمار", 3, { step: .5 })] },
    { id: "mounting_plate", n: ["Mounting plate", "لوحة تثبيت"], f: [num("w", "Width", "العرض", 60), num("d", "Depth", "العمق", 40), num("t", "Thickness", "السماكة", 3), sel("screw", "Screw", "البرغي", ["M2", "M3", "M4"], "M3")] }] },
  { id: "optimizer", ic: "📐", n: ["Print optimizer", "محسّن الطباعة"], p: ["Open any project → orientation, supports, filament/time estimate, P2S tips.", "افتح أي مشروع ← الاتجاه والدعامات وتقدير الخيط والوقت."], special: "projects" },
  { id: "doctor", ic: "🩺", n: ["Model doctor & repair", "طبيب المجسمات والإصلاح"], p: ["Diagnose/repair STL, 3MF, OBJ: holes, flipped faces, specks, thin walls.", "فحص وإصلاح STL و3MF: ثقوب ووجوه مقلوبة وأجزاء صغيرة وجدران رقيقة."], special: "doctor" },
  { id: "text_to_3d", ic: "🔤", n: ["Text to 3D", "نص إلى 3D"], p: ["Arabic/English name plates, keychains; free-form description needs an LLM key.", "لوحات وميداليات بالعربي والإنجليزي؛ الوصف الحر يحتاج مفتاح LLM."], font: true,
    f: [txt("text", "Text (Arabic or English)", "النص (عربي أو إنجليزي)", "HX 3D"), sel("kind", "Type", "النوع", ["nameplate", "keychain", "text_only"]), num("height_mm", "Text height mm", "ارتفاع النص", 12), clr("color_text", "Text colour", "لون النص", "#FFFFFF"), clr("color_base", "Base colour", "لون القاعدة", "#050505"), txt("description", "…or free description (needs ANTHROPIC_API_KEY)", "…أو وصف حر (يحتاج مفتاح)", "")] },
  { id: "sketch_to_3d", ic: "✏️", n: ["Sketch to 3D", "رسمة إلى 3D"], p: ["Hand drawing / blueprint → extruded solid with your real dimensions.", "رسمة يدوية ← مجسم بأبعادك الحقيقية."], img: true,
    f: [num("width_mm", "Real width mm", "العرض الحقيقي مم", 60), num("height_mm", "Real height mm (optional)", "الارتفاع الحقيقي (اختياري)", 0), num("thickness", "Thickness", "السماكة", 5), chk("invert", "Invert (light lines on dark)", "عكس", false)] },
  { id: "keyboard", ic: "⌨️", n: ["Keyboard designer", "مصمم الكيبورد"], p: ["60/65/75/TKL/Full cases, plates, bezels, keycaps (Arabic+English), P2S-ready splitting.", "هياكل ولوحات وأغطية ومفاتيح عربية وإنجليزية جاهزة لـ P2S."], special: "keyboard" },
  { id: "keycap", ic: "🔘", n: ["Keycap designer", "مصمم المفاتيح"], p: ["MX keycaps: profiles, legends, multicolour, image topper, artisan mesh.", "مفاتيح MX: بروفايلات ورموز وألوان وصورة أو منحوتة."], img: true, mesh: true, f: [
    num("width_u", "Width (u)", "العرض (u)", 1, { step: .25 }), num("height_u", "Height (u)", "الارتفاع (u)", 1, { step: .25 }), sel("profile", "Profile", "البروفايل", ["cherry", "oem", "dsa", "xda", "sa"]),
    txt("legend", "Legend", "الرمز", "A"), txt("legend2", "Second legend (Arabic)", "رمز ثانٍ (عربي)", "ش"), clr("color_body", "Body", "الجسم", "#050505"), clr("color_legend", "Legend", "الرمز", "#FFFFFF"), clr("color_legend2", "Legend 2", "رمز 2", "#FF66B2"),
    num("slot_tol", "Stem slot tolerance mm", "تسامح فتحة الساق", 0.1, { step: .05 }), num("topper_height", "Image topper height", "ارتفاع الصورة", 2.5, { step: .1 }), num("sculpture_height", "Sculpture height", "ارتفاع المنحوتة", 12)] },
  { id: "logo_to_3d", ic: "🅻", n: ["Logo to 3D", "شعار إلى 3D"], p: ["Logo image → multicolour extrusion, one part per colour.", "شعار ← مجسم متعدد الألوان، جزء لكل لون."], img: true, f: [num("width_mm", "Width", "العرض", 50), num("thickness", "Thickness", "السماكة", 3), num("colors", "Colours", "الألوان", 3)] },
  { id: "calligraphy", ic: "ﷲ", n: ["Arabic calligraphy", "الخط العربي"], p: ["Arabic text with proper joined letters; supply any TTF for other styles.", "نص عربي بحروف متصلة؛ ارفع أي خط TTF لأنماط أخرى."], font: true,
    f: [txt("text", "Arabic text", "النص العربي", "بسم الله"), sel("kind", "Type", "النوع", ["nameplate", "keychain", "text_only"]), num("height_mm", "Height mm", "الارتفاع", 25), clr("color_text", "Text", "النص", "#FF66B2"), clr("color_base", "Base", "القاعدة", "#050505")] },
  { id: "lithophane", ic: "💡", n: ["Lithophane maker", "صانع الليثوفين"], p: ["Photo → backlit relief, watertight and print-ready.", "صورة ← مجسم ضوئي جاهز للطباعة."], img: true, f: [num("width_mm", "Width mm", "العرض مم", 100), num("min_t", "Min thickness", "أقل سماكة", .8, { step: .1 }), num("max_t", "Max thickness", "أعلى سماكة", 3.2, { step: .1 }), chk("invert", "Invert", "عكس")] },
  { id: "jewelry", ic: "💍", n: ["Jewelry designer", "مصمم الحلي"], p: ["Rings (US/EU sizes, engraved text) and pendants.", "خواتم (مقاسات) وقلادات."], multi: [
    { id: "ring", n: ["Ring", "خاتم"], f: [num("size", "Size", "المقاس", 7, { step: .5 }), sel("system", "System", "النظام", ["US", "EU"]), num("band_w", "Band width", "عرض الحلقة", 6), num("thickness", "Thickness", "السماكة", 2, { step: .1 }), txt("text", "Engraving", "نقش", "")] },
    { id: "pendant", n: ["Pendant", "قلادة"], img: true, f: [txt("text", "Text (if no image)", "نص (بدون صورة)", "HX"), num("size_mm", "Size", "الحجم", 30), num("thickness", "Thickness", "السماكة", 2.5, { step: .1 })] }] },
  { id: "box", ic: "📦", n: ["Box generator", "مولّد الصناديق"], p: ["Box + lid with snap bumps and optional screw posts.", "صندوق وغطاء مع مشابك اختيارية وفتحات براغي."], f: [MAT, num("w", "Width", "العرض", 80), num("d", "Depth", "العمق", 60), num("h", "Height", "الارتفاع", 40), num("wall", "Wall", "الجدار", 2, { step: .2 }), num("r", "Corner radius", "نصف القطر", 3), chk("screws", "Screw posts", "أعمدة براغي"), chk("latch", "Snap bumps", "مشابك", true)] },
  { id: "multipart", ic: "🧩", n: ["Multi-part assembly", "تقسيم وتركيب"], p: ["Upload a mesh larger than the bed → pieces with alignment pins.", "ارفع مجسمًا أكبر من الطابعة ← قطع بمسامير محاذاة."], mesh: true, f: [MAT, sel("axis", "Cut axis", "محور القطع", ["x", "y", "z"]), num("max_len", "Max piece length", "أقصى طول للقطعة", 238), num("pin_d", "Pin Ø", "قطر الدبوس", 4)] },
  { id: "primitive_spec", ic: "🧱", n: ["Custom product designer", "مصمم المنتجات"], p: ["Describe a product as editable primitives (JSON): boxes, cylinders, spheres, text, cuts.", "صمّم منتجًا من أشكال أساسية قابلة للتعديل (JSON)."], special: "spec" },
];
const TOOL_BY = Object.fromEntries(TOOLS.flatMap((t) => [[t.id, t], ...(t.multi || []).map((m) => [m.id, { ...m, ic: t.ic }])]));

// ---------------------------------------------------------------- helpers
const api = async (url, opt) => { const r = await fetch(url, opt); if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch {} throw new Error(m); } return r.headers.get("content-type")?.includes("json") ? r.json() : r; };
const setPath = (o, p, v) => { const k = p.split("."); let c = o; k.slice(0, -1).forEach((x) => (c = c[x] ??= {})); c[k.at(-1)] = v; };
const getVal = (f, root) => { const e = $(`[data-k="${f.key}"]`, root); if (!e) return undefined; return f.t === "check" ? e.checked : f.t === "number" ? parseFloat(e.value) : e.value; };
function fieldHTML(f, v) {
  const val = v ?? f.d; const lab = `<label>${L(f.l)}</label>`;
  if (f.t === "select") return `<div class="field">${lab}<select data-k="${f.key}">${f.o.map((o) => `<option ${o == val ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  if (f.t === "check") return `<div class="field"><label><input type="checkbox" data-k="${f.key}" ${val ? "checked" : ""}> ${L(f.l)}</label></div>`;
  return `<div class="field">${lab}<input data-k="${f.key}" type="${f.t}" value="${String(val).replace(/"/g, "&quot;")}" ${f.step ? `step="${f.step}"` : ""} ${f.t === "text" ? 'dir="auto"' : ""}></div>`;
}
const fmt = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : n);
function qcHTML(qc) { if (!qc) return ""; return `<div class="chk ${qc.passed ? "ok" : "fail"}"><span class="d"></span><b>${qc.passed ? "PASSED" : "FAILED"}</b></div>` + qc.checks.map((c) => `<div class="chk ${c.ok ? "ok" : c.level === "warn" || c.level === "info" ? "warn" : "fail"}"><span class="d"></span><span><b>${c.id}</b> — ${String(c.detail).slice(0, 400)}</span></div>`).join(""); }

// ---------------------------------------------------------------- 3D viewer
function makeViewer(box) {
  const cv = el(`<div class="viewer"><div class="hud"></div><div class="tools"><button class="ghost sm" data-a="wire">${tr("wire")}</button><button class="ghost sm" data-a="reset">${tr("reset")}</button></div></div>`); box.append(cv);
  const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setPixelRatio(Math.min(devicePixelRatio, 2)); cv.prepend(ren.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0b0e);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 5000); cam.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(200, -300, 400); scene.add(dl);
  const grid = new THREE.GridHelper(600, 30, 0xFF66B2, 0x2a2a33); grid.rotation.x = Math.PI / 2; scene.add(grid);
  const ctl = new OrbitControls(cam, ren.domElement); let dirty = true; const redraw = () => (dirty = true); ctl.addEventListener("change", redraw);
  const grp = new THREE.Group(); scene.add(grp); let wire = false;
  const size = () => { const w = cv.clientWidth, h = cv.clientHeight; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(() => { size(); redraw(); }).observe(cv); size();
  const f32 = (b) => new Float32Array(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer), u32 = (b) => new Uint32Array(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer);
  function fit() { const b = new THREE.Box3().setFromObject(grp); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    ctl.target.copy(c); cam.position.set(c.x + s * 0.55, c.y - s * 0.9, c.z + s * 0.6); grid.position.set(c.x, c.y, b.min.z); cam.far = s * 20; cam.updateProjectionMatrix(); ctl.update(); redraw(); }
  function load(parts) {
    grp.clear(); const list = [];
    for (const p of parts) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(f32(p.v), 3)); g.setIndex(new THREE.BufferAttribute(u32(p.i), 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })); m.userData = p; grp.add(m); list.push(m);
    }
    fit(); $(".hud", cv).textContent = `${parts.length} parts · ${parts.reduce((a, p) => a + p.faces, 0).toLocaleString()} tris`; return list;
  }
  cv.addEventListener("click", (e) => { const a = e.target.dataset.a; if (a === "wire") { wire = !wire; grp.children.forEach((m) => (m.material.wireframe = wire)); redraw(); } if (a === "reset") fit(); });
  (function loop() { if (!cv.isConnected) { ren.dispose(); return; } if (dirty) { dirty = false; ren.render(scene, cam); } requestAnimationFrame(loop); })();
  return { load, group: grp, fit };
}

// ---------------------------------------------------------------- job runner UI
async function runJob(jobId, bar, stageEl) {
  for (;;) { const j = await api(`/api/jobs/${jobId}`); bar.style.width = j.progress + "%"; stageEl.textContent = j.stage; if (j.state === "done") return j.result; if (j.state === "error") throw new Error(j.error); await new Promise((r) => setTimeout(r, 600)); }
}

// ---------------------------------------------------------------- pages
const view = $("#view");
const setNav = () => document.querySelectorAll(".top nav a").forEach((a) => { a.textContent = tr(a.dataset.i); a.classList.toggle("on", location.hash === a.getAttribute("href") || (a.getAttribute("href") === "#/" && (location.hash === "" || location.hash.startsWith("#/tool")))); });

async function home() {
  const caps = await api("/api/capabilities"); const C = caps.capabilities;
  const status = (id) => { const m = { image_to_3d: C.image_to_3d.local.status, toy_robot: C.toy_designer.local_template.status, text_to_3d: C.text_to_3d.text_plates.status }; return m[id] || "ready"; };
  view.innerHTML = `<h1>HX 3D AI Studio</h1><p class="lead">${tr("tools_p")}</p><div class="grid">${TOOLS.map((t) => `<a class="card" href="#/tool/${t.id}"><div class="ic">${t.ic}</div><h3>${L(t.n)}</h3><p>${L(t.p)}</p><span class="badge ${status(t.id) === "ready" ? "ready" : "needs"}">${status(t.id) === "ready" ? tr("ready") : tr("needs")}</span></a>`).join("")}
  <a class="card" href="#/business"><div class="ic">💼</div><h3>${lang === "ar" ? "أدوات الأعمال" : "Business tools"}</h3><p>${lang === "ar" ? "حاسبة التكلفة والتسعير والمخزون وعروض الأسعار" : "Cost calculator, pricing, filament inventory, quotes"}</p><span class="badge ready">${tr("ready")}</span></a></div>`;
}

async function projectsPage() {
  const ps = await api("/api/projects");
  view.innerHTML = `<h1>${tr("nav_projects")}</h1>` + (ps.length ? `<div class="panel"><table><tr><th>Name</th><th>Tool</th><th>Parts</th><th></th></tr>${ps.map((p) => `<tr><td>${p.name}</td><td>${p.tool}</td><td>${p.summary?.parts ?? ""}</td><td class="row"><a href="#/project/${p.id}"><button class="sm">${tr("open")}</button></a><button class="ghost sm" data-del="${p.id}">${tr("del")}</button></td></tr>`).join("")}</table></div>` : `<p class="lead">${tr("none")}</p>`);
  view.onclick = async (e) => { const d = e.target.dataset.del; if (d) { await api(`/api/projects/${d}`, { method: "DELETE" }); projectsPage(); } };
}

function resultPanel(host, pid, data) {
  const s = data.summary || data; const info = s.info || {};
  host.innerHTML = `<div class="panel"><h2>${tr("qc")}</h2>${qcHTML(s.qc)}</div>
  <div class="panel" style="margin-top:12px"><h2>${tr("info")}</h2><p class="note">${s.extents_mm?.join(" × ")} mm · ${s.parts} ${tr("parts")} · ${s.colors?.map((c) => `<span class="sw" style="background:${c}"></span>`).join(" ")} · ${s.fits_printer_as_one_piece ? "fits " : "<b class=err>assembled size exceeds one plate: printed as separate/split parts</b> "}${s.printer}</p>
  <pre>${JSON.stringify(Object.fromEntries(Object.entries(info).filter(([k]) => !["bom", "report", "joint_sweep", "stdout", "spec"].includes(k))), null, 1).slice(0, 2500)}</pre></div>
  <div class="panel" style="margin-top:12px"><div class="row"><button id="exp">${tr("export")}</button><button class="ghost" id="ana">${tr("analysis")}</button><button class="ghost" id="col">${tr("colors")}</button></div><div class="bar"><i></i></div><div class="note" id="stage"></div><div id="exout"></div></div>`;
  const bar = $(".bar i", host), st = $("#stage", host), out = $("#exout", host);
  $("#exp", host).onclick = async () => { out.innerHTML = ""; try { const { job_id } = await api(`/api/projects/${pid}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); const r = (await runJob(job_id, bar, st)).result;
    if (r.refused) { out.innerHTML = `<p class="err">${r.refused}</p>` + qcHTML(r.validation); return; }
    out.innerHTML = `<p><a href="/api/projects/${pid}/zip"><button>${tr("download_zip")}</button></a></p><table>${r.files.map((f) => `<tr><td><a href="/api/projects/${pid}/files/${f}">${f}</a></td></tr>`).join("")}</table><h2>Caveats</h2>${r.caveats.map((c) => `<p class="note">• ${c}</p>`).join("")}`; } catch (e) { out.innerHTML = `<p class="err">${e.message}</p>`; } };
  $("#ana", host).onclick = async () => { const a = await api(`/api/projects/${pid}/analysis`); out.innerHTML = `<h2>${tr("analysis")}</h2><p>≈ <b>${a.filament_g_total} g</b> · ≈ <b>${a.est_print_hours} h</b> <span class="note">(${a.honesty})</span></p><ul>${a.recommendations.map((r) => `<li>${r}</li>`).join("")}</ul><pre>${JSON.stringify(a.per_colour_g)}</pre>`; };
  $("#col", host).onclick = async () => { const c = await api(`/api/projects/${pid}/colors`); out.innerHTML = `<h2>${tr("colors")}</h2><p class="note">inventory: ${c.inventory_size} spools. <a href="#/business">edit</a></p><table>${c.matches.map((m) => `<tr><td><span class="sw" style="background:${m.target}"></span> ${m.target}</td><td>${m.match ? `<span class="sw" style="background:${m.match.hex}"></span> ${m.match.name}` : "—"}</td><td>ΔE ${m.delta_e ?? ""} ${m.verdict}</td><td class="note">${(m.alternatives || []).map((a) => a.filament.name).join(", ")}</td></tr>`).join("")}</table><p>AMS: ${c.ams.filaments_needed} filaments, ${c.ams.ams_units} unit(s) ${c.ams.warning || ""}</p>`; };
}

async function toolPage(id) {
  const t = TOOL_BY[id]; if (!t) { view.innerHTML = "<p>?</p>"; return; }
  if (t.special === "colormatch") return colorMatchPage(); if (t.special === "projects") return projectsPage(); if (t.special === "doctor") return doctorPage(); if (t.special === "keyboard") return keyboardPage(); if (t.special === "spec") return specPage();
  const parent = TOOLS.find((x) => x.id === id); const subs = parent?.multi; let cur = subs ? subs[0] : t;
  const draw = () => {
    view.innerHTML = `<h1>${t.ic} ${L(parent?.n || t.n)}</h1><p class="lead">${parent ? L(parent.p) : ""}</p>${subs ? `<div class="tabs">${subs.map((s) => `<button class="${s.id === cur.id ? "on" : ""}" data-sub="${s.id}">${L(s.n)}</button>`).join("")}</div>` : ""}
    <div class="tool"><div class="panel"><div id="form">${cur.f.map((f) => fieldHTML(f)).join("")}
    ${cur.img || parent?.img ? `<div class="field"><label>${tr("upload_img")}</label><input type="file" id="img" accept="image/*"></div>` : ""}${cur.mesh || parent?.mesh ? `<div class="field"><label>${tr("upload_mesh")}</label><input type="file" id="mesh" accept=".stl,.3mf,.obj,.ply"></div>` : ""}${cur.font || parent?.font ? `<div class="field"><label>${tr("upload_font")}</label><input type="file" id="font" accept=".ttf,.otf"></div>` : ""}</div>
    <button id="go">${tr("generate")}</button><div class="bar"><i></i></div><div class="note" id="stage"></div><div class="err" id="err"></div></div>
    <div><div id="vw"></div><div id="res" style="margin-top:12px"></div></div></div>`;
    const viewer = makeViewer($("#vw")); view.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => { cur = subs.find((s) => s.id === b.dataset.sub); draw(); }));
    $("#go").onclick = async () => {
      const params = {}; cur.f.forEach((f) => { const v = getVal(f, view); if (v !== undefined && !(f.t === "number" && (isNaN(v) || (f.key === "height_mm" && v === 0)))) setPath(params, f.key, v); });
      const fd = new FormData(); fd.append("tool", cur.id); fd.append("name", L(cur.n || t.n)); fd.append("params", JSON.stringify(params));
      for (const k of ["img", "mesh", "font"]) { const i = $("#" + k); if (i?.files[0]) fd.append(k === "img" ? "image" : k, i.files[0]); }
      $("#go").disabled = true; $("#err").textContent = "";
      try { const { project_id, job_id } = await api("/api/projects", { method: "POST", body: fd }); const r = await runJob(job_id, $(".bar i"), $("#stage")); const pv = await api(`/api/projects/${project_id}/preview`); viewer.load(pv.parts); resultPanel($("#res"), project_id, r); }
      catch (e) { $("#err").textContent = e.message; } finally { $("#go").disabled = false; }
    };
  };
  draw();
}

async function doctorPage() {
  view.innerHTML = `<h1>🩺 ${lang === "ar" ? "طبيب المجسمات" : "Model doctor & repair"}</h1><div class="tool"><div class="panel"><div class="field"><label>${tr("upload_mesh")}</label><input type="file" id="m" accept=".stl,.3mf,.obj,.ply"></div><div class="field"><label><input type="checkbox" id="sp"> remove tiny floating specks</label></div><div class="row"><button id="dx">Diagnose</button><button class="ghost" id="rp">Repair</button></div><p class="note">Repair is refused if it changes volume &gt;1% (needs your approval); self-intersections between shells are not detected.</p><div id="e" class="err"></div></div><div id="r"></div></div>`;
  const go = async (repair) => { const f = $("#m").files[0]; if (!f) return; const fd = new FormData(); fd.append("mesh", f); fd.append("repair", repair); fd.append("remove_specks", $("#sp").checked);
    try { const r = await api("/api/doctor", { method: "POST", body: fd }); const rep = r.report; const show = (d, t) => `<div class="panel" style="margin-bottom:10px"><h2>${t}</h2><p class="note">${d.faces} faces · watertight ${d.watertight} · ${d.extents_mm.join(" × ")} mm · ${d.bodies} bodies · printable ${d.printable}</p>${d.issues.map((i) => `<div class="chk ${i.severity === "error" ? "fail" : "warn"}"><span class="d"></span>${i.message}</div>`).join("") || "<p>No issues found.</p>"}</div>`;
      $("#r").innerHTML = repair ? show(rep.before, "Before") + show(rep.after, "After") + `<p>${rep.message}. Actions: ${rep.actions.join("; ")}</p>${r.project_id ? `<a href="#/project/${r.project_id}"><button>${tr("open")} repaired</button></a>` : ""}` : show(rep, "Report"); } catch (e) { $("#e").textContent = e.message; } };
  $("#dx").onclick = () => go(false); $("#rp").onclick = () => go(true);
}

async function colorMatchPage() {
  let inv = await api("/api/inventory");
  view.innerHTML = `<h1>🎨 ${lang === "ar" ? "مطابقة الألوان" : "Smart colour match"}</h1><div class="tool"><div class="panel"><div class="field"><label>Colours (hex, comma separated)</label><input id="cols" value="#ff66b2, #e8702a, #111111"></div><button id="m">Match</button><p class="note">Uses your filament inventory (Business tab). ΔE2000: &lt;2 excellent, &lt;5 close, &lt;10 noticeable.</p></div><div class="panel" id="r"></div></div>`;
  $("#m").onclick = async () => { const cols = $("#cols").value.split(",").map((s) => s.trim()).filter(Boolean); const r = await api("/api/colors/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ colors: cols }) });
    $("#r").innerHTML = (inv.length ? "" : `<p class="err">Inventory is empty — add your spools in Business → Inventory.</p>`) + `<table>${r.matches.map((m) => `<tr><td><span class="sw" style="background:${m.target}"></span> ${m.target}</td><td>${m.match ? `<span class="sw" style="background:${m.match.hex}"></span> ${m.match.name}` : "—"}</td><td>ΔE ${m.delta_e ?? ""} · ${m.verdict}</td><td class="note">alt: ${(m.alternatives || []).map((a) => `${a.filament.name} (${a.delta_e})`).join(", ")}</td></tr>`).join("")}</table><p>AMS: ${r.ams.filaments_needed} filament(s), ${r.ams.ams_units} unit(s) ${r.ams.warning || ""}</p>`; };
}

async function specPage() {
  const ex = { parts: [{ name: "base", shape: "box", size: [60, 40, 6], color: "#050505" }, { name: "post", shape: "cylinder", size: [12, 30], pos: [0, 0, 18], color: "#FF66B2" }, { name: "ball", shape: "sphere", size: [16], pos: [0, 0, 36], color: "#FFFFFF" }, { name: "hole", shape: "cylinder", size: [4, 20], pos: [20, 0, 3], op: "cut" }] };
  view.innerHTML = `<h1>🧱 ${L(TOOLS.find((x) => x.id === "primitive_spec").n)}</h1><div class="tool"><div class="panel"><div class="field"><label>Product spec (JSON: box, cylinder, sphere, cone, capsule, text; op add|cut; all mm)</label><textarea id="sp" rows="16" dir="ltr">${JSON.stringify(ex, null, 1)}</textarea></div><button id="go">${tr("generate")}</button><div class="bar"><i></i></div><div class="note" id="stage"></div><div class="err" id="err"></div></div><div><div id="vw"></div><div id="res" style="margin-top:12px"></div></div></div>`;
  const viewer = makeViewer($("#vw"));
  $("#go").onclick = async () => { try { const spec = JSON.parse($("#sp").value); const fd = new FormData(); fd.append("tool", "primitive_spec"); fd.append("name", "Custom product"); fd.append("params", JSON.stringify({ spec }));
    const { project_id, job_id } = await api("/api/projects", { method: "POST", body: fd }); const r = await runJob(job_id, $(".bar i"), $("#stage")); viewer.load((await api(`/api/projects/${project_id}/preview`)).parts); resultPanel($("#res"), project_id, r); } catch (e) { $("#err").textContent = e.message; } };
}

// ---------------------------------------------------------------- keyboard designer (layout, colours, per-key customisation, Arabic)
async function keyboardPage(existingPid) {
  const F = [sel("kb.layout", "Layout", "التخطيط", ["60", "65", "75", "tkl", "full"], "65"), num("kb.padding", "Case padding mm", "هامش الهيكل", 7, { step: .5 }), num("kb.wall", "Wall mm", "الجدار", 2.4, { step: .2 }), num("kb.internal_depth", "Internal depth (plate→floor) mm", "العمق الداخلي", 12, { step: .5 }),
    num("kb.split_angle", "Ergonomic split angle °", "زاوية التقسيم المريحة", 0, { step: .5 }), num("kb.tilt_deg", "Typing angle ° (wedge)", "زاوية الميل", 0, { step: .5 }), sel("kb.screw", "Screws", "البراغي", ["M2", "M3"], "M2"), num("kb.plate_t", "Plate thickness", "سماكة اللوحة", 1.5, { step: .1 }),
    num("kb.usb_x", "USB-C x from left edge (mm, 0 = centre)", "موضع USB-C من اليسار", 0), clr("kb.color_case", "Case colour", "لون الهيكل", "#050505"), clr("kb.color_plate", "Plate colour", "لون اللوحة", "#FF66B2"), clr("kb.color_bezel", "Bezel colour", "لون الغطاء", "#050505"),
    chk("keycaps.enabled", "Generate keycaps", "توليد المفاتيح", true), chk("keycaps.arabic", "Arabic legends (Arabic 101 positions)", "رموز عربية", true), sel("keycaps.profile", "Keycap profile", "بروفايل المفاتيح", ["cherry", "oem", "dsa", "xda", "sa"]),
    clr("keycaps.color", "Keycap colour", "لون المفاتيح", "#050505"), clr("keycaps.legend_color", "Legend colour", "لون الرمز", "#FFFFFF"), clr("keycaps.legend2_color", "Arabic legend colour", "لون الرمز العربي", "#FF66B2")];
  view.innerHTML = `<h1>⌨️ ${L(TOOLS.find((x) => x.id === "keyboard").n)}</h1><div class="tool"><div class="panel"><div id="form">${F.map((f) => fieldHTML(f)).join("")}<div class="field"><label>PCB profile JSON (optional, from YOUR PCB's drawing: {"name":..,"holes":[{"x":..,"y":..,"d":..}]})</label><textarea id="pcb" rows="3" dir="ltr"></textarea></div></div><button id="go">${tr("generate")}</button><div class="bar"><i></i></div><div class="note" id="stage"></div><div class="err" id="err"></div><p class="note">Does not claim compatibility with any specific PCB/controller/stabilizer. USB-C position is a labelled default unless you set it.</p></div>
  <div><div id="vw"></div><div class="panel" style="margin-top:12px"><h2>${tr("keymap")}</h2><div class="keymap" id="km"></div><div id="kf" class="row" style="margin-top:8px"></div></div><div id="res" style="margin-top:12px"></div></div></div>`;
  const viewer = makeViewer($("#vw")); let pid = null, params = null, keys = [];
  const build = async (update) => {
    if (!update) { params = { kb: {}, keycaps: { overrides: {} } }; F.forEach((f) => { const v = getVal(f, view); if (v !== undefined && !(f.t === "number" && isNaN(v))) setPath(params, f.key, v); }); if (!params.kb.usb_x) delete params.kb.usb_x; try { const p = $("#pcb").value.trim(); if (p) params.kb.pcb = JSON.parse(p); } catch { $("#err").textContent = "PCB JSON invalid"; return; } }
    $("#go").disabled = true; $("#err").textContent = "";
    try { let r; if (pid) { const x = await api(`/api/projects/${pid}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ params }) }); r = await runJob(x.job_id, $(".bar i"), $("#stage")); }
      else { const fd = new FormData(); fd.append("tool", "keyboard"); fd.append("name", "Keyboard " + params.kb.layout); fd.append("params", JSON.stringify(params)); const x = await api("/api/projects", { method: "POST", body: fd }); pid = x.project_id; r = await runJob(x.job_id, $(".bar i"), $("#stage")); }
      viewer.load((await api(`/api/projects/${pid}/preview`)).parts); resultPanel($("#res"), pid, r); drawKeys2(await api(`/api/projects/${pid}/keys`)); }
    catch (e) { $("#err").textContent = e.message; } finally { $("#go").disabled = false; }
  };
  function drawKeys2(kg) { const km = $("#km"); km.innerHTML = ""; const U = 19.05, s = 0.7; const minx = Math.min(...kg.map((k) => k.cx - k.w * U / 2)), maxy = Math.max(...kg.map((k) => k.cy + k.h * U / 2));
    kg.forEach((k, i) => { const d = el(`<div data-i="${i}" style="left:${(k.cx - k.w * U / 2 - minx) * s + 6}px;top:${(maxy - k.cy - k.h * U / 2) * s + 6}px;width:${k.w * U * s - 2}px;height:${k.h * U * s - 2}px;transform:rotate(${-k.rot}deg)">${k.label}</div>`); km.append(d); });
    km.onclick = (e) => { const i = e.target.dataset.i; if (i === undefined) return; km.querySelectorAll(".sel").forEach((x) => x.classList.remove("sel")); e.target.classList.add("sel"); const o = params.keycaps.overrides[i] || {};
      $("#kf").innerHTML = `<input id="k1" placeholder="${tr("legend")}" value="${o.legend ?? kg[i].label}" dir="auto" style="width:90px"><input id="k2" placeholder="${tr("legend2")}" value="${o.legend2 ?? ""}" dir="auto" style="width:110px"><input id="kc" type="color" value="${o.color ?? "#050505"}" style="width:50px"><button class="sm" id="ka">${tr("apply_key")}</button>`;
      $("#ka").onclick = () => { params.keycaps.overrides[i] = { legend: $("#k1").value, legend2: $("#k2").value, color: $("#kc").value }; build(true); }; }; }
  $("#go").onclick = () => build(false);
}

async function projectPage(pid) {
  const p = await api(`/api/projects/${pid}`); view.innerHTML = `<h1>${p.name}</h1><p class="lead">${p.tool}</p><div><div id="vw"></div><div id="res" style="margin-top:12px"></div></div>`;
  const v = makeViewer($("#vw")); v.load((await api(`/api/projects/${pid}/preview`)).parts); resultPanel($("#res"), pid, { summary: p.summary });
}

async function businessPage() {
  let inv = await api("/api/inventory"); const caps = await api("/api/capabilities");
  view.innerHTML = `<h1>💼 ${lang === "ar" ? "أدوات الأعمال" : "HX 3D business tools"}</h1><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
  <div class="panel"><h2>Cost & price calculator</h2><div id="cf"></div><button id="cc">Calculate</button><div id="co"></div></div>
  <div class="panel"><h2>Filament inventory</h2><div id="iv"></div><div class="row"><button class="ghost sm" id="ia">+ spool</button><button class="ghost sm" id="ie">Load example set</button><button class="sm" id="is">Save</button></div><p class="note">Example set is placeholder data — replace with your real spools.</p></div>
  <div class="panel"><h2>Customer quote (PDF with HX 3D logo)</h2><div class="field"><label>Client</label><input id="qn" placeholder="Name"></div><div class="field"><label>Contact / address</label><input id="qa"></div><div class="field"><label>Lines: description | qty | unit price (one per line)</label><textarea id="ql" rows="4" dir="auto">Custom keyboard case | 1 | 80</textarea></div><button id="qb">Create PDF</button></div></div>`;
  const cf = [num("grams", "Filament g (total)", "الخيط غ", 40), num("hours", "Print hours", "ساعات", 3, { step: .1 }), num("colors", "Colours", "الألوان", 1), num("height_mm", "Model height mm", "الارتفاع", 30), MAT, num("price_kg", "Filament price / kg", "سعر الكيلو", 20), num("kwh_price", "Electricity / kWh", "سعر الكيلوواط", .12, { step: .01 }), num("power_w", "Printer avg watts", "الواط", 120), num("margin_pct", "Margin %", "الهامش", 40), num("failure_pct", "Failure allowance %", "نسبة الفشل", 8), num("vat_pct", "VAT %", "الضريبة", 0)];
  $("#cf").innerHTML = cf.map((f) => fieldHTML(f)).join("");
  $("#cc").onclick = async () => { const v = {}; cf.forEach((f) => (v[f.key] = getVal(f, $("#cf")))); const n = Math.max(1, v.colors); const g = {}; for (let i = 0; i < n; i++) g["c" + i] = v.grams / n;
    const r = await api("/api/business/cost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grams_by_color: g, hours: v.hours, height_mm: v.height_mm, material: v.material, price_kg: v.price_kg, kwh_price: v.kwh_price, power_w: v.power_w, margin_pct: v.margin_pct, failure_pct: v.failure_pct, vat_pct: v.vat_pct }) });
    $("#co").innerHTML = `<table><tr><td>Material</td><td>${r.material_cost}</td></tr><tr><td>Purge (est.)</td><td>${r.purge.cost} (${r.purge.grams} g, ${r.purge.color_changes_est} changes)</td></tr><tr><td>Electricity</td><td>${r.electricity}</td></tr><tr><td>Machine</td><td>${r.machine}</td></tr><tr><td>Failure allowance</td><td>${r.failure_allowance}</td></tr><tr><td><b>Cost</b></td><td><b>${r.cost_total}</b></td></tr><tr><td><b>Suggested price</b></td><td><b style="color:var(--pink)">${r.price_inc_vat} ${r.currency}</b> (profit ${r.profit})</td></tr></table><p class="note">${r.purge.note}. Defaults are editable assumptions.</p>`; };
  const drawInv = () => { $("#iv").innerHTML = `<table><tr><th></th><th>Name</th><th>Material</th><th>g</th></tr>${inv.map((s, i) => `<tr><td><input type="color" data-i="${i}" data-f="hex" value="${s.hex}" style="width:40px"></td><td><input data-i="${i}" data-f="name" value="${s.name}"></td><td><input data-i="${i}" data-f="material" value="${s.material}" style="width:60px"></td><td><input data-i="${i}" data-f="grams" type="number" value="${s.grams}" style="width:70px"></td></tr>`).join("")}</table>`;
    $("#iv").oninput = (e) => { const { i, f } = e.target.dataset; if (i === undefined) return; inv[i][f] = f === "grams" ? +e.target.value : e.target.value; }; };
  drawInv(); $("#ia").onclick = () => { inv.push({ id: "s" + Date.now(), name: "New spool", material: "PLA", hex: "#ffffff", grams: 1000 }); drawInv(); }; $("#ie").onclick = async () => { inv = await api("/api/inventory/example", { method: "POST" }); drawInv(); };
  $("#is").onclick = async () => { await api("/api/inventory", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(inv) }); alert("saved"); };
  $("#qb").onclick = async () => { const lines = $("#ql").value.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((a) => a.length >= 3).map((a) => ({ desc: a[0], qty: +a[1], unit: +a[2] }));
    const r = await fetch("/api/business/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client: { name: $("#qn").value, address: $("#qa").value }, lines }) }); const b = await r.blob(); const u = URL.createObjectURL(b); window.open(u); };
}

async function statusPage() {
  const c = await api("/api/capabilities"); const flat = [];
  const walk = (o, p = "") => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object" && "status" in v) flat.push([p + k, v]); else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, p + k + "."); } };
  walk(c.capabilities);
  view.innerHTML = `<h1>${tr("nav_status")}</h1><p class="lead">${lang === "ar" ? "ما يعمل الآن وما يحتاج خدمة خارجية — بصدق." : "What runs now and what needs an external service — honestly."}</p><div class="panel"><table>${flat.map(([k, v]) => `<tr><td>${k}</td><td><span class="badge ${v.status === "ready" ? "ready" : "needs"}">${v.status}</span></td><td class="note">${v.requires || v.what || v.limits || ""}</td></tr>`).join("")}</table></div><p class="note">Printer: ${c.printers.bambu_p2s.name}, build volume ${c.printers.bambu_p2s.build_volume.join("×")} mm (${c.printers.bambu_p2s.volume_is_assumption ? "ASSUMPTION - verify" : ""}).</p>`;
}

// ---------------------------------------------------------------- router + i18n
async function route() {
  const h = location.hash || "#/"; document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; $("#lang").textContent = lang === "ar" ? "English" : "العربية"; $("[data-i=foot]").textContent = tr("foot"); setNav();
  try { if (h === "#/") await home(); else if (h.startsWith("#/tool/")) await toolPage(h.split("/")[2]); else if (h === "#/projects") await projectsPage(); else if (h.startsWith("#/project/")) await projectPage(h.split("/")[2]); else if (h === "#/business") await businessPage(); else if (h === "#/status") await statusPage(); }
  catch (e) { view.innerHTML = `<p class="err">${e.message}</p>`; }
}
$("#lang").onclick = () => { lang = lang === "ar" ? "en" : "ar"; localStorage.setItem("hx_lang", lang); route(); };
addEventListener("hashchange", route); route();
