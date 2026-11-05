const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:400,height:450},deviceScaleFactor:2,locale:'ar'});
const p=await ctx.newPage();
await p.addInitScript(()=>{window.open=()=>null;});
await p.goto('file://'+__dirname+'/calc.html');
await p.waitForTimeout(1500);
await p.addStyleTag({content:'#cur{position:fixed;z-index:99999;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,102,178,.35);border:3px solid #FF66B2;pointer-events:none;transition:none} #cur.tap{transform:scale(.7);background:rgba(255,102,178,.7)} html{scroll-behavior:auto!important}'});
await p.evaluate(()=>{const c=document.createElement('div');c.id='cur';c.style.left='300px';c.style.top='380px';document.body.appendChild(c)});
let dir,fi;
function clip(n){dir=path.join(__dirname,n);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);fi=0}
async function frame(n=1){for(let i=0;i<n;i++){await p.screenshot({path:path.join(dir,'f'+String(fi++).padStart(4,'0')+'.jpg'),type:'jpeg',quality:90})}}
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
async function scrollTo(sel,frames=20,off=60){const y0=await p.evaluate(()=>scrollY);const y1=await p.evaluate(([s,o])=>{const e=document.querySelector(s);return e.getBoundingClientRect().top+scrollY-o},[sel,off]);
 for(let i=1;i<=frames;i++){await p.evaluate(y=>scrollTo(0,y),y0+(y1-y0)*ease(i/frames));await frame()}}
async function cur(x,y,frames=10){const [x0,y0]=await p.evaluate(()=>{const c=document.getElementById('cur');return [parseFloat(c.style.left),parseFloat(c.style.top)]});
 for(let i=1;i<=frames;i++){const k=ease(i/frames);await p.evaluate(([x,y])=>{const c=document.getElementById('cur');c.style.left=x+'px';c.style.top=y+'px'},[x0+(x-x0)*k,y0+(y-y0)*k]);await frame()}}
async function center(sel){return p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]},sel)}
async function tapEl(sel,action){const [x,y]=await center(sel);await cur(x,y,10);await p.evaluate(()=>document.getElementById('cur').classList.add('tap'));await frame(3);
 if(action)await action();else await p.click(sel);await p.evaluate(()=>document.getElementById('cur').classList.remove('tap'));await frame(4)}
async function typeIn(sel,text){await tapEl(sel,async()=>{await p.focus(sel);await p.fill(sel,'')});{const [x,y]=await center(sel);await cur(x+70,y+55,6)}for(const ch of text){await p.type(sel,ch);await frame(3)}}

// F overview
clip('F');await frame(20);await scrollTo('fieldset:nth-of-type(2)',50,10);await frame(10);await scrollTo('.result',40,10);await frame(30);
// A import file
clip('A');await p.evaluate(()=>scrollTo(0,0));await scrollTo('#imp',1,140);await frame(15);
await tapEl('#imp',async()=>{await p.setInputFiles('#imp',path.join(__dirname,'vase.stl'))});await frame(25);
await scrollTo('#vol',30,90);await frame(30);await scrollTo('.result',35,10);await frame(60);
// B costs
clip('B');await scrollTo('#kg',1,120);await frame(10);await typeIn('#kg','95');await frame(6);await typeIn('#el','0.08');await frame(6);await typeIn('#waste','7');await frame(10);await scrollTo('#supm',30,100);await frame(40);
// C price
clip('C');await scrollTo('[data-set="mar"][data-v="50"]',1,170);await frame(10);await tapEl('[data-set="mar"][data-v="50"]');await frame(10);
await scrollTo('.result',30,10);await frame(25);await scrollTo('#tiers',30,140);await frame(40);
// D invoice
clip('D');await scrollTo('#dtype',1,110);await frame(10);await tapEl('#dtype',async()=>{await p.selectOption('#dtype','tax')});await frame(10);
await typeIn('#dcust','محل الهدايا');await frame(10);await scrollTo('#wa',25,300);await tapEl('#wa');await frame(40);
// E brand
clip('E');await p.evaluate(()=>scrollTo(0,0));await frame(8);await tapEl('#brandBtn');await frame(8);await scrollTo('#br_co',12,120);await typeIn('#br_co','متجري');await frame(30);
await b.close();})();
