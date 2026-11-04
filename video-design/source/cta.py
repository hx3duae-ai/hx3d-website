import re, sys
# file, word, filelabel, cta_start, cta_end, audio_start, audio_dur, caption
f, word, flabel, cs, ce, a0, ad, cap = sys.argv[1:9]
cs, ce, a0, ad = float(cs), float(ce), float(a0), float(ad)
s = open(f, encoding='utf-8').read()
# outro: allow exit before CTA
m = re.search(r'<div class="scene" data-noexit="1"([^>]*?)data-end="([\d.]+)"', s)
s = s[:m.start()] + f'<div class="scene"{m.group(1)}data-end="{cs-0.3:.3f}"' + s[m.end():]
rel = lambda t: round(t - cs, 2)
A = rel(a0)
scene = f'''
<!-- CTA -->
<div class="scene" data-noexit="1" data-start="{cs:.3f}" data-end="{ce:.3f}" data-focus="50% 45%"><div class="inner">
 <div class="el paper" data-at="0" data-r="-1" style="left:60px;top:250px;width:960px;height:1200px"></div>
 <div class="el" data-at="{A:.2f}" data-t="fade" style="right:120px;top:330px"><span class="kick">هدية مجانية</span></div>
 <h1 class="el" data-at="{A+.2:.2f}" data-t="up" style="right:120px;top:420px;font-size:82px;white-space:nowrap">اكتب في <span class="hl" data-hl="{A+1.4:.2f}">التعليقات</span></h1>
 <div class="el" data-at="{A+.5:.2f}" data-t="pop" style="left:150px;top:640px;width:780px;height:330px">
  <svg width="780" height="330" viewBox="0 0 780 330"><path d="M40 20 H740 a20 20 0 0 1 20 20 V230 a20 20 0 0 1 -20 20 H200 L120 315 V250 H40 a20 20 0 0 1 -20 -20 V40 a20 20 0 0 1 20 -20z" fill="#FF66B2" stroke="#111" stroke-width="8" stroke-linejoin="round"/></svg>
  <div class="ctaword" data-type="{A+.7:.2f}" style="position:absolute;left:0;right:0;top:40px;text-align:center;font-weight:900;font-size:150px;line-height:1.1;direction:rtl"><span class="tw">{word}</span><span class="cur" style="display:inline-block;width:10px;height:120px;background:#111;margin-right:10px;vertical-align:middle"></span></div>
 </div>
 <svg class="el" data-at="{A+2.6:.2f}" data-t="fade" style="left:460px;top:985px" width="160" height="150" viewBox="0 0 160 150"><path data-draw="{A+2.7:.2f}" pathLength="1" d="M80 6 C70 50 90 90 80 130" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/><path data-draw="{A+3.3:.2f}" pathLength="1" d="M52 104 L80 136 L108 104" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
 <div class="el" data-at="{A+3.2:.2f}" data-t="pop" style="left:95px;top:1160px">
  <svg width="210" height="250" viewBox="0 0 210 250"><path d="M20 10 H140 L190 60 V240 H20z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/><path d="M140 10 V60 H190" fill="#FF66B2" stroke="#111" stroke-width="8" stroke-linejoin="round"/><g stroke="#111" stroke-width="7" stroke-linecap="round"><line x1="50" y1="110" x2="160" y2="110"/><line x1="50" y1="145" x2="160" y2="145"/><line x1="50" y1="180" x2="120" y2="180"/></g><rect x="40" y="200" width="70" height="26" fill="#FF66B2"/></svg>
 </div>
 <div class="el name" data-at="{A+3.5:.2f}" data-t="up" style="right:110px;top:1180px;text-align:right;font-size:50px;white-space:nowrap;line-height:1.5">ونرسل لك<br><span class="hl" data-hl="{A+4.0:.2f}">{flabel}</span></div>
 <svg class="el" data-at="{A+4.6:.2f}" data-t="pop" style="left:250px;top:985px" width="130" height="130" viewBox="0 0 220 220"><g transform="rotate(-12 110 110)"><circle cx="110" cy="110" r="96" fill="none" stroke="#FF66B2" stroke-width="12"/><text x="110" y="128" text-anchor="middle" font-family="CairoL" font-weight="900" font-size="54" fill="#111">HX 3D</text></g></svg>
</div></div>
'''
s = s.replace('<div id="cap">', scene + '\n<div id="cap">', 1)
s = re.sub(r'const TOTAL=[\d.]+;', f'const TOTAL={ce:.2f};', s)
i = s.rindex(']]];', 0, s.index('const caps=[]'))
s = s[:i] + f']],\n[{a0-0.15:.2f},{ad:.2f},["{cap}"]]];' + s[i+4:]
# typing animation for CTA word
js = '''
 document.querySelectorAll('.ctaword').forEach(el=>{const sc=el.closest('.scene');const s0=+sc.dataset.start,at=+el.dataset.type,lt=t-s0;
  const tw=el.querySelector('.tw'),full=tw.dataset.full||(tw.dataset.full=tw.textContent);const n=Math.max(0,Math.min(full.length,Math.floor((lt-at)/0.16)+1));
  tw.textContent=lt<at?'':full.slice(0,n);el.querySelector('.cur').style.opacity=(Math.floor(t*2.2)%2)?1:0.15;});
 tearAll();
 const c=caps.find'''
s = s.replace(' tearAll();\n const c=caps.find', js, 1)
open(f, 'w', encoding='utf-8').write(s)
print('ok', f)
