// Creative Studio pages: Video Studio, Image Studio, Engines & Hardware, Gallery. Loaded by app.js.
const $ = (s, r = document) => r.querySelector(s);
const api = async (url, opt) => { const r = await fetch(url, opt); if (!r.ok) { let m = r.statusText; try { const j = await r.json(); m = j.detail || m; } catch {} throw new Error(m); } return r.headers.get("content-type")?.includes("json") ? r.json() : r; };
const jpost = (url, body) => api(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function job(id, bar, st) { for (;;) { const j = await api(`/api/jobs/${id}`); bar.style.width = j.progress + "%"; st.textContent = j.stage; if (j.state === "done") return j.result; if (j.state === "error") throw new Error(j.error); await new Promise((r) => setTimeout(r, 700)); } }
const T = (ctx, en, ar) => (ctx.lang() === "ar" ? ar : en);
const opts = (arr, sel) => arr.map((o) => `<option ${o === sel ? "selected" : ""}>${o}</option>`).join("");

export const mediaCards = (ctx) => [
  ["🎬", "#/media/video", T(ctx, "AI Video Studio", "استوديو الفيديو"), T(ctx, "Script/images/3D models → MP4 with VOX template, voice, subtitles, SFX. Works offline, no GPU.", "سكريبت/صور/مجسمات ← MP4 بقالب VOX وصوت وترجمة ومؤثرات. يعمل محليًا بدون GPU.")],
  ["🖼️", "#/media/image", T(ctx, "AI Image Studio", "استوديو الصور"), T(ctx, "Brand posts, ads, thumbnails, product shots (product preserved exactly) + prompt engine.", "منشورات وإعلانات وأغلفة وصور منتجات (المنتج يبقى كما هو) + محرك البرومبت.")],
  ["🧠", "#/media/engines", T(ctx, "Engines & hardware", "المحركات والجهاز"), T(ctx, "Detects your machine, lists free engines/models, licences, requirements.", "يفحص جهازك ويعرض المحركات والنماذج المجانية وتراخيصها ومتطلباتها.")],
  ["🗂️", "#/media/gallery", T(ctx, "Media gallery", "معرض الوسائط"), T(ctx, "All videos/images, re-render, compare, download.", "كل الفيديوهات والصور: إعادة، مقارنة، تنزيل.")],
];

export async function mediaRoute(h, ctx) {
  const v = ctx.view; const p = h.split("/")[2] || "gallery";
  if (p === "video") return videoPage(v, ctx); if (p === "image") return imagePage(v, ctx); if (p === "engines") return enginesPage(v, ctx); return galleryPage(v, ctx);
}

async function promptBox(host, ctx, kind) {
  host.innerHTML = `<div class="panel" style="margin-top:12px"><h2>${T(ctx, "Smart prompt engine", "محرك البرومبت الذكي")}</h2><div class="field"><label>${T(ctx, "Simple idea", "فكرة بسيطة")}</label><input id="pi" dir="auto"></div><button class="ghost sm" id="pg">${T(ctx, "Enhance", "تحسين")}</button><pre id="po" dir="ltr"></pre><p class="note">${T(ctx, "Template-based (no AI call). Use the result in ComfyUI/Firefly/Flow, or as a shot plan.", "قائم على قوالب (بدون ذكاء اصطناعي). استخدمه في ComfyUI أو Firefly أو Flow.")}</p></div>`;
  $("#pg", host).onclick = async () => { const r = await jpost("/api/media/prompt", { idea: $("#pi", host).value, kind }); $("#po", host).textContent = r.prompt + "\n\nNEGATIVE: " + r.negative_prompt + "\n\n" + JSON.stringify(r.choices, null, 1) + (r.shot_plan ? "\n\nSHOTS: " + JSON.stringify(r.shot_plan) : ""); };
}

async function videoPage(view, ctx) {
  const eng = await api("/api/media/engines"); let fonts = []; try { fonts = await api("/api/fonts"); } catch {}
  const stash = sessionStorage.getItem("hx_rerender"); sessionStorage.removeItem("hx_rerender"); let sb = stash ? JSON.parse(stash) : null; let uploads = [];
  view.innerHTML = `<h1>🎬 ${T(ctx, "AI Video Studio", "استوديو الفيديو")}</h1><p class="lead">${T(ctx, "Real local engine: animates your script, images or 3D models with FFmpeg. It does not invent footage (that needs a GPU model - see Engines).", "محرك محلي حقيقي: يحرّك السكريبت والصور والمجسمات عبر FFmpeg. لا يختلق لقطات (هذا يحتاج نموذج GPU - انظر المحركات).")}</p>
  <div class="tool"><div class="panel">
   <div class="tabs"><button class="on" data-src="script">${T(ctx, "Script", "سكريبت")}</button><button data-src="images">${T(ctx, "Images", "صور")}</button><button data-src="model">${T(ctx, "3D project", "مشروع 3D")}</button></div>
   <div id="src"></div>
   <div class="field"><label>${T(ctx, "Template", "القالب")}</label><select id="tpl"><option value="vox">VOX · HX 3D (paper grid)</option></select></div>
   <div class="field"><label>${T(ctx, "Aspect", "النسبة")}</label><select id="asp">${opts(["9:16", "16:9", "1:1", "4:5"], "9:16")}</select></div>
   <div class="field"><label>${T(ctx, "Quality", "الجودة")}</label><select id="q"><option value="draft">draft 540p/15fps (fast)</option><option value="final">final 1080p/30fps</option></select></div>
   <div class="field"><label>${T(ctx, "Voice", "الصوت")}</label><select id="voice">${eng.voices.map((x) => `<option value="${x.id}" ${x.status !== "ready" ? "disabled" : ""}>${esc(x.label)} ${x.status !== "ready" ? "— " + T(ctx, "needs setup", "يحتاج إعداد") : ""}</option>`).join("")}</select><p class="note">${esc((eng.voices.find((x) => x.id === "hx_emirati") || {}).requires || "")}</p></div>
   <div class="field"><label>${T(ctx, "Subtitles", "الترجمة")}</label><select id="sub"><option value="burn">burned-in + .srt</option><option value="none">.srt only</option></select></div>
   <div class="field"><label>${T(ctx, "Font", "الخط")}</label><select id="fnt">${fonts.map((f) => `<option value="${f.id}">${esc(ctx.lang() === "ar" ? f.ar : f.en)}</option>`).join("")}</select></div>
   <div class="field"><label><input type="checkbox" id="logo" checked> ${T(ctx, "HX 3D logo", "شعار HX 3D")}</label></div>
   <div class="field"><label><input type="checkbox" id="sfx" checked> ${T(ctx, "Sound effects (no music)", "مؤثرات صوتية (بدون موسيقى)")}</label></div>
   <button id="sbtn">${T(ctx, "1 · Create storyboard", "١ · إنشاء الستوري بورد")}</button><div class="err" id="err"></div></div>
  <div><div class="panel"><h2>${T(ctx, "Storyboard (editable)", "الستوري بورد (قابل للتعديل)")}</h2><div id="sbv" class="note">${T(ctx, "Create a storyboard first.", "أنشئ ستوري بورد أولًا.")}</div></div>
  <div class="panel" style="margin-top:12px"><button id="rbtn" disabled>${T(ctx, "2 · Render video", "٢ · إنشاء الفيديو")}</button><div class="bar"><i></i></div><div class="note" id="st"></div><div id="out"></div></div><div id="pe"></div></div></div>`;
  let src = "script";
  const drawSrc = () => { const s = $("#src");
    if (src === "script") s.innerHTML = `<div class="field"><label>${T(ctx, "Video idea / script (Arabic or English; blank line = new scene; lines starting with - are bullets)", "فكرة الفيديو / السكريبت (سطر فارغ = مشهد جديد؛ السطور التي تبدأ بـ - نقاط)")}</label><textarea id="scr" rows="9" dir="auto">${esc(ctx.lang() === "ar" ? "هل تعلم أن الطباعة ثلاثية الأبعاد تصنع المنتجات طبقة فوق طبقة؟\n\nكل طبقة بسماكة 0.2 مم تقريبًا.\n\n- اختر فيلمنت مناسب\n- اضبط حرارة الفوهة\n- راقب الطبقة الأولى\n\nتكلفة قطعة صغيرة قد تبدأ من 5 درهم." : "Did you know 3D printers build objects layer by layer?\n\nEach layer is about 0.2 mm thick.\n\n- Pick the right filament\n- Set the nozzle temperature\n- Watch the first layer\n\nA small part can cost under 5 AED.")}</textarea></div>`;
    else if (src === "images") s.innerHTML = `<div class="field"><label>${T(ctx, "Images (each becomes a Ken-Burns scene)", "الصور (كل صورة مشهد بحركة كاميرا)")}</label><input type="file" id="imgs" accept="image/*" multiple></div><div class="field"><label>${T(ctx, "Captions/narration, one line per image", "تعليق/سرد، سطر لكل صورة")}</label><textarea id="caps" rows="4" dir="auto"></textarea></div>`;
    else s.innerHTML = `<div class="field"><label>${T(ctx, "HX project id (from Projects)", "رقم مشروع HX (من المشاريع)")}</label><input id="pid"></div><div class="field"><label>${T(ctx, "Title", "العنوان")}</label><input id="mt" dir="auto"></div>`; };
  view.querySelectorAll("[data-src]").forEach((b) => (b.onclick = () => { src = b.dataset.src; view.querySelectorAll("[data-src]").forEach((x) => x.classList.toggle("on", x === b)); drawSrc(); })); drawSrc();
  const aspect = () => $("#asp").value;
  const show = () => { const box = $("#sbv"); box.innerHTML = sb.scenes.map((sc, i) => `<div class="panel" style="margin-bottom:8px;background:#0b0b0e"><b>${i + 1} · ${sc.kind}</b> <span class="note">${sc.tag || ""} ${sc.visual_suggestion ? "· " + esc(sc.visual_suggestion.idea) : ""}</span>
    <div class="field"><label>${T(ctx, "Narration / caption", "السرد / التعليق")}</label><textarea data-i="${i}" data-f="narration" rows="2" dir="auto">${esc(sc.narration || sc.caption)}</textarea></div>
    <div class="row"><label class="note">${T(ctx, "min sec", "أقل مدة")} <input type="number" step="0.5" data-i="${i}" data-f="min_duration" value="${sc.min_duration ?? 3}" style="width:70px"></label>
    <label class="note">${T(ctx, "transition", "الانتقال")} <select data-i="${i}" data-f="transition">${["crossfade", "slide_up", "slide_left", "wipe", "none"].map((o) => `<option ${sc.transition?.type === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
    <label class="note">${T(ctx, "camera", "الكاميرا")} <select data-i="${i}" data-f="camera">${["pan_down", "pan_up", "zoom_in", "zoom_out", "pan_left", "pan_right", "static", "orbit"].map((o) => `<option ${sc.camera?.type === o ? "selected" : ""}>${o}</option>`).join("")}</select></label></div>
    ${(sc.elements || []).map((el, j) => (el.text !== undefined ? `<div class="field"><label>${el.type}</label><input data-i="${i}" data-j="${j}" data-f="eltext" value="${esc(el.text)}" dir="auto"></div>` : `<span class="note">${el.type}${el.name ? ": " + el.name : ""} </span>`)).join("")}</div>`).join("");
    $("#rbtn").disabled = false; };
  box_edit: { $("#sbv").addEventListener("input", (e) => { const t = e.target, i = +t.dataset.i, f = t.dataset.f; if (f === undefined || !sb) return; const sc = sb.scenes[i];
    if (f === "narration") { sc.narration = t.value; sc.caption = t.value; } else if (f === "min_duration") sc.min_duration = parseFloat(t.value) || 3; else if (f === "transition") sc.transition = { type: t.value, dur: t.value === "none" ? 0 : .5 }; else if (f === "camera") sc.camera = { ...(sc.camera || {}), type: t.value }; else if (f === "eltext") sc.elements[+t.dataset.j].text = t.value; }); }
  if (sb) { $("#asp").value = sb.aspect; show(); }
  $("#sbtn").onclick = async () => { $("#err").textContent = "";
    try { let body;
      if (src === "script") body = { source: "script", script: $("#scr").value, template: $("#tpl").value, aspect: aspect() };
      else if (src === "images") { const fs = [...$("#imgs").files]; if (!fs.length) throw new Error("choose images"); const caps = $("#caps").value.split("\n"); const items = []; for (let i = 0; i < fs.length; i++) { const fd = new FormData(); fd.append("file", fs[i]); const u = await api("/api/media/upload", { method: "POST", body: fd }); items.push({ path: u.path, caption: caps[i] || "", narration: caps[i] || "" }); } body = { source: "images", items, aspect: aspect() }; }
      else body = { source: "model", project_id: $("#pid").value.trim(), title: $("#mt").value, aspect: aspect() };
      sb = await jpost("/api/media/storyboard", body); show(); } catch (e) { $("#err").textContent = e.message; } };
  $("#rbtn").onclick = async () => { $("#rbtn").disabled = true; $("#out").innerHTML = ""; $("#err").textContent = ""; sb.aspect = aspect();
    try { const r = await jpost("/api/media/render", { storyboard: sb, quality: $("#q").value, voice: $("#voice").value, subtitles: $("#sub").value, logo: $("#logo").checked, sfx: $("#sfx").checked, font_id: $("#fnt").value === "auto" ? null : $("#fnt").value, name: "Video" });
      const res = await job(r.job_id, $(".bar i"), $("#st")); const m = res.manifest; const f = (n) => `/api/media/file/${res.id}/${n}`;
      $("#out").innerHTML = `<video controls playsinline src="${f("out.mp4")}" style="max-width:100%;max-height:560px;border-radius:12px;background:#000"></video><p><a href="${f("out.mp4")}"><button>MP4</button></a> <a href="${f("out.srt")}"><button class="ghost">SRT</button></a></p>
      <p class="note">${m.size.join("×")} · ${m.fps} fps · ${m.duration_s}s · ${m.engine} · ${T(ctx, "no watermark, no credits (local)", "بدون علامة مائية وبدون رصيد (محلي)")} · voice: ${m.voice_provider}</p>${m.warnings.map((w) => `<p class="note">⚠ ${esc(w)}</p>`).join("")}
      <h2>${T(ctx, "Verification (ffprobe)", "التحقق (ffprobe)")}</h2>${Object.entries(m.verify.checks).map(([k, ok]) => `<div class="chk ${ok ? "ok" : "fail"}"><span class="d"></span>${k}</div>`).join("")}`;
    } catch (e) { $("#err").textContent = e.message; } finally { $("#rbtn").disabled = false; } };
  promptBox($("#pe"), ctx, "video");
}

async function imagePage(view, ctx) {
  const P = ["instagram_post", "instagram_square", "story_reel_cover", "youtube_thumbnail", "product_white", "ad_landscape", "logo_square"]; let fonts = []; try { fonts = await api("/api/fonts"); } catch {}
  view.innerHTML = `<h1>🖼️ ${T(ctx, "AI Image Studio", "استوديو الصور")}</h1><p class="lead">${T(ctx, "Local brand compositor: your product image is placed unchanged (scaled only). Generative text-to-image needs an engine (see Engines).", "مُركِّب محلي بهوية HX: صورة منتجك تُوضع كما هي (تكبير/تصغير فقط). توليد الصور من النص يحتاج محركًا (انظر المحركات).")}</p>
  <div class="tool"><div class="panel"><div class="field"><label>Preset</label><select id="pre">${opts(P, "instagram_post")}</select></div><div class="field"><label>Background</label><select id="bg">${opts(["brand", "paper", "studio", "white"], "brand")}</select></div>
  <div class="field"><label>${T(ctx, "Headline", "العنوان")}</label><input id="hd" dir="auto" value="طابعة ثلاثية الأبعاد"></div><div class="field"><label>${T(ctx, "Sub", "العنوان الفرعي")}</label><input id="sb" dir="auto"></div>
  <div class="field"><label>${T(ctx, "Price badge", "شارة السعر")}</label><input id="pr" dir="auto"></div><div class="field"><label>CTA</label><input id="cta" dir="auto" value="اطلب الآن"></div>
  <div class="field"><label>${T(ctx, "Product image (preserved)", "صورة المنتج (تُحفظ كما هي)")}</label><input type="file" id="prod" accept="image/*"></div><div class="field"><label>${T(ctx, "…or HX project id (3D render)", "…أو رقم مشروع HX (رندر 3D)")}</label><input id="pid"></div>
  <div class="field"><label>Font</label><select id="fnt">${fonts.map((f) => `<option value="${f.id}">${esc(ctx.lang() === "ar" ? f.ar : f.en)}</option>`).join("")}</select></div><div class="field"><label><input type="checkbox" id="card"> ${T(ctx, "White card behind product", "بطاقة بيضاء خلف المنتج")}</label></div>
  <button id="go">${T(ctx, "Generate", "إنشاء")}</button><div class="err" id="err"></div></div><div><div class="panel" id="res" style="min-height:200px"><p class="note">${T(ctx, "Result appears here.", "تظهر النتيجة هنا.")}</p></div><div id="pe"></div></div></div>`;
  $("#go").onclick = async () => { const fd = new FormData(); fd.append("preset", $("#pre").value); fd.append("bg", $("#bg").value); fd.append("headline", $("#hd").value); fd.append("sub", $("#sb").value); fd.append("price", $("#pr").value); fd.append("cta", $("#cta").value);
    fd.append("font_id", $("#fnt").value === "auto" ? "" : $("#fnt").value); fd.append("product_card", $("#card").checked); fd.append("project_id", $("#pid").value.trim()); if ($("#prod").files[0]) fd.append("product", $("#prod").files[0]); $("#err").textContent = "";
    try { const m = await api("/api/media/image", { method: "POST", body: fd }); $("#res").innerHTML = `<img src="/api/media/file/${m.id}/out.png" style="max-width:100%;border-radius:12px"><p><a href="/api/media/file/${m.id}/out.png"><button>PNG ${m.manifest.size.join("×")}</button></a></p><p class="note">${m.manifest.engine} · ${m.manifest.preserved_product ? T(ctx, "product pixels preserved (uniform scale only)", "بيانات المنتج محفوظة (تحجيم متناسب فقط)") : ""} · ${T(ctx, "no watermark", "بدون علامة مائية")}</p>`; } catch (e) { $("#err").textContent = e.message; } };
  promptBox($("#pe"), ctx, "image");
}

async function enginesPage(view, ctx) {
  const [h, e, m] = await Promise.all([api("/api/media/hardware"), api("/api/media/engines"), api("/api/media/models")]);
  const badge = (s) => `<span class="badge ${s === "ready" ? "ready" : "needs"}">${s}</span>`;
  view.innerHTML = `<h1>🧠 ${T(ctx, "Engines & hardware", "المحركات والجهاز")}</h1><div class="panel"><h2>${T(ctx, "This machine (the one running the server)", "الجهاز (الذي يشغّل الخادم)")}</h2><p>${h.cpu_cores} CPU · ${h.ram_gb} GB RAM · ${h.disk_free_gb} GB free · GPU: ${h.gpus.map((g) => g.name + " " + (g.vram_gb || "?") + "GB").join(", ") || "none"} · tier <b>${h.tier}</b></p><p class="note">${esc(h.note)}</p>
  <p class="note">FFmpeg: ${h.tools.ffmpeg.found ? "✓" : "✗"} · Blender: ${h.tools.blender.found ? "✓" : "✗ (optional)"} · piper: ${h.tools.piper.found ? "✓" : "✗"} · torch: ${h.tools.torch.found ? "✓" : "✗"}</p></div>
  <div class="panel" style="margin-top:12px"><h2>${T(ctx, "Engines", "المحركات")}</h2><table>${e.engines.map((x) => `<tr><td>${esc(x.label)}</td><td>${badge(x.status)}</td><td class="note">${esc(x.limits || x.requires || "")}</td><td>${x.open_site ? `<a href="${x.open_site}" target="_blank" rel="noopener"><button class="ghost sm">${T(ctx, "Open official site", "فتح الموقع الرسمي")}</button></a>` : ""}</td></tr>`).join("")}</table></div>
  <div class="panel" style="margin-top:12px"><h2>${T(ctx, "Voices", "الأصوات")}</h2><table>${e.voices.map((x) => `<tr><td>${esc(x.label)}</td><td>${badge(x.status)}</td><td class="note">${esc(x.requires)}</td></tr>`).join("")}</table></div>
  <div class="panel" style="margin-top:12px"><h2>${T(ctx, "Open models (nothing downloads without your approval)", "نماذج مفتوحة (لا يُنزَّل شيء دون موافقتك)")}</h2><table><tr><th>Model</th><th>Disk</th><th>VRAM/RAM</th><th>Licence (unverified)</th><th>This machine</th></tr>${m.models.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.disk_gb} GB</td><td>${x.min_vram_gb} / ${x.min_ram_gb} GB</td><td class="note">${esc(x.license_note)}</td><td>${x.compatible ? '<span class="badge ready">compatible</span>' : `<span class="badge needs">no</span><div class="note">${esc(x.problems.join("; "))}</div>`}</td></tr>`).join("")}</table><p class="note">${esc(m.rule)}</p></div>`;
}

async function galleryPage(view, ctx) {
  const items = await api("/api/media/items"); const sel = new Set();
  view.innerHTML = `<h1>🗂️ ${T(ctx, "Media gallery", "معرض الوسائط")}</h1><p class="lead">${T(ctx, "Engine: local procedural · credits: unlimited · watermark: none (nothing is stamped on local output)", "المحرك: محلي · الرصيد: غير محدود · العلامة المائية: لا توجد")}</p><div id="cmp"></div>
  <div class="grid">${items.map((i) => `<div class="card" style="cursor:default"><b>${esc(i.name)}</b> <span class="badge ${i.status === "done" ? "ready" : "needs"}">${i.status}</span>${i.type === "video" && i.status === "done" ? `<video muted controls preload="metadata" src="/api/media/file/${i.id}/out.mp4" style="width:100%;border-radius:10px;margin-top:8px"></video>` : i.type === "image" ? `<img src="/api/media/file/${i.id}/thumb.jpg" style="width:100%;border-radius:10px;margin-top:8px">` : ""}
   <p class="note">${i.type} · ${i.manifest?.duration_s ? i.manifest.duration_s + "s · " : ""}${i.manifest?.engine || ""}${i.error ? `<br><span class="err">${esc(i.error)}</span>` : ""}</p>
   <div class="row"><label class="note"><input type="checkbox" data-sel="${i.id}"> ${T(ctx, "compare", "مقارنة")}</label>${i.type === "video" ? `<button class="ghost sm" data-re="${i.id}">${T(ctx, "Edit & re-render", "تعديل وإعادة")}</button>` : ""}<button class="ghost sm" data-del="${i.id}">✕</button></div></div>`).join("") || `<p class="note">${T(ctx, "Nothing yet.", "لا شيء بعد.")}</p>`}</div>`;
  view.onclick = async (e) => { const d = e.target.dataset;
    if (d.del) { await api(`/api/media/items/${d.del}`, { method: "DELETE" }); galleryPage(view, ctx); }
    if (d.re) { const it = await api(`/api/media/items/${d.re}`); sessionStorage.setItem("hx_rerender", JSON.stringify(it.storyboard)); location.hash = "#/media/video"; }
    if (d.sel) { e.target.checked ? sel.add(d.sel) : sel.delete(d.sel); const ids = [...sel].slice(-2); $("#cmp").innerHTML = ids.length === 2 ? `<div class="panel" style="margin-bottom:12px"><h2>${T(ctx, "Compare", "مقارنة")}</h2><div class="row" style="align-items:flex-start">${ids.map((id) => { const it = items.find((x) => x.id === id); return it.type === "video" ? `<video controls src="/api/media/file/${id}/out.mp4" style="width:48%"></video>` : `<img src="/api/media/file/${id}/out.png" style="width:48%">`; }).join("")}</div></div>` : ""; } };
}
