// HX3D decor + motion layer. Injected after the main engine script.
(function(){
const NS='http://www.w3.org/2000/svg';
const R=(s)=>{let x=Math.sin(s*12.9898)*43758.5453;return x-Math.floor(x);};
const css=document.createElement('style');
css.textContent=`
.dc{position:absolute;pointer-events:none}
.dc-tape{width:120px;height:40px;background:rgba(255,102,178,.5);mix-blend-mode:multiply}
.dc-tape.w{background:rgba(255,255,255,.75);mix-blend-mode:normal;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dc-mini{background:#fff;padding:8px 18px 12px;font-family:Ruqaa;font-weight:700;font-size:34px;direction:rtl;color:#111}
.dc-mini.p{background:#FF66B2}
#desk2{position:absolute;left:0;right:0;bottom:0;height:260px;z-index:30;pointer-events:none}
#dust{position:absolute;inset:0;z-index:35;pointer-events:none}
`;
document.head.appendChild(css);

function svg(w,h,vb,inner){const s=document.createElementNS(NS,'svg');s.setAttribute('width',w);s.setAttribute('height',h);s.setAttribute('viewBox',vb);s.innerHTML=inner;return s;}
const DOODLES={
 arrow:(c)=>`<path class="dd" pathLength="1" d="M10 70 C40 20 90 10 140 30" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path class="dd" pathLength="1" d="M118 12 L142 31 L114 46" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
 star:(c)=>`<path class="dd" pathLength="1" d="M40 6 L48 30 L74 32 L54 48 L62 74 L40 59 L18 74 L26 48 L6 32 L32 30 Z" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`,
 spark:(c)=>`<g stroke="${c}" stroke-width="6" stroke-linecap="round"><path class="dd" pathLength="1" d="M40 4 V24"/><path class="dd" pathLength="1" d="M40 56 V76"/><path class="dd" pathLength="1" d="M4 40 H24"/><path class="dd" pathLength="1" d="M56 40 H76"/></g>`,
 squig:(c,w)=>{let d='M4 14';for(let x=4;x<w-10;x+=28)d+=` q14 -14 28 0`;return `<path class="dd" pathLength="1" d="${d}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;},
};
function addDoodle(inner,kind,x,y,w,h,vb,at,color,rot,extraW){
 const s=svg(w,h,vb,DOODLES[kind](color,extraW));s.classList.add('dc');s.style.left=x+'px';s.style.top=y+'px';s.style.transform=`rotate(${rot||0}deg)`;
 s.dataset.dcat=at;s.dataset.kind='draw';inner.appendChild(s);return s;}
function addBox(inner,cls,x,y,at,rot,html,kind){const d=document.createElement('div');d.className='dc '+cls;d.style.left=x+'px';d.style.top=y+'px';d.dataset.rot=rot||0;d.style.transform=`rotate(${rot||0}deg)`;d.dataset.dcat=at;d.dataset.kind=kind||'tape';if(html)d.innerHTML=html;inner.appendChild(d);return d;}

const scenes=[...document.querySelectorAll('.scene')];
scenes.forEach((sc,si)=>{
 const inner=sc.firstElementChild;const k=+(sc.dataset.k||1);
 sc.style.display='block';
 // tape on paper corners
 inner.querySelectorAll(':scope > .paper').forEach((p,pi)=>{
  const at=+(p.dataset.at||0)+.25, L=p.offsetLeft,T=p.offsetTop,W=p.offsetWidth;
  addBox(inner,'dc-tape w',L-38,T-8,at,-38,'','tape');
 });
 // title underline squiggle + spark next to title
 const h1=inner.querySelector(':scope > h1');
 if(h1){
  const at=+(h1.dataset.at||0);const r=document.createRange();r.selectNodeContents(h1);const bb=r.getBoundingClientRect(),ib=inner.getBoundingClientRect();
  const left=bb.left-ib.left,top=bb.top-ib.top,w=Math.min(bb.width,700),hgt=bb.height;
  addDoodle(inner,'squig',left+bb.width-w,top+hgt-6,w,30,`0 0 ${w} 30`,at+.9,'#FF66B2',-1,w);
 }
 // corner doodle on the main paper (bottom-left corner area)
 const main=inner.querySelector(':scope > .paper');
 if(main){
  const L=main.offsetLeft,T=main.offsetTop,H=main.offsetHeight;
  const kinds=['star','spark','star'];
  addDoodle(inner,kinds[si%3],L+30,T+H-110,80,80,'0 0 80 80',2.0+R(si)*1.5,'#FF66B2',R(si+3)*30-15);
 }
 sc.style.display='none';
});

// desk band (cut paper tools along the bottom)
const desk=document.createElement('div');desk.id='desk2';
desk.innerHTML=`
<svg class="dc" style="left:-30px;bottom:30px" width="560" height="110" viewBox="0 0 560 110"><g transform="rotate(-6 280 55)"><rect x="20" y="25" width="520" height="62" fill="#fff" stroke="#111" stroke-width="4"/>
${Array.from({length:26},(_,i)=>`<line x1="${40+i*19}" y1="25" x2="${40+i*19}" y2="${i%5==0?60:45}" stroke="#111" stroke-width="3"/>`).join('')}
<rect x="20" y="70" width="520" height="17" fill="#FF66B2"/></g></svg>
<svg class="dc" style="right:-60px;bottom:40px" width="460" height="90" viewBox="0 0 460 90"><g transform="rotate(10 230 45)"><rect x="60" y="25" width="360" height="38" fill="#FF66B2" stroke="#111" stroke-width="4"/><rect x="390" y="25" width="40" height="38" fill="#fff" stroke="#111" stroke-width="4"/><polygon points="60,25 14,44 60,63" fill="#f3dcc0" stroke="#111" stroke-width="4"/><polygon points="28,38 14,44 28,50" fill="#111"/></g></svg>
<svg class="dc" style="left:470px;bottom:-40px" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="66" fill="#fff" stroke="#111" stroke-width="5"/><circle cx="75" cy="75" r="40" fill="none" stroke="#FF66B2" stroke-width="20"/><circle cx="75" cy="75" r="16" fill="#fff" stroke="#111" stroke-width="5"/></svg>`;
document.body.appendChild(desk);
// dust / confetti
const dust=document.createElement('div');dust.id='dust';
const dots=[];for(let i=0;i<10;i++){const d=document.createElement('div');const s=6+R(i)*10;d.style.cssText=`position:absolute;width:${s}px;height:${s}px;background:${i%3?'#FF66B2':'#111'};opacity:${i%3?.55:.25};${i%2?'border-radius:50%':'transform:rotate(45deg)'}`;dust.appendChild(d);dots.push([d,R(i+1)*1080,R(i+7)*1920,R(i+13)]);}
document.body.insertBefore(dust,document.querySelector('.scene'));dust.style.zIndex=0;

const cl=x=>Math.max(0,Math.min(1,x)),eo=x=>1-Math.pow(1-x,3);
const base=window.setT;
window.setT=function(t){
 base(t);
 // desk parallax
 desk.style.transform=`translate(${Math.sin(t*.25)*10}px,${Math.cos(t*.2)*4}px)`;
 dots.forEach(([d,x,y,ph],i)=>{d.style.left=((x+t*(12+ph*18))%1120-20)+'px';d.style.top=((y-t*(18+ph*22)+1920*4)%1960-20)+'px';});
 scenes.forEach((sc,si)=>{
  if(sc.style.display!=='block')return;
  const s=+sc.dataset.start,k=+(sc.dataset.k||1),lt=(t-s)/k;
  // camera drift
  const inner=sc.firstElementChild;inner.style.transform+=` translate(${Math.sin(t*.6+si)*6}px,${Math.cos(t*.5+si)*4}px) rotate(${Math.sin(t*.35+si)*.35}deg)`;
  // scene enter slide
  const en=eo(cl((t-s)/.55));sc.style.transform=(sc.style.transform||'')+` translateX(${(1-en)*80}px)`;
  // idle float for visible top-level elements
  inner.querySelectorAll(':scope > .el[data-at]').forEach((el,i)=>{const at=+el.dataset.at;if(lt<at+.7||el.classList.contains('paper'))return;
   const a=el.classList.contains('note')?3:1.6;el.style.transform+=` translate(${Math.sin(t*1.1+i*1.7)*a}px,${Math.cos(t*.9+i)*a}px) rotate(${Math.sin(t*.8+i)*.4}deg)`;});
  inner.querySelectorAll('[data-dcat]').forEach(el=>{const at=+el.dataset.dcat,q=eo(cl((lt-at)/.6));
   if(el.dataset.kind==='draw'){el.style.opacity=lt>=at?1:0;el.querySelectorAll('.dd').forEach(p=>{p.style.strokeDasharray=1;p.style.strokeDashoffset=1-q;});}
   else{el.style.opacity=q;el.style.transform=`rotate(${el.dataset.rot}deg) scale(${1.25-.25*q})`;}});
 });
};
// SFX event export
window.sfxEvents=function(){const ev=[];
 scenes.forEach((sc,si)=>{const s=+sc.dataset.start,k=+(sc.dataset.k||1),A=a=>+(s+a*k).toFixed(3);
  if(si>0)ev.push([A(0),'whoosh']);
  sc.querySelectorAll('[data-at]').forEach(el=>{const at=+el.dataset.at;let ty='tap';
   if(el.classList.contains('paper'))ty='paper';else if(el.dataset.t==='pop')ty='pop';else if(el.classList.contains('bar'))ty='rise';else if(el.classList.contains('row'))ty='tick';else if(el.classList.contains('note'))ty='paper';else if(el.dataset.t==='fade')return;
   ev.push([A(at),ty]);});
  sc.querySelectorAll('[data-draw],[data-hl]').forEach(el=>ev.push([A(+(el.dataset.draw||el.dataset.hl)),'scribble']));
  sc.querySelectorAll('[data-dcat]').forEach(el=>ev.push([A(+el.dataset.dcat),el.dataset.kind==='tape'?'tape':'scribble']));
 });
 ev.sort((a,b)=>a[0]-b[0]);const out=[];ev.forEach(e=>{if(!out.some(o=>o[1]===e[1]&&Math.abs(o[0]-e[0])<.18))out.push(e);});return out;};
setT(0);
})();
