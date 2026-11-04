(function(){
const css=document.createElement('style');css.textContent=`
#mascot{position:absolute;left:-14px;bottom:-6px;width:340px;height:487px;z-index:52;pointer-events:none;transform-origin:50% 100%;filter:drop-shadow(0 14px 14px rgba(0,0,0,.22))}
#mascot img{position:absolute;left:0;top:0;width:100%;height:100%}
#mascot .arm{transform-origin:${688/896*100}% ${570/1284*100}%}
#cap{left:415px!important;right:36px!important}
#cap span{font-size:38px!important;padding:10px 22px!important}
#desk2 svg:first-child{display:none}`;document.head.appendChild(css);
const m=document.createElement('div');m.id='mascot';m.innerHTML='<img class="arm" src="star_arm.png"><img src="star_body.png">';document.body.appendChild(m);
const arm=m.querySelector('.arm');const E=window.ENV||[];
const cl=x=>Math.max(0,Math.min(1,x));
const base=window.setT;
window.setT=function(t){base(t);
 const e=E[Math.min(E.length-1,Math.max(0,Math.round(t*30)))]||0;
 const enter=1-Math.pow(1-cl((t-0.2)/0.6),3);
 const g=Math.sin(t*5.2)*e*16+Math.sin(t*2.3+1)*(4+e*6)-e*8;
 arm.style.transform=`rotate(${g}deg)`;
 const bob=Math.abs(Math.sin(t*4.4))*e*-10+Math.sin(t*1.6)*3;
 const tilt=Math.sin(t*1.3)*1.5+Math.sin(t*4.4)*e*1.2;
 m.style.transform=`translateY(${(1-enter)*600+bob}px) rotate(${tilt}deg) scale(${1+e*.015},${1-e*.01})`;
};
setT(0);})();
