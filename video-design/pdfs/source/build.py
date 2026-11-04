import json
CSS = """
@font-face{font-family:Cairo;font-weight:900;src:url(node_modules/@fontsource/cairo/files/cairo-arabic-900-normal.woff2)}
@font-face{font-family:Cairo;font-weight:700;src:url(node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff2)}
@font-face{font-family:Cairo;font-weight:400;src:url(node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff2)}
@font-face{font-family:CairoL;font-weight:900;src:url(node_modules/@fontsource/cairo/files/cairo-latin-900-normal.woff2)}
@font-face{font-family:CairoL;font-weight:700;src:url(node_modules/@fontsource/cairo/files/cairo-latin-700-normal.woff2)}
@font-face{font-family:CairoL;font-weight:400;src:url(node_modules/@fontsource/cairo/files/cairo-latin-400-normal.woff2)}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{direction:rtl}
body{font-family:Cairo,CairoL,sans-serif;color:#151515;font-size:13.5pt;line-height:1.65}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;
 background:#f6f6f4;background-image:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px);background-size:9mm 9mm;padding:30mm 15mm 18mm}
.page:last-child{page-break-after:auto}
.logo{position:absolute;left:14mm;top:12mm;font-family:CairoL;font-weight:900;font-size:17pt;line-height:.85;text-align:center;background:#fff;padding:3mm 3.5mm;transform:rotate(3deg);box-shadow:0 2mm 3mm rgba(0,0,0,.12)}
.logo span{display:block;color:#FF66B2}
.kick{display:inline-block;background:#151515;color:#fff;font-weight:700;font-size:11pt;padding:1mm 4mm 1.6mm}
h1{font-weight:900;font-size:34pt;line-height:1.2;margin:4mm 0 2mm}
h1 em{font-style:normal;background:#FF66B2;padding:0 3mm}
.sub{font-size:13pt;color:#444;font-weight:700}
h2{font-weight:900;font-size:19pt;margin:0 0 2.5mm;display:flex;align-items:center;gap:3mm}
h2 .n{background:#FF66B2;min-width:11mm;height:11mm;display:inline-flex;align-items:center;justify-content:center;font-family:CairoL;font-size:16pt;border:.7mm solid #151515}
.card{background:#fff;padding:5mm 6mm;margin:0 0 5mm;box-shadow:0 1.5mm 4mm rgba(0,0,0,.09);position:relative}
.card.tape::before{content:"";position:absolute;top:-3mm;right:18mm;width:30mm;height:7mm;background:rgba(255,102,178,.45);transform:rotate(-3deg)}
.row{display:flex;gap:5mm}
.col{flex:1}
.lbl{font-weight:900;font-size:11pt;color:#FF66B2;margin-bottom:.5mm}
ul{list-style:none}
li{position:relative;padding-right:6mm;margin:.8mm 0}
li::before{content:"";position:absolute;right:0;top:3.2mm;width:2.4mm;height:2.4mm;background:#FF66B2}
ol{list-style:none;counter-reset:s}
ol li{counter-increment:s;padding-right:8mm}
ol li::before{content:counter(s);background:#151515;color:#fff;width:5.5mm;height:5.5mm;top:1.4mm;font-size:9pt;font-family:CairoL;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:50%}
.tip{background:#151515;color:#fff;padding:3mm 5mm;margin-top:3mm;font-weight:700;font-size:12pt}
.tip b{color:#FF66B2}
.chk li::before{width:4.4mm;height:4.4mm;background:#fff;border:.6mm solid #151515;top:2mm}
.chk li{padding-right:8mm;margin:1.6mm 0}
table{width:100%;border-collapse:collapse;background:#fff;font-size:12pt}
th,td{padding:2.6mm 3mm;border-bottom:.3mm solid #e3e3e3;text-align:right;vertical-align:top}
th{background:#151515;color:#fff;font-weight:900}
th.p{background:#FF66B2;color:#151515}
td:first-child{font-weight:700;width:30%}
.ltr{direction:ltr;unicode-bidi:isolate;font-family:CairoL,Cairo}
.foot{position:absolute;bottom:8mm;right:15mm;left:15mm;display:flex;justify-content:space-between;font-size:9.5pt;color:#777}
.mascot{position:absolute;width:52mm}
.stk{position:absolute;filter:drop-shadow(0 2mm 2.5mm rgba(0,0,0,.2))}
.cover-box{background:#fff;padding:7mm 8mm 8mm;margin-top:22mm;width:150mm;box-shadow:0 2mm 5mm rgba(0,0,0,.1);transform:rotate(-1deg)}
.blank{border-bottom:.4mm dashed #999;height:7mm;margin:.5mm 0}
.note{font-size:10.5pt;color:#555}
"""
def page(inner, n, total):
    return f'<div class="page"><div class="logo">HX<span>3D</span></div>{inner}<div class="foot"><span>HX 3D · ملف مجاني لمتابعينا</span><span class="ltr">{n} / {total}</span></div></div>'
def doc(title, pages):
    t=len(pages)
    body=''.join(page(p,i+1,t) for i,p in enumerate(pages))
    return f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>{title}</title><style>{CSS}</style></head><body>{body}</body></html>'

# ---------- 1. Problems ----------
P=[
("سطح الطباعة غير مستوٍ",["القطعة ما تلتصق أو تنفصل في النص","الطبقة الأولى متقطعة أو مضغوطة بزيادة","جهة من القطعة سليمة والثانية لا"],
 ["المسافة بين الفوهة والسطح غير متساوية","السطح متّسخ أو عليه دهون من اليد","قيمة Z-offset غير مضبوطة"],
 ["سخّن السطح والفوهة لحرارة الطباعة قبل المعايرة","عاير الزوايا الأربع والوسط بورقة A4: احتكاك خفيف بدون ما تنحشر","نظّف السطح بكحول أيزوبروبيل (IPA) ولا تلمسه بيدك","اضبط Z-offset بخطوات صغيرة وأنت تشوف الطبقة الأولى","اطبع الطبقة الأولى ببطء: حوالي 20–30 مم/ث"],
 "الطبقة الأولى الصحيحة <b>مسطّحة قليلاً</b> وخطوطها ملتصقة ببعض بدون فراغات."),
("الخيط الرطب",["صوت طقطقة أو فرقعة من الفوهة","فقاعات وسطح خشن","خيوط رفيعة زائدة بين الأجزاء"],
 ["الخيط يمتص الرطوبة من الهواء، خصوصاً في الجو الرطب","البكرة مخزّنة مفتوحة لفترة طويلة"],
 ["جفّف الخيط في مجفف خيوط أو فرن على حرارة منخفضة","PLA: حوالي 45–50°م لمدة 4–6 ساعات","PETG: حوالي 60–65°م لمدة 4–6 ساعات","خزّن البكرات في علبة محكمة مع أكياس سيليكا","لا تترك البكرة على الطابعة أيام في جو رطب"],
 "إذا سمعت <b>طقطقة</b> من الفوهة، أول شي جفّف الخيط قبل ما تغيّر أي إعداد."),
("حرارة غير مناسبة",["خيوط رفيعة كثيرة (حرارة عالية)","طبقات تنفصل بسهولة (حرارة منخفضة)","سطح لامع وذايب أو باهت وخشن"],
 ["كل خيط وكل شركة لها نطاق حرارة مختلف","الحرارة الفعلية للطابعة تختلف عن المكتوب أحياناً"],
 ["ابدأ من توصية الشركة المكتوبة على البكرة","PLA غالباً 190–220°م · PETG غالباً 220–250°م","اطبع «برج حرارة» (Temperature Tower) واختر أفضل طبقة","غيّر الحرارة 5°م كل مرة، مو أكثر","سجّل الحرارة اللي نجحت لكل بكرة"],
 "القيم تقريبية. <b>توصية الشركة المصنّعة</b> هي المرجع."),
("السرعة العالية",["تموّجات أو ظلال بعد الزوايا (Ghosting)","تفاصيل صغيرة ذايبة أو ناقصة","اهتزاز واضح على الجدران"],
 ["السرعة أعلى من قدرة الطابعة أو الخيط","السيور مرخية أو الطابعة على سطح يهتز"],
 ["خفّف السرعة للقطع الدقيقة: ابدأ بـ 40–60 مم/ث","خفّف سرعة الجدران الخارجية أكثر من الداخلية","تأكد إن السيور مشدودة","حط الطابعة على طاولة ثابتة وثقيلة","جرّب قطعة اختبار قبل الطباعات الطويلة"],
 "السرعة توفّر وقت، بس <b>الدقة أهم</b> في القطع اللي تبان."),
("اتجاه القطعة والدعامات",["أجزاء معلّقة تطيح أو تتدلّى","القطعة تنكسر بسهولة من نفس المكان","آثار دعامات تخرّب الشكل"],
 ["الأجزاء المعلّقة بزاوية أكبر من 45° تحتاج دعم","القطعة أضعف بين الطبقات منها على طولها"],
 ["حط أكبر سطح مسطّح على السرير","وجّه القطعة بحيث الضغط يكون على طول الطبقات","فعّل الدعامات للزوايا فوق 45° تقريباً","جرّب الدعامات الشجرية (Tree) لسهولة الإزالة","قلّل الدعامات بتغيير الاتجاه قبل ما تزيدها"],
 "<b>الاتجاه الصح</b> يقلّل الدعامات ويزيد القوة في نفس الوقت."),
]
def prob_card(i,p):
    t,sym,cause,fix,tip=p
    return f'''<div class="card tape"><h2><span class="n">{i}</span>{t}</h2>
<div class="row"><div class="col"><div class="lbl">الأعراض</div><ul>{''.join(f'<li>{x}</li>' for x in sym)}</ul></div>
<div class="col"><div class="lbl">السبب</div><ul>{''.join(f'<li>{x}</li>' for x in cause)}</ul></div></div>
<div class="lbl" style="margin-top:2mm">الحل خطوة بخطوة</div><ol>{''.join(f'<li>{x}</li>' for x in fix)}</ol>
<div class="tip">💡 {tip}</div></div>'''
cover1=f'''<div class="cover-box" style="margin-top:8mm"><span class="kick">دليل HX 3D</span><h1>حل <span class="ltr">5</span> <em>مشاكل</em><br>في طباعتك</h1>
<div class="sub">الأعراض، السبب، والحل خطوة بخطوة لأشهر مشاكل الطباعة ثلاثية الأبعاد</div></div>
<img class="stk" src="s_spaghetti.png" style="left:18mm;top:120mm;width:95mm;transform:rotate(-4deg)">
<img class="stk" src="s_benchy_pink.png" style="right:22mm;top:128mm;width:62mm;transform:rotate(5deg)">
<div class="card" style="position:absolute;right:15mm;bottom:22mm;width:115mm"><div class="lbl">في هذا الملف</div><ol>
{''.join(f'<li>{p[0]}</li>' for p in P)}<li>قائمة فحص قبل كل طباعة</li></ol></div>
<img class="mascot" src="wave.png" style="left:12mm;bottom:12mm;width:62mm">'''
check1='''<h1 style="margin-top:0">قائمة <em>فحص</em> قبل كل طباعة</h1><div class="sub" style="margin-bottom:6mm">اطبعها وعلّقها جنب الطابعة</div>
<div class="card tape"><ul class="chk">
<li>السطح نظيف بالكحول ومعاير (ورقة A4 بالزوايا والوسط)</li>
<li>الخيط جاف ومخزّن بعلبة محكمة</li>
<li>الحرارة حسب توصية الشركة (أو حسب برج الحرارة)</li>
<li>سرعة الطبقة الأولى بطيئة (20–30 مم/ث)</li>
<li>سرعة القطع الدقيقة معتدلة (40–60 مم/ث)</li>
<li>السيور مشدودة والطابعة على سطح ثابت</li>
<li>أكبر سطح للقطعة على السرير</li>
<li>الدعامات مفعّلة للأجزاء المعلّقة فوق 45°</li>
<li>راقب أول 3 طبقات قبل ما تتركها</li></ul></div>
<div class="card"><div class="lbl">سجّل إعداداتك الناجحة</div>
<table><tr><th>الخيط / الشركة</th><th>حرارة الفوهة</th><th>حرارة السرير</th><th>السرعة</th></tr>
<tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr></table></div>
<p class="note">القيم في هذا الملف تقريبية وتختلف حسب الطابعة والخيط. توصية الشركة المصنّعة هي المرجع.</p>
<img class="mascot" src="thumbs.png" style="left:10mm;bottom:12mm;width:58mm">'''
pages1=[cover1, prob_card(1,P[0])+prob_card(2,P[1]), prob_card(3,P[2])+prob_card(4,P[3]), prob_card(5,P[4])+'<img class="mascot" src="point.png" style="left:10mm;bottom:14mm;width:70mm">', check1]
open('problems.html','w',encoding='utf-8').write(doc('حل 5 مشاكل في طباعتك',pages1))

# ---------- 2. PLA vs PETG ----------
rows=[("سهولة الطباعة","سهل جداً، مناسب للمبتدئين","متوسط، يحتاج ضبط أكثر"),
("حرارة الفوهة (تقريبية)","190–220°م","220–250°م"),
("حرارة السرير (تقريبية)","50–60°م","70–85°م"),
("تحمّل الحرارة","يلين قرابة 60°م","يتحمل قرابة 80°م"),
("القوة والمرونة","قاسٍ لكنه هشّ عند الصدمات","أقوى وأكثر مرونة"),
("الماء والرطوبة","أقل تحمّلاً","يتحمل الماء والرطوبة أفضل"),
("الخيوط الرفيعة (Stringing)","قليلة","أكثر، يحتاج ضبط السحب"),
("تبريد المروحة","100% غالباً","30–50% غالباً"),
("التفاصيل والسطح","تفاصيل دقيقة وسطح نظيف","سطح لامع، تفاصيل أقل حدّة"),
("أفضل استخدام","مجسمات، ديكور، نماذج أولية","قطع وظيفية، خارجية، تتعرض لحرارة أو ماء")]
cover2=f'''<div class="cover-box" style="margin-top:8mm"><span class="kick">مقارنة HX 3D</span><h1><span class="ltr">PLA</span> أم <em class="ltr">PETG</em>؟</h1>
<div class="sub">مقارنة كاملة تساعدك تختار الخيط المناسب لقطعتك</div></div>
<img class="stk" src="s_spool_black.png" style="left:22mm;top:122mm;width:72mm;transform:rotate(-5deg)">
<img class="stk" src="s_spool_pink.png" style="right:24mm;top:118mm;width:78mm;transform:rotate(5deg)">
<div class="card" style="position:absolute;right:15mm;bottom:24mm;width:118mm"><div class="lbl">الخلاصة بسطر</div>
<b>PLA</b> للسهولة والتفاصيل والديكور · <b>PETG</b> للقوة والحرارة والماء</div>
<img class="mascot" src="flex.png" style="left:12mm;bottom:12mm;width:58mm">'''
tbl='<h1 style="margin-top:0;font-size:28pt">المقارنة <em>بالتفصيل</em></h1><div class="sub" style="margin-bottom:5mm">القيم تقريبية، راجع توصية الشركة على البكرة</div><table><tr><th>الخاصية</th><th class="p ltr">PLA</th><th class="ltr">PETG</th></tr>'+''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a,b,c in rows)+'</table>'
tbl+='<div class="row" style="margin-top:6mm"><div class="card col tape"><h2>اختر <span class="ltr">PLA</span> إذا…</h2><ul><li>أنت مبتدئ وتبي نتيجة مضمونة</li><li>القطعة ديكور أو مجسّم أو هدية</li><li>تحتاج تفاصيل دقيقة</li><li>القطعة داخل البيت بعيد عن الحرارة</li></ul></div><div class="card col tape"><h2>اختر <span class="ltr">PETG</span> إذا…</h2><ul><li>القطعة وظيفية وتتعرض لضغط</li><li>بتكون في السيارة أو تحت الشمس</li><li>تتعرض للماء أو الرطوبة</li><li>تحتاج مرونة وما تبيها تنكسر</li></ul></div></div>'
tips2='''<h1 style="margin-top:0;font-size:28pt">نصائح <em>طباعة</em> لكل خيط</h1><div class="row" style="margin-top:6mm">
<div class="card col tape"><h2 class="ltr" style="justify-content:flex-end">PLA</h2><ol>
<li>سطح نظيف ومعاير يكفي غالباً للالتصاق</li><li>مروحة التبريد على أعلى سرعة بعد أول طبقتين</li><li>لا تتركه في السيارة أو تحت الشمس</li><li>خزّنه جاف حتى لو يتأثر أقل</li></ol></div>
<div class="card col tape"><h2 class="ltr" style="justify-content:flex-end">PETG</h2><ol>
<li>يلتصق بقوة بسطح PEI الناعم، استخدم غراء ستيك كفاصل</li><li>خفّف التبريد إلى 30–50% لالتصاق أقوى بين الطبقات</li><li>اضبط السحب (Retraction) لتقليل الخيوط</li><li>لا تضغط الطبقة الأولى بزيادة، خلّها أعلى شوي من PLA</li><li>جفّفه قبل الطباعة إذا سمعت طقطقة</li></ol></div></div>
<div class="tip">💡 جرّب البكرة الجديدة بقطعة اختبار صغيرة قبل أي طباعة طويلة، <b>وسجّل الإعدادات اللي نجحت</b>.</div>
<p class="note" style="margin-top:5mm">كل الأرقام تقريبية وتختلف بين الشركات والطابعات. توصية الشركة المصنّعة هي المرجع.</p>
<img class="mascot" src="ok.png" style="left:12mm;bottom:12mm;width:60mm">'''
open('pla.html','w',encoding='utf-8').write(doc('PLA أم PETG — مقارنة كاملة',[cover2,tbl,tips2]))

# ---------- 3. Buying checklist ----------
S=[("حجم الطباعة",["اكتب مقاس أكبر قطعة تبي تطبعها (طول × عرض × ارتفاع)","تأكد إن مساحة الطباعة أكبر منها بهامش","فكّر في مشاريعك بعد سنة، مو اليوم بس"]),
("نوع الطابعة",["طابعة الخيط (FDM): أسهل وأرخص وقطع أكبر","طابعة الريزن: تفاصيل أدق للمجسمات الصغيرة","الريزن تحتاج تهوية وقفازات وتنظيف بعد كل طباعة","مفتوحة أو مغلقة؟ المغلقة أفضل لبعض الخيوط وأهدأ"]),
("معايرة السطح",["هل فيها معايرة تلقائية للسطح؟","نوع السطح: PEI مرن يسهّل نزع القطع","سهولة ضبط Z-offset من الشاشة"]),
("الخيوط المدعومة",["أعلى حرارة للفوهة (تحدد الخيوط اللي تقدر تطبعها)","هل السرير يسخن بما يكفي لـ PETG وغيره؟","نوع الدفع (Direct Drive أفضل للخيوط المرنة)"]),
("الدعم وقطع الغيار",["قطع الغيار (فوهات، سيور، أسطح) متوفرة وبسعر معقول","مجتمع مستخدمين كبير وشروحات بالعربي أو الإنجليزي","تحديثات للبرنامج (Firmware) وضمان واضح"])]
cover3='''<div class="cover-box" style="margin-top:8mm"><span class="kick">قائمة HX 3D</span><h1>لا تشترِ <em>طابعة</em><br>قبل هذه القائمة</h1>
<div class="sub">قائمة فحص من 5 أقسام تساعدك تختار الطابعة المناسبة لاحتياجك</div></div>
<img class="stk" src="s_printer_open.png" style="left:16mm;top:122mm;width:88mm;transform:rotate(-4deg)">
<img class="stk" src="s_printer_closed.png" style="right:20mm;top:118mm;width:74mm;transform:rotate(4deg)">
<div class="card" style="position:absolute;right:15mm;bottom:22mm;width:118mm"><div class="lbl">الأقسام</div><ol>'''+''.join(f'<li>{s[0]}</li>' for s in S)+'''<li>احتياجك قبل الشراء</li></ol></div>
<img class="mascot" src="finger.png" style="left:12mm;bottom:12mm;width:56mm">'''
def sec(i,s): return f'<div class="card tape"><h2><span class="n">{i}</span>{s[0]}</h2><ul class="chk">{"".join(f"<li>{x}</li>" for x in s[1])}</ul></div>'
need='''<h1 style="margin-top:0;font-size:26pt">اكتب <em>احتياجك</em> أول</h1><div class="sub" style="margin-bottom:5mm">جاوب على هذي الأسئلة قبل ما تقارن الأسعار</div>
<div class="card tape"><div class="lbl">وش بتطبع غالباً؟</div><div class="blank"></div><div class="blank"></div>
<div class="lbl" style="margin-top:3mm">أكبر قطعة تحتاجها (مم)</div><div class="blank"></div>
<div class="lbl" style="margin-top:3mm">الخيوط اللي تحتاجها</div><ul class="chk" style="display:flex;gap:8mm;flex-wrap:wrap"><li class="ltr">PLA</li><li class="ltr">PETG</li><li class="ltr">TPU</li><li class="ltr">ABS/ASA</li><li>ريزن</li></ul>
<div class="lbl" style="margin-top:3mm">وين بتحطها؟ (غرفة، مكتب، مخزن)</div><div class="blank"></div>
<div class="lbl" style="margin-top:3mm">ميزانيتك</div><div class="blank"></div></div>
<div class="card"><div class="lbl">قارن بين خيارين</div><table><tr><th>البند</th><th>الطابعة 1</th><th>الطابعة 2</th></tr>'''+''.join(f'<tr><td>{s[0]}</td><td></td><td></td></tr>' for s in S)+'''<tr><td>السعر</td><td></td><td></td></tr></table></div>
<div class="tip">💡 احترت؟ <b>اسألنا في التعليقات</b> واكتب احتياجك، ونساعدك تختار.</div>'''
open('buy.html','w',encoding='utf-8').write(doc('قائمة الفحص قبل شراء طابعة 3D',[cover3, sec(1,S[0])+sec(2,S[1])+sec(3,S[2]), sec(4,S[3])+sec(5,S[4])+'<img class="mascot" src="point.png" style="left:10mm;bottom:14mm;width:66mm">', need]))
print('ok')
