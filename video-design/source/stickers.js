(function(){
const C=window.STK||{};
const css=document.createElement('style');css.textContent=`
.stk{filter:drop-shadow(0 10px 12px rgba(0,0,0,.22)) drop-shadow(0 2px 3px rgba(0,0,0,.15));height:auto}
.chain{right:105px;top:1378px;direction:rtl;background:#fff;padding:6px 18px 10px;font-weight:700;font-size:27px;border:3px solid #111;white-space:nowrap;display:flex;align-items:center;gap:12px}
.chain b{color:#111;font-weight:900}
.chain .ar{color:#FF66B2;font-weight:900;font-size:32px}
.chain em{font-style:normal;background:#FF66B2;padding:0 10px}
.clabel{direction:rtl;font-family:CairoL,Cairo;font-weight:900;font-size:32px;background:#fff;padding:4px 14px 8px}`;
document.head.appendChild(css);
const scenes=[...document.querySelectorAll('.scene')];
Object.entries(C).forEach(([i,cfg])=>{const sc=scenes[+i];if(!sc)return;const inner=sc.firstElementChild;
 (cfg.hide||[]).forEach(sel=>inner.querySelectorAll(sel).forEach(e=>{const el=e.closest('.el')||e;el.style.display='none';el.removeAttribute('data-at');el.classList.remove('el');el.querySelectorAll('[data-draw]').forEach(d=>d.removeAttribute('data-draw'));}));
 (cfg.add||[]).forEach(a=>{const im=document.createElement('img');im.src=a.src;im.className='el stk';im.dataset.at=a.at;im.dataset.r=a.r||0;
  im.style.cssText=`left:${a.x}px;top:${a.y}px;width:${a.w}px`;inner.appendChild(im);
  if(a.label){const l=document.createElement('div');l.className='el clabel chip';l.dataset.at=a.at+.5;l.dataset.t='up';l.style.cssText=`left:${a.lx}px;top:${a.ly}px`;l.textContent=a.label;inner.appendChild(l);}});
 if(cfg.chain){const d=document.createElement('div');d.className='el chain chip';d.dataset.at=cfg.chainAt||3;d.dataset.t='up';
  d.innerHTML=cfg.chain.map((s,k)=>(k?'<span class="ar">←</span>':'')+(k===cfg.chain.length-1?`<em>${s}</em>`:`<b>${s}</b>`)).join('');inner.appendChild(d);}
});
})();
